import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { EstadoOperativoSelect } from '@/components/EstadoOperativoSelect'
import { PermissionGuard } from '../components/PermissionGuard'
import { VentaDialog } from '@/components/VentaDialog'
import { ESTADO_OPERATIVO_CONFIG, ESTADO_COBRO_CONFIG, CONFIG_LISTS, getTotalCobrado, getEstadoCobro, type EstadoOperativo } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '@/lib/format'

export default function VentasPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { ventas, ingresos, updateVenta } = usePorteData()
  const [estadoFilter, setEstadoFilter] = useState<string>('all')
  const [showNueva, setShowNueva] = useState(false)

  const ventasFiltradas = ventas.filter(v => estadoFilter === 'all' || v.estadoOp === estadoFilter)
  const puedeEditar = can('ventas:write')

  return (
    <AppShell
      title="Ventas"
      actions={
        <PermissionGuard permission="ventas:write">
          <button onClick={() => setShowNueva(true)} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
          </button>
        </PermissionGuard>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setEstadoFilter('all')} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${estadoFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>Todas</button>
          {CONFIG_LISTS.ESTADO_OPERATIVO.map(e => (
            <button key={e} onClick={() => setEstadoFilter(e)} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${estadoFilter === e ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>{ESTADO_OPERATIVO_CONFIG[e].label}</button>
          ))}
        </div>

        <EntityList
          items={ventasFiltradas}
          keyExtractor={v => v.id}
          emptyTitle="Sin ventas"
          emptyDescription="No hay ventas que coincidan con el filtro."
          emptyAction={can('ventas:write') ? { label: 'Nueva venta', onClick: () => setShowNueva(true) } : undefined}
          renderItem={venta => (
            <EntityCard
              title={venta.id}
              subtitle={venta.cliente}
              statusNode={
                puedeEditar ? (
                  <div onClick={e => e.stopPropagation()}>
                    <EstadoOperativoSelect
                      value={venta.estadoOp}
                      onChange={value => updateVenta(venta.id, { estadoOp: value as EstadoOperativo })}
                    />
                  </div>
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_OPERATIVO_CONFIG[venta.estadoOp].color} ${ESTADO_OPERATIVO_CONFIG[venta.estadoOp].bgColor}`}>
                    {ESTADO_OPERATIVO_CONFIG[venta.estadoOp].label}
                  </span>
                )
              }
              onClick={() => navigate(`/ventas/${encodeURIComponent(venta.id)}`)}
              fields={[
                { label: 'Venta final', value: formatCurrency(venta.ventaFinal), highlight: true },
                { label: 'Cobrado', value: formatCurrency(getTotalCobrado(venta.id, ingresos)) },
                { label: 'Estado de cobro', value: ESTADO_COBRO_CONFIG[getEstadoCobro(venta, ingresos)].label },
              ]}
            />
          )}
        />
      </div>

      <VentaDialog open={showNueva} onClose={() => setShowNueva(false)} />
    </AppShell>
  )
}
