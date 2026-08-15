import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ClienteDialog } from '@/components/ClienteDialog'
import type { Cliente } from '@/modules/porte'
import { useClientes, useClienteActions } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'

export default function ClientesPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const clientes = useClientes()
  const { softDeleteCliente } = useClienteActions()
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
            subtitle={c.emailPrincipal ?? c.telefonoPrincipal}
            status={{ label: 'Activo', color: 'text-green-700', bgColor: 'bg-green-100' }}
            onClick={() => navigate(`/clientes/${encodeURIComponent(c.idCli)}`)}
            fields={[
              { label: 'Email', value: c.emailPrincipal },
              { label: 'Teléfono', value: c.telefonoPrincipal },
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
