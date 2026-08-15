import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ProveedorDialog } from '@/components/ProveedorDialog'
import type { Proveedor } from '@/modules/porte'
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

      <ProveedorDialog
        key={editing === null ? 'closed' : editing === 'nuevo' ? 'nuevo' : editing.idProv}
        value={editing}
        onClose={() => setEditing(null)}
      />

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
