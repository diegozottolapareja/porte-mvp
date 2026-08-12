import { FileText, Image as ImageIcon, X } from 'lucide-react'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

interface AttachmentPreviewProps {
  files: File[]
  onRemove: (index: number) => void
  disabled?: boolean
}

export function AttachmentPreview({ files, onRemove, disabled }: AttachmentPreviewProps) {
  if (files.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {files.map((file, i) => (
        <div key={`${file.name}-${i}`} className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-muted text-xs text-dark-graphite max-w-[200px]">
          {file.type === 'application/pdf' ? <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> : <ImageIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate">{file.name}</span>
          <span className="text-muted-foreground shrink-0">{formatSize(file.size)}</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            disabled={disabled}
            aria-label={`Quitar ${file.name}`}
            className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 hover:bg-black/10 disabled:opacity-50"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
