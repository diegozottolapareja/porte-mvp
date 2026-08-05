import { useNavigate } from 'react-router'
import { ArrowDownCircle, ArrowUpCircle, FileText, Inbox, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { motion } from 'motion/react'
import { AppShell } from '@/components/AppShell'
import { AdminMenu } from '@/components/AdminMenu'
import { MetricCard } from '@/components/MetricCard'
import { EmptyState } from '@/components/EmptyState'
import { usePorteData } from '@/modules/porte/store'
import { formatCurrency } from '@/lib/format'

interface FeedItem {
  key: string
  tipo: 'ingreso' | 'egreso' | 'presupuesto'
  obra?: string
  cliente?: string
  monto?: number
  estado: string
  createdAt: string
  editPath: string
}

interface ActionDef {
  icon: typeof ArrowDownCircle
  title: string
  description: string
  path: string
  iconBg: string
  iconColor: string
}

const ACTIONS: ActionDef[] = [
  { icon: ArrowDownCircle, title: 'Nuevo ingreso',     description: 'Registrar un cobro de cliente',                  path: '/ingresos/nuevo',    iconBg: 'bg-green-100', iconColor: 'text-green-700' },
  { icon: ArrowUpCircle,   title: 'Nuevo egreso',       description: 'Registrar un pago a proveedor o gasto de obra', path: '/egresos/nuevo',      iconBg: 'bg-red-100',   iconColor: 'text-red-700'   },
  { icon: FileText,        title: 'Nuevo presupuesto',  description: 'Cotizar un trabajo nuevo',                        path: '/presupuestos/nuevo', iconBg: 'bg-blue-100',  iconColor: 'text-blue-700'  },
]

export default function CargaRapidaPage() {
  const navigate = useNavigate()
  const { ingresos, egresos, presupuestos } = usePorteData()
  const hoy = new Date().toISOString().slice(0, 10)

  // Mismos datos que ve admin — sin filtrar por usuario, así "carga" tiene el panorama completo.
  const ingresosHoy = ingresos.filter(i => i.activo && i.createdAt.slice(0, 10) === hoy)
  const egresosHoy = egresos.filter(e => e.activo && e.createdAt.slice(0, 10) === hoy)
  const registrosHoy = ingresosHoy.length + egresosHoy.length
  const totalIngresadoHoy = ingresosHoy.reduce((sum, i) => sum + i.monto, 0)
  const totalEgresadoHoy = egresosHoy.reduce((sum, e) => sum + e.monto, 0)

  const feed: FeedItem[] = [
    ...ingresos.filter(i => i.activo).map(i => ({
      key: `in-${i.ref}`, tipo: 'ingreso' as const, obra: i.id, monto: i.monto, estado: i.estado, createdAt: i.createdAt, editPath: `/ingresos/nuevo?ref=${i.ref}`,
    })),
    ...egresos.filter(e => e.activo).map(e => ({
      key: `eg-${e.ref}`, tipo: 'egreso' as const, obra: e.id, monto: e.monto, estado: e.estado, createdAt: e.createdAt, editPath: `/egresos/nuevo?ref=${e.ref}`,
    })),
    ...presupuestos.filter(p => p.activo).map(p => ({
      key: `pr-${p.id}`, tipo: 'presupuesto' as const, obra: p.id, cliente: p.cliente, monto: p.montoTotal, estado: p.estadoComercial, createdAt: p.createdAt, editPath: `/presupuestos/${encodeURIComponent(p.id)}`,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)

  return (
    <AppShell title="Cargar" actions={<div className="lg:hidden"><AdminMenu /></div>}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Registros hoy" value={registrosHoy} />
          <MetricCard label="Ingresado hoy" value={formatCurrency(totalIngresadoHoy)} gradient="from-green-600 to-green-700" />
          <MetricCard label="Egresado hoy" value={formatCurrency(totalEgresadoHoy)} gradient="from-red-600 to-red-700" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {ACTIONS.map((action, i) => (
            <motion.button
              key={action.path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.path)}
              className="w-full flex items-center gap-4 bg-white rounded-2xl border border-border p-4 text-left shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${action.iconBg}`}>
                <action.icon className={`w-6 h-6 ${action.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dark-graphite">{action.title}</p>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </motion.button>
          ))}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Últimos movimientos</h2>
          {feed.length === 0 ? (
            <EmptyState Icon={Inbox} title="Sin movimientos" description="Todavía no se cargó nada — usá las acciones de arriba." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {feed.map(item => (
                <button
                  key={item.key}
                  onClick={() => navigate(item.editPath)}
                  className="w-full flex items-center gap-3 bg-white rounded-2xl border border-border p-3 text-left hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.tipo === 'ingreso' ? 'bg-green-100' : item.tipo === 'egreso' ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    {item.tipo === 'ingreso' && <ArrowDownCircle className="w-5 h-5 text-green-700" />}
                    {item.tipo === 'egreso' && <ArrowUpCircle className="w-5 h-5 text-red-700" />}
                    {item.tipo === 'presupuesto' && <FileText className="w-5 h-5 text-blue-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.obra ?? 'Gasto fijo'}{item.cliente ? ` · ${item.cliente}` : ''}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })} · {item.estado}</p>
                  </div>
                  {item.monto !== undefined && <p className="text-sm font-semibold shrink-0">{formatCurrency(item.monto)}</p>}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/mis-registros')} className="w-full text-center text-sm text-primary font-medium mt-3 py-2">
            Ver todos los registros
          </button>
        </div>
      </div>
    </AppShell>
  )
}
