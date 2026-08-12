import { useRef } from 'react'
import { toast } from 'sonner'
import { Paperclip } from 'lucide-react'

// Límites en duplicado del lado del cliente para dar feedback inmediato —
// la validación real (autoritativa) vive en api/assistant/upload.ts.
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
export const MAX_FILES_PER_UPLOAD = 5

interface FileAttachButtonProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

export function FileAttachButton({ onFilesSelected, disabled }: FileAttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    if (files.length > MAX_FILES_PER_UPLOAD) {
      toast.error(`Máximo ${MAX_FILES_PER_UPLOAD} archivos por mensaje`)
      return
    }
    const invalido = files.find(f => !ALLOWED_MIME_TYPES.includes(f.type))
    if (invalido) {
      toast.error(`"${invalido.name}" no es un tipo soportado — solo PDF, JPG o PNG`)
      return
    }
    const pesado = files.find(f => f.size > MAX_FILE_SIZE_BYTES)
    if (pesado) {
      toast.error(`"${pesado.name}" pesa más de ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`)
      return
    }

    onFilesSelected(files)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_MIME_TYPES.join(',')}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="Adjuntar archivo"
        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 disabled:opacity-50"
      >
        <Paperclip className="w-4 h-4 text-muted-foreground" />
      </button>
    </>
  )
}
