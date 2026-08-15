import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { CONFIG_LISTS, type Proveedor, type Cuenta, type TipoCaja } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '@/app/contexts/AuthContext'
import { todayLocal } from '@/lib/format'

export function ProveedorDialog({ value, onClose }: { value: Proveedor | 'nuevo' | null; onClose: () => void }) {
  const { user } = useAuth()
  const { addProveedor, updateProveedor } = usePorteData()
  const existing = value && value !== 'nuevo' ? value : undefined

  const [nombre, setNombre] = useState(existing?.nombre ?? '')
  const [rubro, setRubro] = useState(existing?.rubro ?? '')
  const [contacto, setContacto] = useState(existing?.contacto ?? '')
  const [telefono, setTelefono] = useState(existing?.telefono ?? '')
  const [plazoDias, setPlazoDias] = useState(existing?.plazoDias?.toString() ?? '')
  const [cuentaBanco, setCuentaBanco] = useState<Cuenta | ''>(existing?.cuentaBanco ?? '')
  const [tipoCaja, setTipoCaja] = useState<TipoCaja>(existing?.tipoCaja ?? 'BLANCA')
  const [observaciones, setObservaciones] = useState(existing?.observaciones ?? '')

  const open = value !== null

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose()
  }

  const handleSave = () => {
    if (!nombre || !user) {
      toast.error('Completá el nombre')
      return
    }
    const payload = {
      nombre, rubro, contacto, telefono,
      plazoDias: plazoDias === '' ? undefined : Number(plazoDias),
      cuentaBanco: cuentaBanco || undefined,
      tipoCaja,
      observaciones: observaciones || undefined,
    }
    if (existing) {
      updateProveedor(existing.idProv, payload)
      toast.success('Proveedor actualizado')
    } else {
      addProveedor({ ...payload, saldoCc: 0, fechaSaldoInicial: todayLocal() }, user.id)
      toast.success('Proveedor creado')
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? existing.nombre : 'Nuevo proveedor'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Rubro</label>
            <input value={rubro} onChange={e => setRubro(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Contacto</label>
              <input value={contacto} onChange={e => setContacto(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Teléfono</label>
              <input value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Plazo (días)</label>
              <input type="number" value={plazoDias} onChange={e => setPlazoDias(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Caja</label>
              <div className="flex gap-2">
                {CONFIG_LISTS.TIPO_CAJA.map(c => (
                  <button key={c} onClick={() => setTipoCaja(c)} className={`flex-1 py-2.5 rounded-xl border text-sm ${tipoCaja === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Cuenta banco</label>
            <div className="flex gap-2 flex-wrap">
              {CONFIG_LISTS.CUENTAS.map(c => (
                <button key={c} onClick={() => setCuentaBanco(c)} className={`px-3 py-2 rounded-xl border text-sm ${cuentaBanco === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-2xl border border-border text-sm" />
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
