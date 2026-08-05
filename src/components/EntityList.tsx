import { Inbox } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { LoadingDots } from './LoadingDots'

interface EntityListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T) => string
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: { label: string; onClick: () => void }
  className?: string
  gap?: 'sm' | 'md' | 'lg'
}

const gapClass = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' }

export function EntityList<T>({
  items,
  renderItem,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'Sin resultados',
  emptyDescription = 'No hay elementos para mostrar.',
  emptyAction,
  className = '',
  gap = 'md',
}: EntityListProps<T>) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingDots />
      </div>
    )
  }

  if (items.length === 0) {
    return <EmptyState Icon={Inbox} title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }

  return (
    <div className={`flex flex-col ${gapClass[gap]} ${className}`}>
      {items.map((item, index) => (
        <div key={keyExtractor(item)}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}
