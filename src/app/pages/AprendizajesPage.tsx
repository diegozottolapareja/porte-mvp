import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { AprendizajeDialog } from '@/components/AprendizajeDialog'
import { CONFIG_LISTS, type Aprendizaje } from '@/modules/porte'
import { useAprendizajes, useAprendizajeActions } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatDate } from '@/lib/format'

export default function AprendizajesPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const aprendizajes = useAprendizajes()
  const { softDeleteAprendizaje } = useAprendizajeActions()
  const [categoriaFilter, setCategoriaFilter] = useState('all')
  const [editing, setEditing] = useState<Aprendizaje | 'nuevo' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Aprendizaje | null>(null)

  const activos = aprendizajes
    .filter(a => a.activo)
    .filter(a => categoriaFilter === 'all' || a.categoria === categoriaFilter)

  return (
    <AppShell
      title="Aprendizajes"
      onBack={() => navigate(-1)}
      actions={
        <PermissionGuard permission="aprendizajes:write">
          <button onClick={() => setEditing('nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
          </button>
        </PermissionGuard>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setCategoriaFilter('all')} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${categoriaFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>Todas</button>
          {CONFIG_LISTS.CATEGORIA.map(c => (
            <button key={c} onClick={() => setCategoriaFilter(c)} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${categoriaFilter === c ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>{c}</button>
          ))}
        </div>

        <EntityList
          items={activos}
          keyExtractor={a => a.idApr}
          emptyTitle="Sin aprendizajes"
          emptyAction={can('aprendizajes:write') ? { label: 'Nuevo aprendizaje', onClick: () => setEditing('nuevo') } : undefined}
          renderItem={a => (
            <div className="bg-white rounded-2xl border border-border p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{a.idPres} · {a.cliente}</p>
                <p className="text-xs text-muted-foreground">{formatDate(a.fechaCierre)}</p>
              </div>
              <p className="text-sm"><span className="font-medium">Bien:</span> {a.queSalioBien}</p>
              <p className="text-sm"><span className="font-medium">Mal:</span> {a.queSalioMal}</p>
              <p className="text-xs text-muted-foreground">Causa: {a.causaDesvio}</p>
              {a.aplicaAFuturas && <p className="text-xs text-primary font-medium">Aplica a futuras ventas</p>}
              <div className="flex items-center gap-4 border-t border-border mt-2 pt-2">
                <PermissionGuard permission="aprendizajes:write">
                  <button onClick={() => setEditing(a)} className="text-sm font-medium text-primary">Editar</button>
                </PermissionGuard>
                <PermissionGuard permission="aprendizajes:delete">
                  <button onClick={() => setPendingDelete(a)} className="text-sm font-medium text-destructive">Eliminar</button>
                </PermissionGuard>
              </div>
            </div>
          )}
        />
      </div>

      <AprendizajeDialog
        key={editing === null ? 'closed' : editing === 'nuevo' ? 'nuevo' : editing.idApr}
        open={editing !== null}
        onClose={() => setEditing(null)}
        editing={editing && editing !== 'nuevo' ? editing : undefined}
      />

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar aprendizaje"
        description={pendingDelete ? `Se dará de baja el aprendizaje de "${pendingDelete.idPres}". No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteAprendizaje(pendingDelete.idApr)
          toast.success('Aprendizaje eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}
