import { useNavigate } from 'react-router'
import { Wallet, TrendingUp, Hammer, Clock } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { AdminMenu } from '@/components/AdminMenu'
import { MetricCard } from '@/components/MetricCard'
import { EntityCard } from '@/components/EntityCard'
import { EntityList } from '@/components/EntityList'
import { ESTADO_OPERATIVO_CONFIG, getTotalCobrado, getSaldoPendiente } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { formatCurrency } from '@/lib/format'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { ventas, ingresos, egresos } = usePorteData()

  const ventasActivas = ventas.filter(v => v.estadoOp !== 'Cerrado')
  const totalACobrar = ventasActivas.reduce((sum, v) => sum + getSaldoPendiente(v, ingresos), 0)
  const cobradoDelMes = ventas.reduce((sum, v) => sum + getTotalCobrado(v.id, ingresos), 0)
  const chequesPorVencer = egresos.filter(e => e.activo && e.estado === 'Emitido' && e.fechaAcreditacion).length

  return (
    <AppShell title="Inicio" actions={<div className="lg:hidden"><AdminMenu /></div>}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
