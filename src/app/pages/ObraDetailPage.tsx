import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { VariacionDialog } from '@/components/VariacionDialog'
import { AprendizajeDialog } from '@/components/AprendizajeDialog'
import { EstadoOperativoSelect } from '@/components/EstadoOperativoSelect'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Progress } from '@/app/components/ui/progress'
import {
  ESTADO_OPERATIVO_CONFIG,
  getTotalCobrado, getSaldoPendiente, getCostoEstimado, getDesvioCosto,
  type EstadoOperativo, type Variacion, type Aprendizaje,
} from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/format'
import { ClipboardList } from 'lucide-react'

const CATEGORIAS_COSTO: Array<{ key: 'mater' | 'mo' | 'indVend' | 'imp' | 'comerc'; label: string }> = [
  { key: 'mater', label: 'Materiales' },
  { key: 'mo', label: 'Mano de obra' },
  { key: 'indVend', label: 'Indirectos' },
  { key: 'imp', label: 'Impuestos' },
  { key: 'comerc', label: 'Comercial' },
]

export default function ObraDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { can } = useAuth()
  const { ventas, ingresos, egresos, variaciones, aprendizajes, updateVenta, softDeleteVariacion, softDeleteAprendizaje } = usePorteData()
  const venta = ventas.find(v => v.id === decodeURIComponent(id ?? ''))
  const [editingVariacion, setEditingVariacion] = useState<Variacion | 'nuevo' | null>(null)
  const [editingAprendizaje, setEditingAprendizaje] = useState<Aprendizaje | 'nuevo' | null>(null)
  const [deleteVariacion, setDeleteVariacion] = useState<Variacion | null>(null)
  const [deleteAprendizaje, setDeleteAprendizaje] = useState<Aprendizaje | null>(null)

  if (!venta) {
    return (
      <AppShell title="Venta no encontrada" onBack={() => navigate('/ventas')}>
        <EmptyState Icon={ClipboardList} title="Venta no encontrada" action={{ label: 'Volver a ventas', onClick: () => navigate('/ventas') }} />
      </AppShell>
    )
  }

  const cobrado = getTotalCobrado(venta.id, ingresos)
  const pendiente = getSaldoPendiente(venta, ingresos)
  const pct = venta.ventaFinal > 0 ? Math.min(100, Math.round((cobrado / venta.ventaFinal) * 100)) : 0
  const costoEstimado = getCostoEstimado(venta)
  const desvio = getDesvioCosto(venta, egresos)
  const estado = ESTADO_OPERATIVO_CONFIG[venta.estadoOp]

  const ingresosObra = ingresos.filter(i => i.activo && i.id === venta.id)
  const egresosObra = egresos.filter(e => e.activo && e.id === venta.id)
  const variacionesObra = variaciones.filter(v => v.activo && v.idPres === venta.id.replace(' ', ''))
  const aprendizajesObra = aprendizajes.filter(a => a.activo && a.idPres === venta.id.replace(' ', ''))

  return (
    <AppShell title={venta.id} onBack={() => navigate(-1)}>
      <div className="space-y-4">
        {/* KPIs de la obra */}
        <div className="bg-gradient-to-br from-primary to-accent rounded-3xl p-5 lg:p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white/70 text-sm">{venta.cliente}</p>
            {can('ventas:write') ? (
              <EstadoOperativoSelect
                value={venta.estadoOp}
                onChange={value => updateVenta(venta.id, { estadoOp: value as EstadoOperativo })}
              />
            ) : (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estado.color} ${estado.bgColor}`}>{estado.label}</span>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <p className="text-white/60 text-[11px] uppercase tracking-wide">Venta final</p>
              <p className="text-lg lg:text-xl font-semibold">{formatCurrency(venta.ventaFinal)}</p>
            </div>
            <div>
              <p className="text-white/60 text-[11px] uppercase tracking-wide">Cobrado</p>
              <p className="text-lg lg:text-xl font-semibold">{formatCurrency(cobrado)}</p>
            </div>
            <div>
              <p className="text-white/60 text-[11px] uppercase tracking-wide">Pendiente</p>
              <p className="text-lg lg:text-xl font-semibold">{formatCurrency(pendiente)}</p>
            </div>
            <div className="col-span-2 lg:col-span-1">
              <p className="text-white/60 text-[11px] uppercase tracking-wide mb-2">Progreso de cobro ({pct}%)</p>
              <Progress value={pct} className="bg-white/20" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="datos">
          <TabsList className="w-full grid grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="datos">Datos</TabsTrigger>
            <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
            <TabsTrigger value="egresos">Egresos</TabsTrigger>
            <TabsTrigger value="variaciones">Variac.</TabsTrigger>
            <TabsTrigger value="aprendizaje">Aprend.</TabsTrigger>
          </TabsList>

          <TabsContent value="datos" className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 mt-4">
            <div className="bg-white rounded-2xl border border-border p-4 grid grid-cols-2 gap-4 content-start">
              <InfoField label="Condición de pago" value={venta.condPago} />
              <InfoField label="Días" value={venta.dias?.toString()} />
              <InfoField label="Vencimiento cobro" value={formatDate(venta.vencCobro)} />
              <InfoField label="Caja intención" value={venta.cajaIntenc} />
              <InfoField label="Entrega comprometida" value={formatDate(venta.entregaCompr)} />
              <InfoField label="Entrega real" value={formatDate(venta.entregaReal)} />
              <InfoField label="Responsable" value={venta.respOp} />
            </div>

            <div className="bg-white rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Costeo estimado vs real</h3>
              <div className="space-y-2 mb-3">
                {CATEGORIAS_COSTO.map(c => (
                  <div key={c.key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-medium">{formatCurrency(venta[c.key])}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Costo estimado total</span>
                <span className="font-semibold">{formatCurrency(costoEstimado)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Egresado real</span>
                <span className="font-semibold">{formatCurrency(costoEstimado + desvio)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-muted-foreground">Desvío</span>
                <span className={`font-semibold ${desvio > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {desvio > 0 ? '+' : ''}{formatCurrency(desvio)}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ingresos" className="space-y-3 mt-4">
            {ingresosObra.length === 0
              ? <EmptyState Icon={ClipboardList} title="Sin ingresos" description="Todavía no se registraron cobros para esta obra." />
              : ingresosObra.map(i => (
                <div key={i.ref} className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{i.concepto}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(i.fecha)} · {i.cuenta}</p>
                  </div>
                  <p className="font-semibold text-green-700">{formatCurrency(i.monto)}</p>
                </div>
              ))}
          </TabsContent>

          <TabsContent value="egresos" className="space-y-3 mt-4">
            {egresosObra.length === 0
              ? <EmptyState Icon={ClipboardList} title="Sin egresos" description="Todavía no se registraron pagos para esta obra." />
              : egresosObra.map(e => (
                <div key={e.ref} className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{e.tipoEgreso}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.fecha)} · {e.cuenta}</p>
                  </div>
                  <p className="font-semibold text-red-700">{formatCurrency(e.monto)}</p>
                </div>
              ))}
          </TabsContent>

          <TabsContent value="variaciones" className="space-y-3 mt-4">
            <PermissionGuard permission="variaciones:write">
              <button onClick={() => setEditingVariacion('nuevo')} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-2xl text-sm text-muted-foreground">
                <Plus className="w-4 h-4" /> Registrar variación
              </button>
            </PermissionGuard>
            {variacionesObra.map(v => (
              <div key={v.idVar} className="bg-white rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{v.tipoVar}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(v.fecha)}</p>
                </div>
                <p className="text-sm text-muted-foreground">{v.descripcion}</p>
                <p className="text-xs mt-1">{v.valorAnterior} → {v.valorNuevo}</p>
                <div className="flex items-center gap-4 border-t border-border mt-2 pt-2">
                  <PermissionGuard permission="variaciones:write">
                    <button onClick={() => setEditingVariacion(v)} className="text-sm font-medium text-primary">Editar</button>
                  </PermissionGuard>
                  <PermissionGuard permission="variaciones:delete">
                    <button onClick={() => setDeleteVariacion(v)} className="text-sm font-medium text-destructive">Eliminar</button>
                  </PermissionGuard>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="aprendizaje" className="space-y-3 mt-4">
            <PermissionGuard permission="aprendizajes:write">
              <button onClick={() => setEditingAprendizaje('nuevo')} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-2xl text-sm text-muted-foreground">
                <Plus className="w-4 h-4" /> Registrar aprendizaje
              </button>
            </PermissionGuard>
            {aprendizajesObra.map(a => (
              <div key={a.idApr} className="bg-white rounded-2xl border border-border p-4 space-y-1">
                <p className="text-sm"><span className="font-medium">Bien:</span> {a.queSalioBien}</p>
                <p className="text-sm"><span className="font-medium">Mal:</span> {a.queSalioMal}</p>
                <p className="text-xs text-muted-foreground">Causa: {a.causaDesvio}</p>
                <div className="flex items-center gap-4 border-t border-border mt-2 pt-2">
                  <PermissionGuard permission="aprendizajes:write">
                    <button onClick={() => setEditingAprendizaje(a)} className="text-sm font-medium text-primary">Editar</button>
                  </PermissionGuard>
                  <PermissionGuard permission="aprendizajes:delete">
                    <button onClick={() => setDeleteAprendizaje(a)} className="text-sm font-medium text-destructive">Eliminar</button>
                  </PermissionGuard>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <VariacionDialog
        open={editingVariacion !== null}
        onClose={() => setEditingVariacion(null)}
        editing={editingVariacion && editingVariacion !== 'nuevo' ? editingVariacion : undefined}
        fixedObra={{ idPres: venta.id.replace(' ', ''), cliente: venta.cliente }}
      />
      <AprendizajeDialog
        open={editingAprendizaje !== null}
        onClose={() => setEditingAprendizaje(null)}
        editing={editingAprendizaje && editingAprendizaje !== 'nuevo' ? editingAprendizaje : undefined}
        fixedObra={{ idPres: venta.id.replace(' ', ''), cliente: venta.cliente, categoria: 'OTRO' }}
      />

      <ConfirmModal
        open={!!deleteVariacion}
        onOpenChange={open => !open && setDeleteVariacion(null)}
        title="Eliminar variación"
        description="Se dará de baja. No se borra físicamente, queda inactiva."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (deleteVariacion) softDeleteVariacion(deleteVariacion.idVar)
          toast.success('Variación eliminada')
          setDeleteVariacion(null)
        }}
      />
      <ConfirmModal
        open={!!deleteAprendizaje}
        onOpenChange={open => !open && setDeleteAprendizaje(null)}
        title="Eliminar aprendizaje"
        description="Se dará de baja. No se borra físicamente, queda inactivo."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (deleteAprendizaje) softDeleteAprendizaje(deleteAprendizaje.idApr)
          toast.success('Aprendizaje eliminado')
          setDeleteAprendizaje(null)
        }}
      />
    </AppShell>
  )
}

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
  )
}
