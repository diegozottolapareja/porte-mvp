import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { formatDate, formatCurrency, todayLocal } from '@/lib/format'
import { siguientesEstadosCheque, chequeImpactaCaja, CHEQUE_ESTADO_STYLE, type Cheque, type ChequeEstado } from '@/modules/porte'
import { useCajas } from '@/modules/porte/store'

interface ChequeEstadoDialogProps {
  cheque: Cheque | null
  onClose: () => void
  onConfirm: (nuevoEstado: ChequeEstado, fecha: string, cajaId?: string) => void
}

// Diálogo único para avanzar el estado de un cheque, sin importar si viene
// de un Egreso, un Ingreso o un Gasto Fijo — las transiciones válidas salen
// de `siguientesEstadosCheque` (data/cheques.ts), nunca hardcodeadas acá, así
// las 3 pantallas quedan consistentes entre sí.
export function ChequeEstadoDialog({ cheque, onClose, onConfirm }: ChequeEstadoDialogProps) {
  const cajas = useCajas()
  const [nuevoEstado, setNuevoEstado] = useState<ChequeEstado | null>(null)
  const [fecha, setFecha] = useState(todayLocal())
  const [cajaId, setCajaId] = useState('')

  const open = cheque !== null
  const opciones = cheque ? siguientesEstadosCheque(cheque.direccion, cheque.estado) : []

  const handleOpenChange = (next: boolean) => { if (!next) handleClose() }

  const handleClose = () => {
    setNuevoEstado(null)
    setFecha(todayLocal())
    onClose()
  }

  const handleSelectEstado = (estado: ChequeEstado) => {
    setNuevoEstado(estado)
    setCajaId(cheque?.cajaId ?? '')
  }

  const handleConfirm = () => {
    if (!nuevoEstado) return
    onConfirm(nuevoEstado, fecha, chequeImpactaCaja(nuevoEstado) ? (cajaId || undefined) : undefined)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{cheque?.numero ? `Cheque N° ${cheque.numero}` : 'Cheque'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Banco</p>
              <p className="font-medium">{cheque?.banco ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Monto</p>
              <p className="font-medium">{cheque ? formatCurrency(cheque.monto) : '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs">Vencimiento</p>
              <p className="font-medium">{cheque ? formatDate(cheque.fechaVencimiento) : '—'}</p>
            </div>
          </div>

          {!nuevoEstado ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Nuevo estado</p>
              {opciones.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {opciones.map(estado => {
                    const s = CHEQUE_ESTADO_STYLE[estado]
                    return (
                      <button
                        key={estado}
                        onClick={() => handleSelectEstado(estado)}
                        className={`px-3 py-2 rounded-xl border border-transparent text-sm font-medium ${s.color} ${s.bgColor}`}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Este cheque ya está en un estado final.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Fecha de {CHEQUE_ESTADO_STYLE[nuevoEstado].label.toLowerCase()}</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm"
                />
              </div>
              {chequeImpactaCaja(nuevoEstado) && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Caja</label>
                  <div className="flex gap-2 flex-wrap">
                    {cajas.filter(c => c.tipoCaja === 'BLANCA').map(c => (
                      <button
                        key={c.id}
                        onClick={() => setCajaId(c.id)}
                        className={`px-3 py-2 rounded-xl border text-sm ${cajaId === c.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {nuevoEstado && <Button onClick={handleConfirm}>Confirmar {CHEQUE_ESTADO_STYLE[nuevoEstado].label.toLowerCase()}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
