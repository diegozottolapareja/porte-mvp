export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  error?: boolean
}

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
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
      </div>
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
