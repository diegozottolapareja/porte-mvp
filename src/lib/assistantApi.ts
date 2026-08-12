import { supabase } from './supabaseClient'

export interface AssistantMessageResponse {
  success: boolean
  conversationId?: string
  message?: string
  action?: { name: string; ok: boolean; error?: string }
  pendingAction?: boolean
  error?: string
}

export interface TranscribeResponse {
  success: boolean
  text?: string
  error?: string
}

export interface UploadFileResult {
  name: string
  size: number
  documentType?: string
  error?: string
}

export interface UploadAssistantFilesResponse {
  success: boolean
  conversationId?: string
  message?: string
  pendingAction?: boolean
  files?: UploadFileResult[]
  error?: string
}

async function authHeader(forceRefresh: boolean): Promise<Record<string, string>> {
  const { data } = forceRefresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sesión no encontrada — volvé a iniciar sesión')
  return { authorization: `Bearer ${token}` }
}

// El access token puede vencer (ej. grabaciones largas, pestaña en segundo
// plano que frena el auto-refresh de supabase-js). Si el backend responde
// 401, se refresca la sesión una vez y se reintenta antes de rendirse.
async function authorizedFetch(input: string, init: RequestInit): Promise<Response> {
  const attempt = async (forceRefresh: boolean) => {
    const headers = { ...init.headers, ...(await authHeader(forceRefresh)) }
    return fetch(input, { ...init, headers })
  }

  const response = await attempt(false)
  if (response.status !== 401) return response
  return attempt(true)
}

export async function sendAssistantMessage(text: string, conversationId?: string): Promise<AssistantMessageResponse> {
  const response = await authorizedFetch('/api/assistant/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, conversationId }),
  })
  return response.json()
}

export async function transcribeAudio(blob: Blob): Promise<TranscribeResponse> {
  const form = new FormData()
  form.append('audio', blob, 'audio.webm')
  const response = await authorizedFetch('/api/assistant/transcribe', {
    method: 'POST',
    body: form,
  })
  return response.json()
}

export async function uploadAssistantFiles(files: File[], conversationId?: string, text?: string): Promise<UploadAssistantFilesResponse> {
  const form = new FormData()
  files.forEach(file => form.append('files', file, file.name))
  if (conversationId) form.append('conversationId', conversationId)
  if (text) form.append('text', text)

  const response = await authorizedFetch('/api/assistant/upload', {
    method: 'POST',
    body: form,
  })
  return response.json()
}
