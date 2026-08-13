import { createAdminClient, authenticateRequest } from '../_lib/supabaseAdmin.js';
import { ASSISTANT_TOOLS, SYSTEM_PROMPT } from '../_lib/assistantTools.js';
import { executeAction } from '../_lib/actionExecutor.js';

export const config = { runtime: 'edge' };

const MAX_HISTORY_MESSAGES = 20;
const OPENAI_MODEL = 'gpt-4o-mini';
// Tope de hops tool-calling → OpenAI en un mismo turno. El flujo
// create_cliente → create_presupuesto necesita 2; se deja margen sin permitir
// loops accidentales.
const MAX_TOOL_HOPS = 4;

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
    let pendingExtraction: unknown = null;
    let pendingExtractionType: string | null = null;

    if (!conversationId) {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id })
        .select('id')
        .single();
      if (error || !conversation) throw new Error(`Error creando conversación: ${error?.message}`);
      conversationId = conversation.id;
    } else {
      const { data: existing, error } = await supabase
        .from('conversations')
        .select('pending_extraction, pending_extraction_type')
        .eq('id', conversationId)
        .single();
      if (error) throw new Error(`Error leyendo conversación: ${error.message}`);
      pendingExtraction = existing?.pending_extraction ?? null;
      pendingExtractionType = existing?.pending_extraction_type ?? null;
    }

    await supabase.from('conversation_messages').insert({ conversation_id: conversationId, role: 'user', content: text });

    // Atajo determinístico: el botón "Cancelar" del frontend manda literalmente
    // este texto — no hace falta gastar una llamada a OpenAI para resolverlo.
    if (pendingExtraction && text.toLowerCase() === 'cancelar') {
      await supabase.from('conversations').update({ pending_extraction: null, pending_extraction_type: null }).eq('id', conversationId);
      const cancelText = 'Listo, cancelado. ¿Con qué seguimos?';
      await supabase.from('conversation_messages').insert({ conversation_id: conversationId, role: 'assistant', content: cancelText });
      return jsonResponse({ success: true, conversationId, message: cancelText }, 200);
    }

    const { data: historyRows, error: historyError } = await supabase
      .from('conversation_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(MAX_HISTORY_MESSAGES);
    if (historyError) throw new Error(`Error leyendo historial: ${historyError.message}`);

    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(pendingExtraction
        ? [{ role: 'system' as const, content: `Hay una extracción de un documento pendiente de confirmación (documentType: "${pendingExtractionType}"): ${JSON.stringify(pendingExtraction)}. Usá estos datos para completar la acción correspondiente en cuanto el usuario confirme o corrija algo.` }]
        : []),
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
    let pendingCleared = false;

    // Multi-hop: una misma respuesta de OpenAI puede traer varias tool_calls
    // (llamadas en paralelo), y resolverlas puede hacer que el modelo pida
    // otra ronda de tools (ej. create_cliente y recién después, en el
    // siguiente hop, create_presupuesto). Se procesan todas las tool_calls de
    // cada respuesta antes de volver a llamar a OpenAI, y se repite hasta que
    // el modelo devuelva texto sin tool_calls o se llegue a MAX_TOOL_HOPS.
    let hops = 0;
    while (choice.message.tool_calls && choice.message.tool_calls.length > 0 && hops < MAX_TOOL_HOPS) {
      hops++;
      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        actionName = toolCall.function.name;
        let params: Record<string, unknown>;
        try {
          params = JSON.parse(toolCall.function.arguments);
        } catch {
          params = {};
        }
        actionParams = params;

        const result = await executeAction(actionName, params, user.id);
        actionResult = result.data;
        actionError = result.error;

        // Una vez que una acción de creación se ejecuta con éxito, la extracción
        // pendiente quedó resuelta — se limpia para no volver a inyectarla.
        if (result.ok && pendingExtraction) {
          await supabase.from('conversations').update({ pending_extraction: null, pending_extraction_type: null }).eq('id', conversationId);
          pendingCleared = true;
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.ok ? { success: true, data: result.data } : { success: false, error: result.error }),
        });
      }

      completion = await callOpenAI(messages);
      choice = completion.choices[0];
    }

    const assistantText = choice.message.content
      ?? (hops >= MAX_TOOL_HOPS
        ? 'No pude terminar de resolver el pedido en los pasos permitidos. ¿Podés reformularlo o hacerlo en partes más simples?'
        : '');

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
        pendingAction: !!pendingExtraction && !pendingCleared,
      },
      200,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return jsonResponse({ success: false, error: message }, 500);
  }
}
