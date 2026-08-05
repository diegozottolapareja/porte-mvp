import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { gastoFijoKey, usePorteData } from '@/modules/porte/store'
import { formatCurrency, formatDate } from '@/lib/format'

type Tab = 'todos' | 'ingresos' | 'egresos' | 'presupuestos' | 'proveedores' | 'gastosfijos' | 'variaciones' | 'aprendizajes'

interface Row {
  key: string
  tipo: string
  concepto: string
  obra?: string
  fecha: string
  monto?: number
  estado: string
  createdBy: string
  editPath: string
  onDelete: () => void
}

const USER_LABELS: Record<string, string> = {
  'demo-admin': 'Gonza (admin)',
  'demo-dataentry': 'Carga de datos',
}

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'egresos', label: 'Egresos' },
  { value: 'presupuestos', label: 'Presup.' },
  { value: 'proveedores', label: 'Proveed.' },
  { value: 'gastosfijos', label: 'Gastos fijos' },
  { value: 'variaciones', label: 'Variac.' },
  { value: 'aprendizajes', label: 'Aprend.' },
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function MisRegistrosPage() {
  const navigate = useNavigate()
  const {
    ingresos, egresos, presupuestos, proveedores, gastosFijos, variaciones, aprendizajes,
    softDeleteIngreso, softDeleteEgreso, softDeletePresupuesto,
    softDeleteProveedor, softDeleteGastoFijo, softDeleteVariacion, softDeleteAprendizaje,
  } = usePorteData()

  const [tab, setTab] = useState<Tab>('todos')
  const [query, setQuery] = useState('')
  const [desde, setDesde] = useState(daysAgo(7))
  const [hasta, setHasta] = useState(daysAgo(0))
  const [userFilter, setUserFilter] = useState<string>('all')
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null)

  const rows: Row[] = [
    ...ingresos.filter(i => i.activo).map(i => ({
      key: `in-${i.ref}`, tipo: 'Ingreso', concepto: i.concepto, obra: i.id, fecha: i.fecha, monto: i.monto, estado: i.estado, createdBy: i.createdBy,
      editPath: `/ingresos/nuevo?ref=${i.ref}`, onDelete: () => softDeleteIngreso(i.ref),
    })),
    ...egresos.filter(e => e.activo).map(e => ({
      key: `eg-${e.ref}`, tipo: 'Egreso', concepto: e.tipoEgreso, obra: e.id, fecha: e.fecha, monto: e.monto, estado: e.estado, createdBy: e.createdBy,
      editPath: `/egresos/nuevo?ref=${e.ref}`, onDelete: () => softDeleteEgreso(e.ref),
    })),
    ...presupuestos.filter(p => p.activo).map(p => ({
      key: `pr-${p.id}`, tipo: 'Presupuesto', concepto: p.descripcion || p.cliente, obra: p.id, fecha: p.fecha, monto: p.montoTotal, estado: p.estadoComercial, createdBy: p.createdBy,
      editPath: `/presupuestos/${encodeURIComponent(p.id)}`, onDelete: () => softDeletePresupuesto(p.id),
    })),
    ...proveedores.filter(p => p.activo).map(p => ({
      key: `prov-${p.idProv}`, tipo: 'Proveedor', concepto: p.nombre, obra: p.idProv, fecha: p.fechaSaldoInicial, monto: p.saldoCc, estado: p.rubro, createdBy: p.createdBy,
      editPath: `/proveedores/${encodeURIComponent(p.idProv)}`, onDelete: () => softDeleteProveedor(p.idProv),
    })),
    ...gastosFijos.filter(g => g.activo).map(g => ({
      key: `gf-${gastoFijoKey(g)}`, tipo: 'Gasto fijo', concepto: g.concepto, obra: undefined, fecha: g.fecha, monto: g.montoPrevisto, estado: g.estado, createdBy: g.createdBy,
      editPath: '/gastos-fijos', onDelete: () => softDeleteGastoFijo(gastoFijoKey(g)),
    })),
    ...variaciones.filter(v => v.activo).map(v => ({
      key: `var-${v.idVar}`, tipo: 'Variación', concepto: v.descripcion, obra: v.idPres, fecha: v.fecha, monto: v.impacto, estado: v.tipoVar, createdBy: v.createdBy,
      editPath: '/variaciones', onDelete: () => softDeleteVariacion(v.idVar),
    })),
    ...aprendizajes.filter(a => a.activo).map(a => ({
      key: `apr-${a.idApr}`, tipo: 'Aprendizaje', concepto: a.queSalioBien, obra: a.idPres, fecha: a.fechaCierre, monto: undefined, estado: a.causaDesvio, createdBy: a.createdBy,
      editPath: '/aprendizajes', onDelete: () => softDeleteAprendizaje(a.idApr),
    })),
  ]
    .filter(r => tab === 'todos'
      || (tab === 'ingresos' && r.tipo === 'Ingreso')
      || (tab === 'egresos' && r.tipo === 'Egreso')
      || (tab === 'presupuestos' && r.tipo === 'Presupuesto')
      || (tab === 'proveedores' && r.tipo === 'Proveedor')
      || (tab === 'gastosfijos' && r.tipo === 'Gasto fijo')
      || (tab === 'variaciones' && r.tipo === 'Variación')
      || (tab === 'aprendizajes' && r.tipo === 'Aprendizaje'))
    .filter(r => !desde || r.fecha >= desde)
    .filter(r => !hasta || r.fecha <= hasta)
    .filter(r => userFilter === 'all' || r.createdBy === userFilter)
    .filter(r => {
      const q = query.toLowerCase()
      return !q || (r.obra ?? '').toLowerCase().includes(q) || r.concepto.toLowerCase().includes(q)
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  const totalFiltro = rows.reduce((sum, r) => sum + (r.monto ?? 0), 0)

  const grupos = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.fecha] ??= []).push(r)
    return acc
  }, {})

  return (
    <AppShell title="Registros">
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
          <TabsList className="w-full flex overflow-x-auto no-scrollbar justify-start">
            {TABS.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="shrink-0">{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por obra o cliente..."
            className="w-full pl-9 pr-4 py-3 rounded-2xl border border-border bg-white text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-white text-sm" />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setUserFilter('all')} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${userFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>Todos los usuarios</button>
          {Object.entries(USER_LABELS).map(([id, label]) => (
            <button key={id} onClick={() => setUserFilter(id)} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${userFilter === id ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>{label}</button>
          ))}
        </div>

        <div className="bg-primary/5 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total del filtro ({rows.length} registro{rows.length !== 1 ? 's' : ''})</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(totalFiltro)}</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            Icon={Search}
            title="Sin registros"
            description="No hay registros que coincidan con el filtro."
            action={{ label: 'Cargar un registro', onClick: () => navigate('/carga') }}
          />
        ) : (
          <div className="space-y-5">
            {Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0])).map(([fecha, items]) => (
              <div key={fecha}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{formatDate(fecha)}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{formatCurrency(items.reduce((s, r) => s + (r.monto ?? 0), 0))}</p>
                </div>
                <div className="space-y-2">
                  {items.map(r => (
                    <div key={r.key} className="bg-white rounded-2xl border border-border p-3 flex items-center gap-3">
                      <button onClick={() => navigate(r.editPath)} className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{r.obra ?? 'Gasto fijo'} · {r.tipo}</p>
                          {r.monto !== undefined && <p className="text-sm font-semibold shrink-0">{formatCurrency(r.monto)}</p>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{r.concepto} · {r.estado}{userFilter === 'all' ? ` · ${USER_LABELS[r.createdBy] ?? r.createdBy}` : ''}</p>
                      </button>
                      <button onClick={() => setPendingDelete(r)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar registro"
        description={pendingDelete ? `Se dará de baja "${pendingDelete.concepto}" (${pendingDelete.obra ?? 'gasto fijo'}). No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          pendingDelete?.onDelete()
          toast.success('Registro eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}
