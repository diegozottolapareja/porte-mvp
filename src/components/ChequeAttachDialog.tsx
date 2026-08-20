import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'

export interface ChequeAttachData {
  banco: string
  numero: string
  fechaVencimiento: string
}

interface ChequeAttachDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: ChequeAttachData) => Promise<void>
}

// Se abre cuando el pill de una tarjeta pasa a "Cheque emitido" — pide los
// mismos datos que el alta con cheque, para que la tarjeta termine idéntica
// a una creada con cheque desde el vamos (cheque real vinculado, cuenta en
// el banner de "cheques todavía no debitados").
export function ChequeAttachDialog({ open, onClose, onConfirm }: ChequeAttachDialogProps) {
  const [banco, setBanco] = useState('')
  const [numero, setNumero] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setBanco('')
      setNumero('')
      setFechaVencimiento('')
      setSaving(false)
    }
  }, [open])

  const handleConfirm = async () => {
    if (!fechaVencimiento) return
    setSaving(true)
    await onConfirm({ banco, numero, fechaVencimiento })
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={next => !next && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Datos del cheque</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Completá los datos del cheque para vincularlo — va a sumar al contador de cheques todavía no debitados.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-sm text-muted-foreground mb-1.5 block">Banco</label>
            <input value={banco} onChange={e => setBanco(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Número</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Fecha vencimiento</label>
            <input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleConfirm()} disabled={saving || !fechaVencimiento}>
            {saving ? 'Guardando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
