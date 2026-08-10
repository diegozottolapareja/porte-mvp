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
import type { Cliente } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'

export default function ClientesPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { clientes, softDeleteCliente } = usePorteData()
  const [editing, setEditing] = useState<Cliente | 'nuevo' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Cliente | null>(null)

  const activos = clientes.filter(c => c.activo)

  return (
    <AppShell
      title="Clientes"
      onBack={() => navigate(-1)}
      actions={
        <PermissionGuard permission="clientes:write">
          <button onClick={() => setEditing('nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
          </button>
        </PermissionGuard>
      }
    >
      <EntityList
        items={activos}
        keyExtractor={c => c.idCli}
        emptyTitle="Sin clientes"
        emptyAction={can('clientes:write') ? { label: 'Nuevo cliente', onClick: () => setEditing('nuevo') } : undefined}
        renderItem={c => (
          <EntityCard
            title={c.nombre}
            subtitle={c.contacto}
            status={{ label: 'Activo', color: 'text-green-700', bgColor: 'bg-green-100' }}
            onClick={() => navigate(`/clientes/${encodeURIComponent(c.idCli)}`)}
            fields={[
              { label: 'Teléfono', value: c.telefono },
              { label: 'Dirección', value: c.direccion },
            ]}
            actions={
              <div className="flex items-center gap-4">
                <PermissionGuard permission="clientes:write">
                  <button onClick={e => { e.stopPropagation(); setEditing(c) }} className="text-sm font-medium text-primary">Editar</button>
                </PermissionGuard>
                <PermissionGuard permission="clientes:delete">
                  <button onClick={e => { e.stopPropagation(); setPendingDelete(c) }} className="text-sm font-medium text-destructive">Eliminar</button>
                </PermissionGuard>
              </div>
            }
          />
        )}
      />

      <ClienteDialog
        key={editing === null ? 'closed' : editing === 'nuevo' ? 'nuevo' : editing.idCli}
        value={editing}
        onClose={() => setEditing(null)}
      />

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar cliente"
        description={pendingDelete ? `Se dará de baja "${pendingDelete.nombre}". No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteCliente(pendingDelete.idCli)
          toast.success('Cliente eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}

function ClienteDialog({ value, onClose }: { value: Cliente | 'nuevo' | null; onClose: () => void }) {
  const { user } = useAuth()
  const { addCliente, updateCliente } = usePorteData()
  const existing = value && value !== 'nuevo' ? value : undefined

  const [nombre, setNombre] = useState(existing?.nombre ?? '')
  const [contacto, setContacto] = useState(existing?.contacto ?? '')
  const [telefono, setTelefono] = useState(existing?.telefono ?? '')
  const [direccion, setDireccion] = useState(existing?.direccion ?? '')
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
      nombre, contacto, telefono,
      direccion: direccion || undefined,
      observaciones: observaciones || undefined,
    }
    if (existing) {
      updateCliente(existing.idCli, payload)
      toast.success('Cliente actualizado')
    } else {
      addCliente(payload, user.id)
      toast.success('Cliente creado')
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? existing.nombre : 'Nuevo cliente'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
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
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Dirección</label>
            <input value={direccion} onChange={e => setDireccion(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
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
