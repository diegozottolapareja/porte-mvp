import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'

export interface DetailField {
  label: string
  value: string
}

interface EntityDetailDialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  statusNode?: ReactNode
  fields: DetailField[]
  onEdit?: () => void
}

// Vista de solo lectura de una tarjeta (Ingreso/Egreso/Gasto fijo): tocar la
// tarjeta abre esto en vez de ir directo a editar. El botón Editar de acá
// lleva al formulario/dialog de edición existente — separa "ver" de "editar".
export function EntityDetailDialog({ open, onClose, title, subtitle, statusNode, fields, onEdit }: EntityDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {title}
            {statusNode}
          </DialogTitle>
        </DialogHeader>
        {subtitle && <p className="text-sm text-muted-foreground -mt-3">{subtitle}</p>}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
          {fields.map(f => (
            <div key={f.label}>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{f.label}</p>
              <p className="text-sm font-medium text-gray-800">{f.value}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {onEdit && <Button onClick={onEdit}>Editar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
