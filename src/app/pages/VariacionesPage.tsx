import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { VariacionDialog } from '@/components/VariacionDialog'
import { type Variacion } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/format'

export default function VariacionesPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { ventas, variaciones, softDeleteVariacion } = usePorteData()
  const [obraFilter, setObraFilter] = useState('all')
  const [editing, setEditing] = useState<Variacion | 'nuevo' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Variacion | null>(null)

  const activas = variaciones
    .filter(v => v.activo)
    .filter(v => obraFilter === 'all' || v.idPres === obraFilter)

  return (
    <AppShell
      title="Variaciones"
      onBack={() => navigate(-1)}
      actions={
        <PermissionGuard permission="variaciones:write">
          <button onClick={() => setEditing('nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
          </button>
        </PermissionGuard>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setObraFilter('all')} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${obraFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>Todas las ventas</button>
          {ventas.map(v => (
            <button key={v.id} onClick={() => setObraFilter(v.id)} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${obraFilter === v.id ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>{v.id}</button>
          ))}
        </div>

        <EntityList
          items={activas}
          keyExtractor={v => v.idVar}
          emptyTitle="Sin variaciones"
          emptyAction={can('variaciones:write') ? { label: 'Nueva variación', onClick: () => setEditing('nuevo') } : undefined}
          renderItem={v => (
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm">{v.tipoVar} · {v.idPres}</p>
                <p className="text-xs text-muted-foreground">{formatDate(v.fecha)}</p>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{v.cliente}</p>
              <p className="text-sm">{v.descripcion}</p>
              <p className="text-xs mt-1">{v.valorAnterior} → {v.valorNuevo}</p>
              {v.impacto !== 0 && <p className="text-xs font-medium mt-1">Impacto: {formatCurrency(v.impacto)}</p>}
              <div className="flex items-center gap-4 border-t border-border mt-3 pt-2">
                <PermissionGuard permission="variaciones:write">
                  <button onClick={() => setEditing(v)} className="text-sm font-medium text-primary">Editar</button>
                </PermissionGuard>
                <PermissionGuard permission="variaciones:delete">
                  <button onClick={() => setPendingDelete(v)} className="text-sm font-medium text-destructive">Eliminar</button>
                </PermissionGuard>
              </div>
            </div>
          )}
        />
      </div>

      <VariacionDialog
        key={editing === null ? 'closed' : editing === 'nuevo' ? 'nuevo' : editing.idVar}
        open={editing !== null}
        onClose={() => setEditing(null)}
        editing={editing && editing !== 'nuevo' ? editing : undefined}
      />

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar variación"
        description={pendingDelete ? `Se dará de baja la variación de "${pendingDelete.idPres}". No se borra físicamente, queda inactiva.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteVariacion(pendingDelete.idVar)
          toast.success('Variación eliminada')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}
