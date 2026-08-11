import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Clock3 } from 'lucide-react'
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
import type { EstadoEgreso, Egreso } from '@/modules/porte'

const ESTADO_STYLE: Record<EstadoEgreso, { label: string; color: string; bgColor: string }> = {
  Confirmado: { label: 'Confirmado', color: 'text-green-700', bgColor: 'bg-green-100' },
  Pendiente: { label: 'Pendiente', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  Emitido: { label: 'Cheque emitido', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
}
const ESTADOS_EGRESO: EstadoEgreso[] = ['Confirmado', 'Pendiente', 'Emitido']

export default function EgresosPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { egresos, ventas, updateEgreso, softDeleteEgreso } = usePorteData()
  const [pendingDelete, setPendingDelete] = useState<Egreso | null>(null)
  const activos = egresos.filter(e => e.activo)
  const puedeEditar = can('egresos:write')
  const puedeEliminar = can('egresos:delete')

  const chequesFuturos = activos.filter(e => e.estado === 'Emitido' && e.fechaAcreditacion)

  return (
    <AppShell
      title="Egresos"
      onBack={() => navigate(-1)}
      actions={
        <button onClick={() => navigate('/egresos/nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
          <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
        </button>
      }
    >
      <div className="space-y-4">
        <MovimientosTabs active="egresos" />

        {chequesFuturos.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
            <Clock3 className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-indigo-900">{chequesFuturos.length} cheque(s) con acreditación pendiente</p>
              <p className="text-xs text-indigo-700">Revisá las fechas de acreditación abajo.</p>
            </div>
          </div>
        )}

        <EntityList
          items={activos}
          keyExtractor={e => e.ref}
          emptyTitle="Sin egresos"
          emptyDescription="Todavía no se registraron pagos."
          emptyAction={{ label: 'Nuevo egreso', onClick: () => navigate('/egresos/nuevo') }}
          renderItem={egreso => (
            <EntityCard
              title={egreso.tipoEgreso}
              subtitle={`${egreso.id ?? 'Gasto fijo'} · ${formatDate(egreso.fecha)}`}
              onClick={egreso.id ? () => navigate(`/ventas/${encodeURIComponent(egreso.id!)}`) : undefined}
              statusNode={
                puedeEditar ? (
                  <PillSelect
                    value={egreso.estado}
                    options={ESTADOS_EGRESO}
                    style={v => ESTADO_STYLE[v]}
                    onChange={estado => updateEgreso(egreso.ref, { estado })}
                  />
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_STYLE[egreso.estado].color} ${ESTADO_STYLE[egreso.estado].bgColor}`}>
                    {ESTADO_STYLE[egreso.estado].label}
                  </span>
                )
              }
              fields={[
                { label: 'Monto', value: formatCurrency(egreso.monto), highlight: true },
                { label: 'Cliente', value: egreso.id ? (ventas.find(v => v.id === egreso.id)?.cliente ?? '—') : 'Gasto fijo' },
                { label: 'Cuenta', value: egreso.cuenta },
                ...(egreso.fechaAcreditacion ? [{ label: 'Acreditación', value: formatDate(egreso.fechaAcreditacion) }] : []),
              ]}
              actions={
                (puedeEditar || puedeEliminar) && (
                  <div className="flex items-center gap-4">
                    {puedeEditar && (
                      <button onClick={() => navigate(`/egresos/nuevo?ref=${egreso.ref}`)} className="text-sm font-medium text-primary">Editar</button>
                    )}
                    {puedeEliminar && (
                      <button onClick={() => setPendingDelete(egreso)} className="text-sm font-medium text-destructive">Eliminar</button>
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
        title="Eliminar egreso"
        description={pendingDelete ? `Se dará de baja el egreso de ${formatCurrency(pendingDelete.monto)}${pendingDelete.id ? ` en ${pendingDelete.id}` : ''}. No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteEgreso(pendingDelete.ref)
          toast.success('Egreso eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}
