import { User } from 'lucide-react'

interface UserAvatarProps {
  src?: string
  name: string
  className?: string
  iconClassName?: string
}

// Avatar con imagen si el usuario tiene avatarUrl, o un ícono de persona
// como fallback — profiles no tiene foto real, así que esto es lo normal.
export function UserAvatar({ src, name, className = '', iconClassName = '' }: UserAvatarProps) {
  if (src) {
    return <img src={src} alt={name} className={className} />
  }

  return (
    <div className={`bg-primary/10 text-primary flex items-center justify-center ${className}`}>
      <User className={iconClassName} />
    </div>
  )
}
