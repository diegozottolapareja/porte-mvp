import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { CardActionsMenu } from '@/components/CardActionsMenu'
import { MovimientosTabs } from '@/components/MovimientosTabs'
import { PillSelect } from '@/components/PillSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ChequeEstadoDialog } from '@/components/ChequeEstadoDialog'
import { ChequeAttachDialog } from '@/components/ChequeAttachDialog'
import { EntityDetailDialog } from '@/components/EntityDetailDialog'
import { MovimientoFilterBar, type FiltroEstadoAdmin } from '@/components/MovimientoFilterBar'
import { useIngresos, useVentas, useIngresoActions, chequeDeIngreso, useCheques, useChequeActions } from '@/modules/porte/store'
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
  const { can, user } = useAuth()
  const ingresos = useIngresos()
  const ventas = useVentas()
  const cheques = useCheques()
  const { updateIngreso, softDeleteIngreso, attachChequeAIngreso } = useIngresoActions()
  const { actualizarEstadoCheque } = useChequeActions()
  const [pendingDelete, setPendingDelete] = useState<Ingreso | null>(null)
  const [pendingCheque, setPendingCheque] = useState<Cheque | null>(null)
  const [pendingAttach, setPendingAttach] = useState<Ingreso | null>(null)
  const [viewing, setViewing] = useState<Ingreso | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoAdmin>('todos')
  const [soloConCheque, setSoloConCheque] = useState(false)
  const activos = ingresos.filter(i => i.activo)
  const visibles = activos.filter(i =>
    (filtroEstado === 'todos' || i.estado === filtroEstado) &&
    (!soloConCheque || !!chequeDeIngreso(i, cheques)),
  )
  const puedeEditar = can('ingresos:write')
  const puedeEliminar = can('ingresos:delete')

  const viewingCheque = chequeDeIngreso(viewing ?? undefined, cheques)
  const irAEditar = (ingreso: Ingreso) => {
    setViewing(null)
    navigate(`/ingresos/nuevo?ref=${encodeURIComponent(ingreso.ref)}`)
  }

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

        <MovimientoFilterBar
          filtroEstado={filtroEstado}
          onFiltroEstadoChange={setFiltroEstado}
          soloConCheque={soloConCheque}
          onSoloConChequeChange={setSoloConCheque}
        />

        <EntityList
          items={visibles}
          keyExtractor={i => i.ref}
          emptyTitle="Sin ingresos"
          emptyDescription="Todavía no se registraron cobros."
          emptyAction={{ label: 'Nuevo ingreso', onClick: () => navigate('/ingresos/nuevo') }}
          className="lg:grid lg:grid-cols-2 lg:items-start"
          renderItem={ingreso => {
            const cheque = chequeDeIngreso(ingreso, cheques)
            return (
              <EntityCard
                title={ingreso.ref}
                subtitle={`${ingreso.concepto} · ${ingreso.id} · ${formatDate(ingreso.fecha)}`}
                onClick={() => setViewing(ingreso)}
                statusNode={
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CHEQUE_ESTADO_STYLE[cheque.estado].color} ${CHEQUE_ESTADO_STYLE[cheque.estado].bgColor}`}>
                        Cheque · {CHEQUE_ESTADO_STYLE[cheque.estado].label}
                      </span>
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
                        extraActions={puedeEditar && !cheque ? [{ label: 'Vincular cheque', icon: Landmark, onClick: () => setPendingAttach(ingreso) }] : undefined}
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
        title={viewing?.ref ?? ''}
        subtitle={viewing ? `${viewing.concepto} · ${viewing.id} · ${formatDate(viewing.fecha)}` : undefined}
        statusNode={viewing && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_INGRESO_STYLE[viewing.estado].color} ${ESTADO_INGRESO_STYLE[viewing.estado].bgColor}`}>
            {ESTADO_INGRESO_STYLE[viewing.estado].label}
          </span>
        )}
        fields={viewing ? [
          { label: 'Monto', value: formatCurrency(viewing.monto) },
          { label: 'Venta', value: `${viewing.id} · ${ventas.find(v => v.id === viewing.id)?.cliente ?? '—'}` },
          { label: 'Tipo de ingreso', value: viewing.tipoIngreso },
          { label: 'Cuenta', value: viewing.cuenta },
          { label: 'Caja', value: viewing.caja },
          ...(viewingCheque ? [
            { label: 'Cheque', value: CHEQUE_ESTADO_STYLE[viewingCheque.estado].label },
            { label: 'Banco', value: viewingCheque.banco ?? '—' },
            { label: 'Número', value: viewingCheque.numero ?? '—' },
            { label: 'Vto. cheque', value: formatDate(viewingCheque.fechaVencimiento) },
          ] : []),
        ] : []}
        onEdit={viewing && puedeEditar ? () => irAEditar(viewing) : undefined}
        footerExtra={viewing && viewingCheque && puedeEditar ? (
          <button
            onClick={() => { setPendingCheque(viewingCheque); setViewing(null) }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${CHEQUE_ESTADO_STYLE[viewingCheque.estado].color} ${CHEQUE_ESTADO_STYLE[viewingCheque.estado].bgColor}`}
          >
            Cambiar estado del cheque
          </button>
        ) : undefined}
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

      <ChequeAttachDialog
        open={!!pendingAttach}
        direccion="COBRO"
        onClose={() => setPendingAttach(null)}
        onConfirm={async data => {
          if (!pendingAttach || !user) return
          const resultado = await attachChequeAIngreso(pendingAttach.ref, data, user.id)
          if (!resultado.ok) {
            toast.error(resultado.error)
            return
          }
          toast.success('Cheque vinculado')
          setPendingAttach(null)
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
