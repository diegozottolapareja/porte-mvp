import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'

interface CardActionsMenuProps {
  onEdit?: () => void
  onDelete?: () => void
  editLabel?: string
  deleteLabel?: string
}

export function CardActionsMenu({ onEdit, onDelete, editLabel = 'Editar', deleteLabel = 'Eliminar' }: CardActionsMenuProps) {
  if (!onEdit && !onDelete) return null

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
