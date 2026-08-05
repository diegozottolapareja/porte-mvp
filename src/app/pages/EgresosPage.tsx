import { useNavigate } from 'react-router'
import { Plus, Clock3 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { AdminMenu } from '@/components/AdminMenu'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { MovimientosTabs } from '@/components/MovimientosTabs'
import { usePorteData } from '@/modules/porte/store'
import { formatCurrency, formatDate } from '@/lib/format'

const ESTADO_STYLE = {
  Confirmado: { label: 'Confirmado', color: 'text-green-700', bgColor: 'bg-green-100' },
  Pendiente: { label: 'Pendiente', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  Emitido: { label: 'Cheque emitido', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
}

export default function EgresosPage() {
  const navigate = useNavigate()
  const { egresos } = usePorteData()
  const activos = egresos.filter(e => e.activo)

  const chequesFuturos = activos.filter(e => e.estado === 'Emitido' && e.fechaAcreditacion)

  return (
    <AppShell
      title="Egresos"
      onBack={() => navigate(-1)}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/egresos/nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
          </button>
          <div className="lg:hidden"><AdminMenu /></div>
        </div>
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
              status={ESTADO_STYLE[egreso.estado]}
              fields={[
                { label: 'Monto', value: formatCurrency(egreso.monto), highlight: true },
                { label: 'Cuenta', value: egreso.cuenta },
                ...(egreso.fechaAcreditacion ? [{ label: 'Acreditación', value: formatDate(egreso.fechaAcreditacion) }] : []),
              ]}
            />
          )}
        />
      </div>
    </AppShell>
  )
}
