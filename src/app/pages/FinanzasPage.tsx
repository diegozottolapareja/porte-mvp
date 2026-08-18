import { useMemo, useState } from 'react'
import { Wallet, TrendingDown, AlertTriangle, Landmark } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { AppShell } from '@/components/AppShell'
import { MetricCard } from '@/components/MetricCard'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/app/components/ui/select'
import {
  useCajas, useCajaActual, useDisponibleFinanciero, useProyeccionCaja, useFlujoCaja, usePendienteAcreditacion,
  useCheques, useCompromisosPago, useGastosFijos, calcularDescalce,
} from '@/modules/porte/store'
import { formatCurrency, formatDate, todayLocal, addDaysLocal } from '@/lib/format'

// ─── Selector de período: sección 2 del pedido — recalcula todo el tab activo ──
type Periodo = 'hoy' | 'semana' | 'mes' | 'personalizado'

function rangoPeriodo(periodo: Periodo, desdeCustom: string, hastaCustom: string): { desde: string; hasta: string } {
  const hoy = todayLocal()
  if (periodo === 'hoy') return { desde: hoy, hasta: hoy }
  if (periodo === 'semana') return { desde: hoy, hasta: addDaysLocal(hoy, 7) }
  if (periodo === 'mes') return { desde: hoy, hasta: addDaysLocal(hoy, 30) }
  return { desde: desdeCustom || hoy, hasta: hastaCustom || hoy }
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function FinanzasPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [desdeCustom, setDesdeCustom] = useState(todayLocal())
  const [hastaCustom, setHastaCustom] = useState(addDaysLocal(todayLocal(), 30))
  const [cajaId, setCajaId] = useState<string | null>(null)

  const cajas = useCajas()
  const { desde, hasta } = rangoPeriodo(periodo, desdeCustom, hastaCustom)
  const hoy = todayLocal()

  const { data: cajaActualRows } = useCajaActual(hoy)
  const { data: disponible } = useDisponibleFinanciero(desde, hasta, cajaId)
  const { data: proyeccion } = useProyeccionCaja(desde, hasta, cajaId)
  const { data: pendiente } = usePendienteAcreditacion(hoy, cajaId)
  const { data: flujo } = useFlujoCaja(Number(desde.slice(0, 4)), cajaId)
  const cheques = useCheques()
  const compromisos = useCompromisosPago()
  const gastosFijos = useGastosFijos()

  const descalce = useMemo(() => calcularDescalce(proyeccion ?? []), [proyeccion])
  // El filtro de caja tiene que alcanzar a todo lo que se muestra en la
  // pantalla, no solo a las RPC que ya lo reciben como parámetro (disponible/
  // proyección/pendiente/flujo) — si no, "Caja disponible" seguía sumando
  // todas las cajas aunque el usuario hubiera elegido una sola.
  const cajaActualRowsFiltradas = cajaId ? (cajaActualRows ?? []).filter(c => c.cajaId === cajaId) : (cajaActualRows ?? [])
  const cajaActualTotal = cajaActualRowsFiltradas.reduce((sum, c) => sum + c.saldoActual, 0)

  const chequesFuturos = cheques.filter(c => (c.estado === 'EMITIDO' || c.estado === 'ENTREGADO') && (!cajaId || c.cajaId === cajaId))
  const compromisosPendientes = compromisos.filter(c => c.estado === 'PENDIENTE' && c.fechaVencimiento >= desde && c.fechaVencimiento <= hasta && (!cajaId || c.cajaId === cajaId))
  const gastosFijosProximos = gastosFijos.filter(g => g.activo && g.estado !== 'PAGADO' && g.fecha >= desde && g.fecha <= hasta && (!cajaId || g.cajaId === cajaId))

  return (
    <AppShell title="Finanzas">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={periodo} onValueChange={v => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="semana">Semana</SelectItem>
              <SelectItem value="mes">Mes</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {periodo === 'personalizado' && (
            <div className="flex gap-2">
              <input type="date" value={desdeCustom} onChange={e => setDesdeCustom(e.target.value)} className="h-10 px-3 rounded-xl border border-border bg-white text-sm" />
              <input type="date" value={hastaCustom} onChange={e => setHastaCustom(e.target.value)} className="h-10 px-3 rounded-xl border border-border bg-white text-sm" />
            </div>
          )}

          <Select value={cajaId ?? 'todas'} onValueChange={v => setCajaId(v === 'todas' ? null : v)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las cajas</SelectItem>
              {cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="caja">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="caja">Caja</TabsTrigger>
            <TabsTrigger value="proyeccion">Proyección</TabsTrigger>
            <TabsTrigger value="flujo">Flujo mensual</TabsTrigger>
          </TabsList>

          {/* ─── Tab Caja: sección 19 del pedido ─────────────────────────── */}
          <TabsContent value="caja" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Caja disponible" value={formatCurrency(cajaActualTotal)} Icon={Wallet} />
              <MetricCard label="Por acreditar" value={formatCurrency(pendiente ?? 0)} Icon={TrendingDown} gradient="from-blue-600 to-blue-700" />
              <MetricCard label="Compromisos del período" value={formatCurrency(disponible?.compromisosPeriodo ?? 0)} Icon={AlertTriangle} gradient="from-amber-500 to-amber-600" />
              <MetricCard label="Disponible estimado" value={formatCurrency(disponible?.disponibleEstimado ?? 0)} Icon={Landmark} gradient="from-green-600 to-green-700" />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Saldo por caja</h2>
              <EntityList
                items={cajaActualRowsFiltradas}
                keyExtractor={c => c.cajaId}
                emptyTitle="Sin cajas configuradas"
                renderItem={c => (
                  <EntityCard
                    title={c.cajaNombre}
                    fields={[
                      { label: 'Saldo inicial', value: formatCurrency(c.saldoInicial) },
                      { label: 'Ingresos acreditados', value: formatCurrency(c.ingresosAcreditados), tone: 'positive' },
                      { label: 'Pagos debitados', value: formatCurrency(c.pagosDebitados), tone: 'negative' },
                      { label: 'Saldo actual', value: formatCurrency(c.saldoActual), highlight: true },
                    ]}
                  />
                )}
              />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Deuda diferida</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white rounded-2xl border border-border p-3">
                  <p className="text-xl font-bold text-dark-graphite">{chequesFuturos.length}</p>
                  <p className="text-xs text-muted-foreground">Cheques</p>
                </div>
                <div className="bg-white rounded-2xl border border-border p-3">
                  <p className="text-xl font-bold text-dark-graphite">{compromisosPendientes.length}</p>
                  <p className="text-xs text-muted-foreground">Compromisos del período</p>
                </div>
                <div className="bg-white rounded-2xl border border-border p-3">
                  <p className="text-xl font-bold text-dark-graphite">{gastosFijosProximos.length}</p>
                  <p className="text-xs text-muted-foreground">Gastos fijos próximos</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab Proyección: sección 20 del pedido ───────────────────── */}
          <TabsContent value="proyeccion" className="space-y-4 mt-4">
            <div className="bg-white rounded-2xl border border-border p-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={proyeccion ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tickFormatter={f => formatDate(f, 'dd/MM')} fontSize={11} />
                  <YAxis tickFormatter={v => formatCurrency(v)} width={90} fontSize={11} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={f => formatDate(String(f))} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="saldoFinal" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {descalce.primeraFechaNegativa ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="font-semibold text-red-800">Descalce proyectado: {formatDate(descalce.primeraFechaNegativa)}</p>
                <p className="text-sm text-red-700 mt-1">
                  Saldo mínimo: {formatCurrency(descalce.saldoMinimo)} — cobertura necesaria: {formatCurrency(descalce.montoNecesarioCobertura)}
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <p className="text-sm text-green-800">Sin descalce proyectado en el período seleccionado.</p>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Compromisos próximos</h2>
              <EntityList
                items={compromisosPendientes}
                keyExtractor={c => c.id}
                emptyTitle="Sin compromisos"
                emptyDescription="No hay pagos comprometidos en este período."
                renderItem={c => (
                  <EntityCard
                    title={formatCurrency(c.monto)}
                    subtitle={`Vence ${formatDate(c.fechaVencimiento)}`}
                    fields={[{ label: 'Estado', value: c.estado }]}
                  />
                )}
              />
            </div>
          </TabsContent>

          {/* ─── Tab Flujo mensual: sección 21 del pedido — plata real, no ventas/costos ── */}
          <TabsContent value="flujo" className="space-y-4 mt-4">
            <div className="bg-white rounded-2xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="p-3">Mes</th>
                    <th className="p-3">Entradas</th>
                    <th className="p-3">Salidas</th>
                    <th className="p-3">Flujo neto</th>
                    <th className="p-3">Saldo final</th>
                  </tr>
                </thead>
                <tbody>
                  {(flujo ?? []).map(m => (
                    <tr key={m.mes} className="border-b border-border last:border-0">
                      <td className="p-3">{MESES[m.mes - 1]}</td>
                      <td className="p-3 text-green-700">{formatCurrency(m.entradas)}</td>
                      <td className="p-3 text-red-700">{formatCurrency(m.salidas)}</td>
                      <td className={`p-3 ${m.flujoNeto >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(m.flujoNeto)}</td>
                      <td className="p-3 font-semibold">{formatCurrency(m.saldoFinal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
