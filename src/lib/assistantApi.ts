import { supabase } from './supabaseClient'

export interface AssistantMessageResponse {
  success: boolean
  conversationId?: string
  message?: string
  action?: { name: string; ok: boolean; error?: string }
  error?: string
}

export interface TranscribeResponse {
  success: boolean
  text?: string
  error?: string
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sesión no encontrada — volvé a iniciar sesión')
  return { authorization: `Bearer ${token}` }
}

export async function sendAssistantMessage(text: string, conversationId?: string): Promise<AssistantMessageResponse> {
  const response = await fetch('/api/assistant/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ text, conversationId }),
  })
  return response.json()
}

export async function transcribeAudio(blob: Blob): Promise<TranscribeResponse> {
  const form = new FormData()
  form.append('audio', blob, 'audio.webm')
  const response = await fetch('/api/assistant/transcribe', {
    method: 'POST',
    headers: await authHeader(),
    body: form,
  })
  return response.json()
}
