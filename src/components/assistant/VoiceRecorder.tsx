import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Mic, Square, X } from 'lucide-react'

interface VoiceRecorderProps {
  onRecorded: (blob: Blob) => void
  onRecordingChange?: (recording: boolean) => void
  disabled?: boolean
}

export function VoiceRecorder({ onRecorded, onRecordingChange, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
  }

  const start = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Este dispositivo no soporta grabación de audio')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        releaseStream()
        if (blob.size > 0) onRecorded(blob)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setSeconds(0)
      setRecording(true)
      onRecordingChange?.(true)
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      toast.error('No se pudo acceder al micrófono — revisá los permisos del navegador')
    }
  }

  const stop = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    onRecordingChange?.(false)
  }

  const cancel = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    releaseStream()
    setRecording(false)
    onRecordingChange?.(false)
  }

  if (recording) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return (
      <div className="flex items-center gap-2 flex-1">
        <span className="flex items-center gap-1.5 text-sm text-destructive tabular-nums shrink-0">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          {mm}:{ss}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={cancel} aria-label="Cancelar grabación" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <button type="button" onClick={stop} aria-label="Detener y enviar grabación" className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Square className="w-3.5 h-3.5 text-white fill-white" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      aria-label="Grabar mensaje de voz"
      className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 disabled:opacity-50"
    >
      <Mic className="w-4 h-4 text-muted-foreground" />
    </button>
  )
}
