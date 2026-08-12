import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { ChatMessage, type ChatMessageData } from '@/components/assistant/ChatMessage'
import { VoiceRecorder } from '@/components/assistant/VoiceRecorder'
import { sendAssistantMessage, transcribeAudio } from '@/lib/assistantApi'

const WELCOME_MESSAGE: ChatMessageData = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hola, soy el asistente de Porte. Contame qué presupuesto querés cargar — por texto o por audio.',
}

export default function AsistentePage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessageData[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recording, setRecording] = useState(false)
  const conversationIdRef = useRef<string | undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, transcribing])

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
      setMessages(prev => prev.map(m => (m.id === pendingId ? { ...m, content: response.message ?? '', pending: false } : m)))

      if (response.action && !response.action.ok) {
        toast.error(response.action.error ?? 'No se pudo ejecutar la acción')
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
    if (!text || sending || transcribing) return
    setInput('')
    runTurn(text)
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
        {messages.map(message => <ChatMessage key={message.id} message={message} />)}
        {transcribing && <ChatMessage message={{ id: 'transcribing', role: 'user', content: '', pending: true }} />}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 -mx-4 mt-3 px-4 py-3 bg-background/95 backdrop-blur border-t border-border flex items-center gap-2 lg:-mx-6 lg:px-6">
        {!recording && (
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            placeholder="Escribí un mensaje..."
            disabled={sending || transcribing}
            className="flex-1 h-12 px-4 rounded-2xl border border-border bg-white text-sm disabled:opacity-50"
          />
        )}
        <VoiceRecorder onRecorded={handleRecorded} onRecordingChange={setRecording} disabled={sending || transcribing} />
        {!recording && (
          <button
            onClick={handleSend}
            disabled={sending || transcribing || !input.trim()}
            aria-label="Enviar mensaje"
            className="w-12 h-12 rounded-full bg-primary flex items-center justify-center disabled:opacity-50 shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    </AppShell>
  )
}
