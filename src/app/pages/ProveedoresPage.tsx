import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { CONFIG_LISTS, type Proveedor, type Cuenta, type TipoCaja } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '@/lib/format'

export default function ProveedoresPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { proveedores, softDeleteProveedor } = usePorteData()
  const [editing, setEditing] = useState<Proveedor | 'nuevo' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Proveedor | null>(null)

  const activos = proveedores.filter(p => p.activo)

  return (
    <AppShell
      title="Proveedores"
      onBack={() => navigate(-1)}
      actions={
        <PermissionGuard permission="proveedores:write">
          <button onClick={() => setEditing('nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
          </button>
        </PermissionGuard>
      }
    >
      <EntityList
        items={activos}
        keyExtractor={p => p.idProv}
        emptyTitle="Sin proveedores"
        emptyAction={can('proveedores:write') ? { label: 'Nuevo proveedor', onClick: () => setEditing('nuevo') } : undefined}
        renderItem={p => (
          <EntityCard
            title={p.nombre}
            subtitle={p.rubro}
            status={{ label: 'Activo', color: 'text-green-700', bgColor: 'bg-green-100' }}
            onClick={() => navigate(`/proveedores/${encodeURIComponent(p.idProv)}`)}
            fields={[
              { label: 'Saldo CC', value: formatCurrency(p.saldoCc), highlight: true },
              { label: 'Contacto', value: p.contacto },
            ]}
            actions={
              <div className="flex items-center gap-4">
                <PermissionGuard permission="proveedores:write">
                  <button onClick={e => { e.stopPropagation(); setEditing(p) }} className="text-sm font-medium text-primary">Editar</button>
                </PermissionGuard>
                <PermissionGuard permission="proveedores:delete">
                  <button onClick={e => { e.stopPropagation(); setPendingDelete(p) }} className="text-sm font-medium text-destructive">Eliminar</button>
                </PermissionGuard>
              </div>
            }
          />
        )}
      />

      <ProveedorDialog value={editing} onClose={() => setEditing(null)} />

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar proveedor"
        description={pendingDelete ? `Se dará de baja "${pendingDelete.nombre}". No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteProveedor(pendingDelete.idProv)
          toast.success('Proveedor eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}

function ProveedorDialog({ value, onClose }: { value: Proveedor | 'nuevo' | null; onClose: () => void }) {
  const { user } = useAuth()
  const { addProveedor, updateProveedor } = usePorteData()
  const existing = value && value !== 'nuevo' ? value : undefined

  const [nombre, setNombre] = useState('')
  const [rubro, setRubro] = useState('')
  const [contacto, setContacto] = useState('')
  const [telefono, setTelefono] = useState('')
  const [plazoDias, setPlazoDias] = useState('')
  const [cuentaBanco, setCuentaBanco] = useState<Cuenta | ''>('')
  const [tipoCaja, setTipoCaja] = useState<TipoCaja>('BLANCA')
  const [observaciones, setObservaciones] = useState('')

  const open = value !== null

  const resetIfNeeded = () => {
    if (existing) {
      setNombre(existing.nombre); setRubro(existing.rubro); setContacto(existing.contacto)
      setTelefono(existing.telefono); setPlazoDias(existing.plazoDias?.toString() ?? '')
      setCuentaBanco(existing.cuentaBanco ?? ''); setTipoCaja(existing.tipoCaja); setObservaciones(existing.observaciones ?? '')
    } else {
      setNombre(''); setRubro(''); setContacto(''); setTelefono(''); setPlazoDias(''); setCuentaBanco(''); setTipoCaja('BLANCA'); setObservaciones('')
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (next) resetIfNeeded()
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
      addProveedor({ ...payload, saldoCc: 0, fechaSaldoInicial: new Date().toISOString().slice(0, 10) }, user.id)
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
