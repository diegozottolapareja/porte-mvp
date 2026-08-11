import { createAdminClient, authenticateRequest } from '../_lib/supabaseAdmin';
import { ASSISTANT_TOOLS, SYSTEM_PROMPT } from '../_lib/assistantTools';
import { executeAction } from '../_lib/actionExecutor';

export const config = { runtime: 'edge' };

const MAX_HISTORY_MESSAGES = 20;
const OPENAI_MODEL = 'gpt-4o-mini';

type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ChatCompletionMessage {
  role: ChatRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ChatCompletionResponse {
  choices: Array<{ message: ChatCompletionMessage }>;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function callOpenAI(messages: ChatCompletionMessage[]): Promise<ChatCompletionResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada en el servidor');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages, tools: ASSISTANT_TOOLS, tool_choice: 'auto' }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`OpenAI API ${response.status}: ${text}`);
  }
  return response.json();
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Solo se permite POST' }, 405);
  }

  const supabase = createAdminClient();
  const user = await authenticateRequest(request, supabase);
  if (!user) {
    return jsonResponse({ success: false, error: 'No autorizado' }, 401);
  }

  let body: { conversationId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Body inválido, se esperaba JSON' }, 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return jsonResponse({ success: false, error: 'Falta el mensaje' }, 400);
  }

  try {
    let conversationId = body.conversationId;
    if (!conversationId) {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id })
        .select('id')
        .single();
      if (error || !conversation) throw new Error(`Error creando conversación: ${error?.message}`);
      conversationId = conversation.id;
    }

    await supabase.from('conversation_messages').insert({ conversation_id: conversationId, role: 'user', content: text });

    const { data: historyRows, error: historyError } = await supabase
      .from('conversation_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(MAX_HISTORY_MESSAGES);
    if (historyError) throw new Error(`Error leyendo historial: ${historyError.message}`);

    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(historyRows ?? []).map((row): ChatCompletionMessage => ({
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: row.content,
      })),
    ];

    let completion = await callOpenAI(messages);
    let choice = completion.choices[0];

    let actionName: string | undefined;
    let actionParams: Record<string, unknown> | undefined;
    let actionResult: unknown;
    let actionError: string | undefined;

    const toolCall = choice.message.tool_calls?.[0];
    if (toolCall) {
      actionName = toolCall.function.name;
      try {
        actionParams = JSON.parse(toolCall.function.arguments);
      } catch {
        actionParams = {};
      }

      const result = await executeAction(actionName, actionParams ?? {}, user.id);
      actionResult = result.data;
      actionError = result.error;

      messages.push(choice.message);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result.ok ? { success: true, presupuesto: result.data } : { success: false, error: result.error }),
      });

      completion = await callOpenAI(messages);
      choice = completion.choices[0];
    }

    const assistantText = choice.message.content ?? '';

    await supabase.from('conversation_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantText,
      action_name: actionName ?? null,
      action_params: actionParams ?? null,
      action_result: actionResult ?? null,
      error: actionError ?? null,
    });

    return jsonResponse(
      {
        success: true,
        conversationId,
        message: assistantText,
        action: actionName ? { name: actionName, ok: !actionError, error: actionError } : undefined,
      },
      200,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return jsonResponse({ success: false, error: message }, 500);
  }
}
