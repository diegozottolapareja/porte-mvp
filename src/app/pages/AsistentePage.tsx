import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { ChatMessage, type ChatMessageData } from '@/components/assistant/ChatMessage'
import { VoiceRecorder } from '@/components/assistant/VoiceRecorder'
import { FileAttachButton } from '@/components/assistant/FileAttachButton'
import { AttachmentPreview } from '@/components/assistant/AttachmentPreview'
import { sendAssistantMessage, transcribeAudio, uploadAssistantFiles } from '@/lib/assistantApi'
import { usePorteData } from '@/modules/porte/store'

const WELCOME_MESSAGE: ChatMessageData = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hola, soy el asistente de Porte. Contame qué presupuesto querés cargar — por texto, audio o adjuntando una foto o PDF de un comprobante.',
}

export default function AsistentePage() {
  const navigate = useNavigate()
  const { refetch } = usePorteData()
  const [messages, setMessages] = useState<ChatMessageData[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recording, setRecording] = useState(false)
  const conversationIdRef = useRef<string | undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, transcribing])

  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id

  const runTurn = async (text: string) => {
    const userMessageId = crypto.randomUUID()
    const pendingId = crypto.randomUUID()

    setMessages(prev => [
      ...prev,
      { id: userMessageId, role: 'user', content: text },
      { id: pendingId, role: 'assistant', content: '', pending: true },
    ])
    setSending(true)

    try {
      const response = await sendAssistantMessage(text, conversationIdRef.current)
      if (!response.success) throw new Error(response.error ?? 'Error del asistente')

      conversationIdRef.current = response.conversationId
      setMessages(prev => prev.map(m => (m.id === pendingId ? { ...m, content: response.message ?? '', pending: false, pendingAction: response.pendingAction } : m)))

      if (response.action) {
        if (response.action.ok) {
          // La acción se ejecutó del lado del backend (service role), fuera del
          // store — sin este refetch, el usuario solo vería el dato nuevo al
          // recargar la página manualmente.
          refetch()
        } else {
          toast.error(response.action.error ?? 'No se pudo ejecutar la acción')
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setMessages(prev => prev.map(m => (m.id === pendingId ? { ...m, content: errorMessage, pending: false, error: true } : m)))
    } finally {
      setSending(false)
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (sending || transcribing) return

    if (attachedFiles.length > 0) {
      sendFiles(attachedFiles, text)
      return
    }
    if (!text) return
    setInput('')
    runTurn(text)
  }

  const sendFiles = async (files: File[], caption: string) => {
    const userMessageId = crypto.randomUUID()
    const pendingId = crypto.randomUUID()

    setMessages(prev => [
      ...prev,
      { id: userMessageId, role: 'user', content: caption, attachments: files.map(f => ({ name: f.name, size: f.size })) },
      { id: pendingId, role: 'assistant', content: '', pending: true },
    ])
    setInput('')
    setAttachedFiles([])
    setSending(true)

    try {
      const response = await uploadAssistantFiles(files, conversationIdRef.current, caption || undefined)
      if (!response.success) throw new Error(response.error ?? 'No se pudieron procesar los archivos')

      conversationIdRef.current = response.conversationId
      setMessages(prev => prev.map(m => (m.id === pendingId ? { ...m, content: response.message ?? '', pending: false, pendingAction: response.pendingAction } : m)))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setMessages(prev => prev.map(m => (m.id === pendingId ? { ...m, content: errorMessage, pending: false, error: true } : m)))
    } finally {
      setSending(false)
    }
  }

  const handleFilesSelected = (files: File[]) => {
    setAttachedFiles(prev => [...prev, ...files])
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleRecorded = async (blob: Blob) => {
    setTranscribing(true)
    try {
      const result = await transcribeAudio(blob)
      if (!result.success || !result.text) throw new Error(result.error ?? 'No se pudo transcribir el audio')
      await runTurn(result.text)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error transcribiendo el audio')
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <AppShell title="Asistente" onBack={() => navigate(-1)} narrow>
      <div className="flex flex-col gap-3">
        {messages.map(message => (
          <ChatMessage key={message.id} message={message} onQuickReply={message.id === lastAssistantId ? runTurn : undefined} />
        ))}
        {transcribing && <ChatMessage message={{ id: 'transcribing', role: 'user', content: '', pending: true }} />}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 -mx-4 mt-3 px-4 py-3 bg-background/95 backdrop-blur border-t border-border lg:-mx-6 lg:px-6">
        <AttachmentPreview files={attachedFiles} onRemove={handleRemoveAttachment} disabled={sending || transcribing} />
        <div className="flex items-center gap-2">
          {!recording && (
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
              placeholder={attachedFiles.length > 0 ? 'Agregá un comentario (opcional)...' : 'Escribí un mensaje...'}
              disabled={sending || transcribing}
              className="flex-1 min-w-0 h-12 px-4 rounded-2xl border border-border bg-white text-sm disabled:opacity-50"
            />
          )}
          {!recording && <FileAttachButton onFilesSelected={handleFilesSelected} disabled={sending || transcribing} />}
          <VoiceRecorder onRecorded={handleRecorded} onRecordingChange={setRecording} disabled={sending || transcribing} />
          {!recording && (
            <button
              onClick={handleSend}
              disabled={sending || transcribing || (!input.trim() && attachedFiles.length === 0)}
              aria-label="Enviar mensaje"
              className="w-12 h-12 rounded-full bg-primary flex items-center justify-center disabled:opacity-50 shrink-0"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>
    </AppShell>
  )
}
