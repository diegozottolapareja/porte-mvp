import type { ComponentType } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'

interface CardActionsMenuExtraAction {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
}

interface CardActionsMenuProps {
  onEdit?: () => void
  onDelete?: () => void
  editLabel?: string
  deleteLabel?: string
  // Acciones adicionales entre Editar y Eliminar (ej. "Vincular cheque") —
  // genérico para no atar este componente compartido a un dominio puntual.
  extraActions?: CardActionsMenuExtraAction[]
}

export function CardActionsMenu({ onEdit, onDelete, editLabel = 'Editar', deleteLabel = 'Eliminar', extraActions }: CardActionsMenuProps) {
  if (!onEdit && !onDelete && !extraActions?.length) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          aria-label="Más acciones"
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        {onEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="w-4 h-4" />
            {editLabel}
          </DropdownMenuItem>
        )}
        {extraActions?.map(action => (
          <DropdownMenuItem key={action.label} onSelect={action.onClick}>
            <action.icon className="w-4 h-4" />
            {action.label}
          </DropdownMenuItem>
        ))}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 className="w-4 h-4" />
            {deleteLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
