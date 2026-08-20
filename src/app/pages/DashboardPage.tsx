import { useNavigate } from 'react-router'
import { Wallet, TrendingUp, Hammer, Clock, Landmark } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { MetricCard } from '@/components/MetricCard'
import { EntityCard } from '@/components/EntityCard'
import { EntityList } from '@/components/EntityList'
import { ESTADO_OPERATIVO_CONFIG, getTotalCobrado, getSaldoPendiente } from '@/modules/porte'
import { useVentas, useIngresos, useCheques, useCajaActual } from '@/modules/porte/store'
import { formatCurrency, todayLocal, addDaysLocal } from '@/lib/format'

// Estados terminales de un cheque PAGO que ya no cuentan como "pendiente" —
// centralizado (data/cheques.ts) sería ideal, pero acá alcanza con la lista
// mínima que pide el KPI: debitado (ya salió), rechazado/anulado (nunca sale).
const CHEQUE_PAGO_TERMINALES = ['DEBITADO', 'RECHAZADO', 'ANULADO']

export default function DashboardPage() {
  const navigate = useNavigate()
  const ventas = useVentas()
  const ingresos = useIngresos()
  const cheques = useCheques()
  const { data: cajaActualRows } = useCajaActual(todayLocal())

  const ventasActivas = ventas.filter(v => v.estadoOp !== 'Cerrado')
  const totalACobrar = ventasActivas.reduce((sum, v) => sum + getSaldoPendiente(v, ingresos), 0)
  const cobradoDelMes = ventas.reduce((sum, v) => sum + getTotalCobrado(v.id, ingresos), 0)
  // KPI real: cheques emitidos (PAGO) todavía no terminales, con vencimiento
  // dentro de los próximos 7 días (hoy inclusive) — lee directo la tabla
  // `cheques`, nunca el campo cosmético `egreso.estado`. Un cheque no
  // terminal ya vencido no cuenta acá — "por vencer" es la ventana hacia
  // adelante, no el historial de vencidos.
  const hoy = todayLocal()
  const limite7Dias = addDaysLocal(hoy, 7)
  const chequesPorVencer = cheques.filter(c =>
    c.direccion === 'PAGO' && !CHEQUE_PAGO_TERMINALES.includes(c.estado) && c.fechaVencimiento >= hoy && c.fechaVencimiento <= limite7Dias,
  ).length
  const cajaActualTotal = (cajaActualRows ?? []).reduce((sum, c) => sum + c.saldoActual, 0)

  return (
    <AppShell title="Inicio">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard label="Caja actual" value={formatCurrency(cajaActualTotal)} Icon={Landmark} gradient="from-indigo-600 to-indigo-700" onClick={() => navigate('/finanzas')} />
          <MetricCard label="Ventas activas" value={ventasActivas.length} Icon={Hammer} />
          <MetricCard label="Total a cobrar" value={formatCurrency(totalACobrar)} Icon={Wallet} gradient="from-amber-500 to-amber-600" />
          <MetricCard label="Cobrado del mes" value={formatCurrency(cobradoDelMes)} Icon={TrendingUp} gradient="from-green-600 to-green-700" />
          <MetricCard label="Cheques por vencer" value={chequesPorVencer} Icon={Clock} gradient="from-surface-dark to-surface-dark-mid" />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ventas activas</h2>
          <EntityList
            items={ventasActivas}
            keyExtractor={v => v.id}
            emptyTitle="Sin ventas activas"
            emptyDescription="Todas las ventas están cerradas."
            renderItem={venta => {
              const estado = ESTADO_OPERATIVO_CONFIG[venta.estadoOp]
              const cobrado = getTotalCobrado(venta.id, ingresos)
              const pct = venta.ventaFinal > 0 ? Math.min(100, Math.round((cobrado / venta.ventaFinal) * 100)) : 0
              return (
                <EntityCard
                  title={venta.id}
                  subtitle={venta.cliente}
                  status={estado}
                  onClick={() => navigate(`/ventas/${encodeURIComponent(venta.id)}`)}
                  fields={[
                    { label: 'Venta final', value: formatCurrency(venta.ventaFinal) },
                    { label: 'Cobrado', value: `${formatCurrency(cobrado)} (${pct}%)`, highlight: true },
                  ]}
                />
              )
            }}
          />
        </div>
      </div>
    </AppShell>
  )
}
