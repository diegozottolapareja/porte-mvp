import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { CONFIG_LISTS, type Venta, type CondicionPago, type TipoCaja } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '@/app/contexts/AuthContext'
import { isNegativeAmount, toPositiveAmount } from '@/lib/validation'

interface VentaDialogProps {
  open: boolean
  onClose: () => void
  editing?: Venta
}

// Alta manual de una venta — no todas nacen de un presupuesto aceptado.
export function VentaDialog({ open, onClose, editing }: VentaDialogProps) {
  const { user } = useAuth()
  const { addVenta, updateVenta, nextPresupuestoId } = usePorteData()

  const [cliente, setCliente] = useState(editing?.cliente ?? '')
  const [ventaFinal, setVentaFinal] = useState(editing?.ventaFinal?.toString() ?? '')
  const [mater, setMater] = useState(editing?.mater?.toString() ?? '0')
  const [mo, setMo] = useState(editing?.mo?.toString() ?? '0')
  const [indVend, setIndVend] = useState(editing?.indVend?.toString() ?? '0')
  const [imp, setImp] = useState(editing?.imp?.toString() ?? '0')
  const [comerc, setComerc] = useState(editing?.comerc?.toString() ?? '0')
  const [benef, setBenef] = useState(editing?.benef?.toString() ?? '0')
  const [condPago, setCondPago] = useState<CondicionPago | ''>(editing?.condPago ?? '')
  const [dias, setDias] = useState(editing?.dias?.toString() ?? '')
  const [cajaIntenc, setCajaIntenc] = useState<TipoCaja>(editing?.cajaIntenc ?? 'BLANCA')
  const [entregaCompr, setEntregaCompr] = useState(editing?.entregaCompr ?? '')

  const handleOpenChange = (next: boolean) => { if (!next) onClose() }

  const handleSave = () => {
    if (!user || !cliente || !ventaFinal) {
      toast.error('Completá cliente y venta final')
      return
    }
    const ventaFinalNum = toPositiveAmount(ventaFinal)
    if (!ventaFinalNum) {
      toast.error('La venta final debe ser mayor a cero')
      return
    }
    const costos: Array<[string, string]> = [
      ['Materiales', mater], ['Mano de obra', mo], ['Indirectos', indVend],
      ['Impuestos', imp], ['Comercial', comerc], ['Beneficio', benef],
    ]
    const costoNegativo = costos.find(([, v]) => isNegativeAmount(v))
    if (costoNegativo) {
      toast.error(`${costoNegativo[0]} no puede ser negativo`)
      return
    }
    const montoTotal = Number(mater) + Number(mo) + Number(indVend) + Number(imp) + Number(comerc) + Number(benef)
    const payload = {
      cliente,
      montoTotal,
      mater: Number(mater), mo: Number(mo), indVend: Number(indVend), imp: Number(imp), comerc: Number(comerc), benef: Number(benef),
      ventaFinal: ventaFinalNum,
      condPago: condPago || undefined,
      dias: dias === '' ? undefined : Number(dias),
      cajaIntenc,
      entregaCompr: entregaCompr || undefined,
      fechaCierre: editing?.fechaCierre ?? new Date().toISOString(),
      estadoOp: editing?.estadoOp ?? 'Pendiente' as const,
      respOp: editing?.respOp ?? user.name,
    }

    if (editing) {
      updateVenta(editing.id, payload)
      toast.success('Venta actualizada')
    } else {
      const nuevoId = nextPresupuestoId()
      addVenta({ id: nuevoId, ...payload }, user.id)
      toast.success(`Venta ${nuevoId} creada`)
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? editing.id : 'Nueva venta'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Cliente *</label>
            <input value={cliente} onChange={e => setCliente(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Venta final *</label>
            <input type="number" min="0.01" step="0.01" value={ventaFinal} onChange={e => setVentaFinal(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Materiales</label>
              <input type="number" min="0" value={mater} onChange={e => setMater(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mano de obra</label>
              <input type="number" min="0" value={mo} onChange={e => setMo(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Indirectos</label>
              <input type="number" min="0" value={indVend} onChange={e => setIndVend(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Impuestos</label>
              <input type="number" min="0" value={imp} onChange={e => setImp(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Comercial</label>
              <input type="number" min="0" value={comerc} onChange={e => setComerc(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Beneficio</label>
              <input type="number" min="0" value={benef} onChange={e => setBenef(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Condición de pago</label>
            <div className="flex gap-2 flex-wrap">
              {CONFIG_LISTS.CONDICION_PAGO.map(c => (
                <button key={c} onClick={() => setCondPago(c)} className={`px-3 py-2 rounded-xl border text-sm ${condPago === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Días</label>
              <input type="number" value={dias} onChange={e => setDias(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Caja intención</label>
              <div className="flex gap-2">
                {CONFIG_LISTS.TIPO_CAJA.map(c => (
                  <button key={c} onClick={() => setCajaIntenc(c)} className={`flex-1 py-2.5 rounded-xl border text-sm ${cajaIntenc === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Entrega comprometida</label>
            <input type="date" value={entregaCompr} onChange={e => setEntregaCompr(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
