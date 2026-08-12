export interface ChatMessageAttachment {
  name: string
  size: number
}

export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  error?: boolean
  attachments?: ChatMessageAttachment[]
  /** El backend detectó una extracción de documento pendiente de confirmación en este turno. */
  pendingAction?: boolean
}

export function ChatMessage({ message, onQuickReply }: { message: ChatMessageData; onQuickReply?: (text: string) => void }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1.5`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-primary text-white rounded-br-sm'
            : message.error
              ? 'bg-destructive/10 text-destructive rounded-bl-sm'
              : 'bg-muted text-dark-graphite rounded-bl-sm'
        }`}
      >
        {message.pending ? <TypingDots /> : message.content}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-1 mt-1.5 pt-1.5 border-t border-white/20">
            {message.attachments.map((a, i) => (
              <span key={i} className="text-xs text-white/80 truncate">📎 {a.name}</span>
            ))}
          </div>
        )}
      </div>

      {!isUser && message.pendingAction && onQuickReply && (
        <div className="flex gap-2">
          <button type="button" onClick={() => onQuickReply('Confirmar')} className="px-3 py-1.5 rounded-full bg-primary text-white text-xs">
            Confirmar
          </button>
          <button type="button" onClick={() => onQuickReply('Revisar')} className="px-3 py-1.5 rounded-full bg-muted text-dark-graphite text-xs">
            Revisar
          </button>
          <button type="button" onClick={() => onQuickReply('Cancelar')} className="px-3 py-1.5 rounded-full bg-muted text-dark-graphite text-xs">
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}
