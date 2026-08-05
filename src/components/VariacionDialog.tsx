import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { SearchableSelect } from './SearchableSelect'
import { CONFIG_LISTS, type Variacion, type TipoVariacion } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '@/app/contexts/AuthContext'

interface VariacionDialogProps {
  open: boolean
  onClose: () => void
  editing?: Variacion
  /** Si viene desde la ficha de venta, la venta ya está fija y no se pide selector. */
  fixedObra?: { idPres: string; cliente: string }
}

export function VariacionDialog({ open, onClose, editing, fixedObra }: VariacionDialogProps) {
  const { user } = useAuth()
  const { ventas, addVariacion, updateVariacion } = usePorteData()

  const obraOptions = ventas.map(v => ({ value: v.id.replace(' ', ''), label: v.id, sublabel: v.cliente }))

  const [obraId, setObraId] = useState(editing?.idPres ?? fixedObra?.idPres ?? '')
  const [tipoVar, setTipoVar] = useState<TipoVariacion>(editing?.tipoVar ?? CONFIG_LISTS.TIPO_VARIACION[0])
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? '')
  const [valorAnterior, setValorAnterior] = useState(editing?.valorAnterior ?? '')
  const [valorNuevo, setValorNuevo] = useState(editing?.valorNuevo ?? '')
  const [impacto, setImpacto] = useState(editing?.impacto?.toString() ?? '0')
  const [canal, setCanal] = useState(editing?.canal ?? '')

  const handleOpenChange = (next: boolean) => { if (!next) onClose() }

  const handleSave = () => {
    if (!user) return
    const targetObraId = fixedObra?.idPres ?? obraId
    if (!targetObraId || !descripcion) {
      toast.error('Completá la venta y la descripción')
      return
    }
    const cliente = fixedObra?.cliente ?? ventas.find(v => v.id.replace(' ', '') === targetObraId)?.cliente ?? ''

    const payload = {
      idPres: targetObraId, cliente, tipoVar, descripcion, valorAnterior, valorNuevo,
      impacto: Number(impacto) || 0, canal, registradoPor: user.name,
      fecha: editing?.fecha ?? new Date().toISOString().slice(0, 10),
    }

    if (editing) {
      updateVariacion(editing.idVar, payload)
      toast.success('Variación actualizada')
    } else {
      addVariacion(payload, user.id)
      toast.success('Variación registrada')
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Editar variación' : 'Nueva variación'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {!fixedObra && (
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Venta</label>
              <SearchableSelect options={obraOptions} value={obraId} onChange={setObraId} placeholder="Buscar venta o cliente..." />
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Tipo</label>
            <div className="flex gap-2 flex-wrap">
              {CONFIG_LISTS.TIPO_VARIACION.map(t => (
                <button key={t} onClick={() => setTipoVar(t)} className={`px-3 py-2 rounded-xl border text-xs ${tipoVar === t ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Descripción</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-2xl border border-border text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Valor anterior</label>
              <input value={valorAnterior} onChange={e => setValorAnterior(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Valor nuevo</label>
              <input value={valorNuevo} onChange={e => setValorNuevo(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Impacto ($)</label>
              <input type="number" value={impacto} onChange={e => setImpacto(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Canal</label>
              <input value={canal} onChange={e => setCanal(e.target.value)} placeholder="WhatsApp, teléfono..." className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
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
