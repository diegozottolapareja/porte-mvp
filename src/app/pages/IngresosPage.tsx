import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { CardActionsMenu } from '@/components/CardActionsMenu'
import { MovimientosTabs } from '@/components/MovimientosTabs'
import { PillSelect } from '@/components/PillSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ChequeEstadoDialog } from '@/components/ChequeEstadoDialog'
import { EntityDetailDialog } from '@/components/EntityDetailDialog'
import { useIngresos, useVentas, useIngresoActions, useCheques, useChequeActions } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/format'
import { CHEQUE_ESTADO_STYLE, type EstadoIngreso, type Ingreso, type Cheque } from '@/modules/porte'

const ESTADO_INGRESO_STYLE: Record<EstadoIngreso, { label: string; color: string; bgColor: string }> = {
  Confirmado: { label: 'Confirmado', color: 'text-green-700', bgColor: 'bg-green-100' },
  Pendiente: { label: 'Pendiente', color: 'text-amber-700', bgColor: 'bg-amber-100' },
}
const ESTADOS_INGRESO: EstadoIngreso[] = ['Confirmado', 'Pendiente']

export default function IngresosPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const ingresos = useIngresos()
  const ventas = useVentas()
  const cheques = useCheques()
  const { updateIngreso, softDeleteIngreso } = useIngresoActions()
  const { actualizarEstadoCheque } = useChequeActions()
  const [pendingDelete, setPendingDelete] = useState<Ingreso | null>(null)
  const [pendingCheque, setPendingCheque] = useState<Cheque | null>(null)
  const [viewing, setViewing] = useState<Ingreso | null>(null)
  const activos = ingresos.filter(i => i.activo)
  const puedeEditar = can('ingresos:write')
  const puedeEliminar = can('ingresos:delete')

  const viewingCheque = viewing?.chequeId ? cheques.find(c => c.id === viewing.chequeId) : undefined
  const irAEditar = (ingreso: Ingreso) => {
    setViewing(null)
    navigate(`/ingresos/nuevo?ref=${encodeURIComponent(ingreso.ref)}`)
  }

  const totalPeriodo = activos
    .filter(i => i.estado === 'Confirmado')
    .reduce((sum, i) => sum + i.monto, 0)

  return (
    <AppShell
      title="Ingresos"
      actions={
        <button onClick={() => navigate('/ingresos/nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
          <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
        </button>
      }
    >
      <div className="space-y-4">
        <MovimientosTabs active="ingresos" />

        <div className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total confirmado</p>
          <p className="text-xl font-semibold text-green-700">{formatCurrency(totalPeriodo)}</p>
        </div>

        <EntityList
          items={activos}
          keyExtractor={i => i.ref}
          emptyTitle="Sin ingresos"
          emptyDescription="Todavía no se registraron cobros."
          emptyAction={{ label: 'Nuevo ingreso', onClick: () => navigate('/ingresos/nuevo') }}
          className="lg:grid lg:grid-cols-2 lg:items-start"
          renderItem={ingreso => {
            const cheque = ingreso.chequeId ? cheques.find(c => c.id === ingreso.chequeId) : undefined
            return (
              <EntityCard
                title={ingreso.concepto}
                subtitle={`${ingreso.id} · ${formatDate(ingreso.fecha)}`}
                onClick={() => setViewing(ingreso)}
                statusNode={
                  <div className="flex items-center gap-1.5">
                    {puedeEditar ? (
                      <PillSelect
                        value={ingreso.estado}
                        options={ESTADOS_INGRESO}
                        style={v => ESTADO_INGRESO_STYLE[v]}
                        onChange={estado => updateIngreso(ingreso.ref, { estado })}
                      />
                    ) : (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_INGRESO_STYLE[ingreso.estado].color} ${ESTADO_INGRESO_STYLE[ingreso.estado].bgColor}`}>
                        {ESTADO_INGRESO_STYLE[ingreso.estado].label}
                      </span>
                    )}
                    {cheque && (
                      <button
                        onClick={e => { e.stopPropagation(); if (puedeEditar) setPendingCheque(cheque) }}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${CHEQUE_ESTADO_STYLE[cheque.estado].color} ${CHEQUE_ESTADO_STYLE[cheque.estado].bgColor}`}
                      >
                        Cheque: {CHEQUE_ESTADO_STYLE[cheque.estado].label}
                      </button>
                    )}
                  </div>
                }
                fields={[
                  { label: 'Monto', value: formatCurrency(ingreso.monto), highlight: true, row: 1, rowSpan: 2, size: 'lg' },
                  { label: 'Cliente', value: ventas.find(v => v.id === ingreso.id)?.cliente ?? '—', align: 'right', row: 1 },
                  { label: 'Cuenta', value: ingreso.cuenta, align: 'right', row: 2 },
                  ...(cheque ? [{ label: 'Vto. cheque', value: formatDate(cheque.fechaVencimiento), align: 'right' as const, row: 3 }] : []),
                ]}
                actions={
                  (puedeEditar || puedeEliminar) && (
                    <div className="flex w-full justify-end">
                      <CardActionsMenu
                        onEdit={puedeEditar ? () => navigate(`/ingresos/nuevo?ref=${ingreso.ref}`) : undefined}
                        onDelete={puedeEliminar ? () => setPendingDelete(ingreso) : undefined}
                      />
                    </div>
                  )
                }
              />
            )
          }}
        />
      </div>

      <EntityDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.concepto ?? ''}
        subtitle={viewing ? `${viewing.id} · ${formatDate(viewing.fecha)}` : undefined}
        statusNode={viewing && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_INGRESO_STYLE[viewing.estado].color} ${ESTADO_INGRESO_STYLE[viewing.estado].bgColor}`}>
            {ESTADO_INGRESO_STYLE[viewing.estado].label}
          </span>
        )}
        fields={viewing ? [
          { label: 'Referencia', value: viewing.ref },
          { label: 'Monto', value: formatCurrency(viewing.monto) },
          { label: 'Venta', value: `${viewing.id} · ${ventas.find(v => v.id === viewing.id)?.cliente ?? '—'}` },
          { label: 'Tipo de ingreso', value: viewing.tipoIngreso },
          { label: 'Cuenta', value: viewing.cuenta },
          { label: 'Caja', value: viewing.caja },
          ...(viewingCheque ? [{ label: 'Vto. cheque', value: formatDate(viewingCheque.fechaVencimiento) }] : []),
        ] : []}
        onEdit={viewing && puedeEditar ? () => irAEditar(viewing) : undefined}
      />

      <ChequeEstadoDialog
        cheque={pendingCheque}
        onClose={() => setPendingCheque(null)}
        onConfirm={async (nuevoEstado, fecha, cajaId) => {
          if (!pendingCheque) return
          const resultado = await actualizarEstadoCheque(pendingCheque.id, nuevoEstado, fecha, cajaId)
          if (!resultado.ok) toast.error(resultado.error)
          else toast.success('Cheque actualizado')
        }}
      />

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar ingreso"
        description={pendingDelete ? `Se dará de baja el ingreso de ${formatCurrency(pendingDelete.monto)} en ${pendingDelete.id}. No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteIngreso(pendingDelete.ref)
          toast.success('Ingreso eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}
