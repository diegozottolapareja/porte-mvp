import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { MovimientosTabs } from '@/components/MovimientosTabs'
import { PillSelect } from '@/components/PillSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/format'
import type { EstadoIngreso, Ingreso } from '@/modules/porte'

const ESTADO_INGRESO_STYLE: Record<EstadoIngreso, { label: string; color: string; bgColor: string }> = {
  Confirmado: { label: 'Confirmado', color: 'text-green-700', bgColor: 'bg-green-100' },
  Pendiente: { label: 'Pendiente', color: 'text-amber-700', bgColor: 'bg-amber-100' },
}
const ESTADOS_INGRESO: EstadoIngreso[] = ['Confirmado', 'Pendiente']

export default function IngresosPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { ingresos, updateIngreso, softDeleteIngreso } = usePorteData()
  const [pendingDelete, setPendingDelete] = useState<Ingreso | null>(null)
  const activos = ingresos.filter(i => i.activo)
  const puedeEditar = can('ingresos:write')
  const puedeEliminar = can('ingresos:delete')

  const totalPeriodo = activos
    .filter(i => i.estado === 'Confirmado')
    .reduce((sum, i) => sum + i.monto, 0)

  return (
    <AppShell
      title="Ingresos"
      actions={
        <button onClick={() => navigate('/ingresos/nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
          <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
        </button>
      }
    >
      <div className="space-y-4">
        <MovimientosTabs active="ingresos" />

        <div className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total confirmado</p>
          <p className="text-xl font-semibold text-green-700">{formatCurrency(totalPeriodo)}</p>
        </div>

        <EntityList
          items={activos}
          keyExtractor={i => i.ref}
          emptyTitle="Sin ingresos"
          emptyDescription="Todavía no se registraron cobros."
          emptyAction={{ label: 'Nuevo ingreso', onClick: () => navigate('/ingresos/nuevo') }}
          renderItem={ingreso => (
            <EntityCard
              title={ingreso.concepto}
              subtitle={`${ingreso.id} · ${formatDate(ingreso.fecha)}`}
              onClick={() => navigate(`/ventas/${encodeURIComponent(ingreso.id)}`)}
              statusNode={
                puedeEditar ? (
                  <PillSelect
                    value={ingreso.estado}
                    options={ESTADOS_INGRESO}
                    style={v => ESTADO_INGRESO_STYLE[v]}
                    onChange={estado => updateIngreso(ingreso.ref, { estado })}
                  />
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_INGRESO_STYLE[ingreso.estado].color} ${ESTADO_INGRESO_STYLE[ingreso.estado].bgColor}`}>
                    {ESTADO_INGRESO_STYLE[ingreso.estado].label}
                  </span>
                )
              }
              fields={[
                { label: 'Monto', value: formatCurrency(ingreso.monto), highlight: true },
                { label: 'Cuenta', value: ingreso.cuenta },
              ]}
              actions={
                (puedeEditar || puedeEliminar) && (
                  <div className="flex items-center gap-4">
                    {puedeEditar && (
                      <button onClick={() => navigate(`/ingresos/nuevo?ref=${ingreso.ref}`)} className="text-sm font-medium text-primary">Editar</button>
                    )}
                    {puedeEliminar && (
                      <button onClick={() => setPendingDelete(ingreso)} className="text-sm font-medium text-destructive">Eliminar</button>
                    )}
                  </div>
                )
              }
            />
          )}
        />
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar ingreso"
        description={pendingDelete ? `Se dará de baja el ingreso de ${formatCurrency(pendingDelete.monto)} en ${pendingDelete.id}. No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteIngreso(pendingDelete.ref)
          toast.success('Ingreso eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}
