import { createAdminClient, authenticateRequest } from '../_lib/supabaseAdmin';

export const config = { runtime: 'edge' };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ success: false, error: 'Config de OpenAI incompleta en el servidor' }, 500);
  }

  let incomingForm: FormData;
  try {
    incomingForm = await request.formData();
  } catch {
    return jsonResponse({ success: false, error: 'Se esperaba multipart/form-data' }, 400);
  }

  const audio = incomingForm.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return jsonResponse({ success: false, error: 'Falta el archivo de audio' }, 400);
  }

  const outgoingForm = new FormData();
  outgoingForm.append('file', audio, 'audio.webm');
  outgoingForm.append('model', 'whisper-1');
  outgoingForm.append('language', 'es');

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: outgoingForm,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI API ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { text?: string };
    return jsonResponse({ success: true, text: data.text ?? '' }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return jsonResponse({ success: false, error: message }, 500);
  }
}
