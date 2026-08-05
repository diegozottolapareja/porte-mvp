import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { AdminMenu } from '@/components/AdminMenu'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { PermissionGuard } from '../components/PermissionGuard'
import { ESTADO_COMERCIAL_CONFIG, CONFIG_LISTS, type Presupuesto } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/format'

export default function PresupuestosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { presupuestos: allPresupuestos, aceptarPresupuesto } = usePorteData()
  const [query, setQuery] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('all')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all')

  const handleAceptar = (p: Presupuesto) => {
    if (!user) return
    const resultado = aceptarPresupuesto(p.id, user.id)
    if (!resultado.ok) {
      toast.error(resultado.error)
      return
    }
    toast.success(`Presupuesto ${p.id} aceptado — venta creada`, {
      action: { label: 'Ver venta', onClick: () => navigate(`/ventas/${encodeURIComponent(p.id)}`) },
    })
  }

  const presupuestos = allPresupuestos
    .filter(p => p.activo)
    .filter(p => estadoFilter === 'all' || p.estadoComercial === estadoFilter)
    .filter(p => categoriaFilter === 'all' || p.categoria === categoriaFilter)
    .filter(p => {
      const q = query.toLowerCase()
      return !q || p.id.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q)
    })

  return (
    <AppShell
      title="Presupuestos"
      actions={
        <div className="flex items-center gap-2">
          <PermissionGuard permission="presupuestos:write">
            <button onClick={() => navigate('/presupuestos/nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
            </button>
          </PermissionGuard>
          <div className="lg:hidden"><AdminMenu /></div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por N° o cliente..."
            className="w-full pl-9 pr-4 py-3 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setEstadoFilter('all')} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${estadoFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>Todos</button>
          {CONFIG_LISTS.ESTADO_COMERCIAL.map(e => (
            <button key={e} onClick={() => setEstadoFilter(e)} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${estadoFilter === e ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>{e}</button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setCategoriaFilter('all')} className={`shrink-0 px-3 py-1.5 rounded-xl border text-xs ${categoriaFilter === 'all' ? 'bg-accent text-white border-accent' : 'bg-white text-muted-foreground border-border'}`}>Todas las categorías</button>
          {CONFIG_LISTS.CATEGORIA.map(c => (
            <button key={c} onClick={() => setCategoriaFilter(c)} className={`shrink-0 px-3 py-1.5 rounded-xl border text-xs ${categoriaFilter === c ? 'bg-accent text-white border-accent' : 'bg-white text-muted-foreground border-border'}`}>{c}</button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{presupuestos.length} presupuesto{presupuestos.length !== 1 ? 's' : ''}</p>

        <EntityList
          items={presupuestos}
          keyExtractor={p => p.id}
          emptyTitle="Sin presupuestos"
          emptyDescription="No hay presupuestos que coincidan con el filtro."
          emptyAction={{ label: 'Nuevo presupuesto', onClick: () => navigate('/presupuestos/nuevo') }}
          renderItem={p => (
            <EntityCard
              title={p.id}
              subtitle={`${p.cliente} · ${p.descripcion}`}
              status={{ label: p.estadoComercial, ...ESTADO_COMERCIAL_CONFIG[p.estadoComercial] }}
              onClick={() => navigate(`/presupuestos/${encodeURIComponent(p.id)}`)}
              fields={[
                { label: 'Monto', value: formatCurrency(p.montoTotal), highlight: true },
                { label: 'Fecha', value: formatDate(p.fecha) },
              ]}
              actions={
                p.estadoComercial !== 'Aceptado' && (
                  <PermissionGuard permission="presupuestos:write">
                    <button
                      onClick={e => { e.stopPropagation(); handleAceptar(p) }}
                      className="text-sm font-medium text-primary"
                    >
                      Marcar como Aceptado
                    </button>
                  </PermissionGuard>
                )
              }
            />
          )}
        />
      </div>
    </AppShell>
  )
}
