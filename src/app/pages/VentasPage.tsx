import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { EstadoOperativoSelect } from '@/components/EstadoOperativoSelect'
import { Pager } from '@/components/Pager'
import { ESTADO_OPERATIVO_CONFIG, ESTADO_COBRO_CONFIG, CONFIG_LISTS, getTotalCobrado, getEstadoCobro, type EstadoOperativo } from '@/modules/porte'
import { useVentas, useIngresos, useVentaActions } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, extractIdSeq } from '@/lib/format'

const PAGE_SIZE = 20

// El alta manual de ventas (VentaDialog) está deshabilitada: además de tener
// una incompatibilidad estructural preexistente con ventas.id → presupuestos.id
// (bug detectado en esta iteración, no reintroducido acá), ahora tampoco podría
// completar las condiciones comerciales obligatorias que exige la base. Toda
// venta nace de un presupuesto Aceptado, vía "Convertir en venta".
export default function VentasPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const ventas = useVentas()
  const ingresos = useIngresos()
  const { updateVenta } = useVentaActions()
  const [estadoFilter, setEstadoFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  const ventasFiltradas = ventas
    .filter(v => estadoFilter === 'all' || v.estadoOp === estadoFilter)
    .sort((a, b) => extractIdSeq(b.id) - extractIdSeq(a.id))
  const puedeEditar = can('ventas:write')

  const totalPages = Math.max(1, Math.ceil(ventasFiltradas.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const ventasPagina = ventasFiltradas.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [estadoFilter])

  return (
    <AppShell title="Ventas">
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setEstadoFilter('all')} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${estadoFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>Todas</button>
          {CONFIG_LISTS.ESTADO_OPERATIVO.map(e => (
            <button key={e} onClick={() => setEstadoFilter(e)} className={`shrink-0 px-3 py-1.5 rounded-xl border text-sm ${estadoFilter === e ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border'}`}>{ESTADO_OPERATIVO_CONFIG[e].label}</button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{ventasFiltradas.length} venta{ventasFiltradas.length !== 1 ? 's' : ''}</p>

        <EntityList
          items={ventasPagina}
          keyExtractor={v => v.id}
          emptyTitle="Sin ventas"
          emptyDescription="No hay ventas que coincidan con el filtro."
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

        <Pager page={pageClamped} totalPages={totalPages} onChange={setPage} />
      </div>
    </AppShell>
  )
}
