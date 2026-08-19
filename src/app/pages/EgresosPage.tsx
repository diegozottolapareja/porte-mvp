import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Clock3 } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { CardActionsMenu } from '@/components/CardActionsMenu'
import { MovimientosTabs } from '@/components/MovimientosTabs'
import { PillSelect } from '@/components/PillSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ChequeEstadoDialog } from '@/components/ChequeEstadoDialog'
import { useEgresos, useVentas, useEgresoActions, useCheques, useCompromisosPago, useCompromisoPagoActions, useChequeActions } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/format'
import { CHEQUE_ESTADO_STYLE, chequeImpactaCaja, type EstadoEgreso, type Egreso, type Cheque } from '@/modules/porte'

const ESTADO_STYLE: Record<EstadoEgreso, { label: string; color: string; bgColor: string }> = {
  Confirmado: { label: 'Confirmado', color: 'text-green-700', bgColor: 'bg-green-100' },
  Pendiente: { label: 'Pendiente', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  Emitido: { label: 'Cheque emitido', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  Incompleto: { label: 'Incompleto', color: 'text-orange-700', bgColor: 'bg-orange-100' },
}
const ESTADOS_EGRESO: EstadoEgreso[] = ['Confirmado', 'Pendiente', 'Emitido']

export default function EgresosPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const egresos = useEgresos()
  const ventas = useVentas()
  const cheques = useCheques()
  const compromisosPago = useCompromisosPago()
  const { updateEgreso, softDeleteEgreso } = useEgresoActions()
  const { marcarPagado } = useCompromisoPagoActions()
  const { actualizarEstadoCheque } = useChequeActions()
  const [pendingDelete, setPendingDelete] = useState<Egreso | null>(null)
  const [pendingCheque, setPendingCheque] = useState<{ cheque: Cheque; compromisoId: string } | null>(null)
  const activos = egresos.filter(e => e.activo)
  const puedeEditar = can('egresos:write')
  const puedeEliminar = can('egresos:delete')

  // Un egreso puede tener 1..N compromisos_pago (sección 6 del pedido) — acá
  // solo interesa el que trae un cheque asociado, si hay alguno.
  const chequeDeEgreso = (egreso: Egreso): { cheque: Cheque; compromisoId: string } | undefined => {
    const compromiso = compromisosPago.find(cp => cp.egresoId === egreso.ref && cp.chequeId)
    if (!compromiso?.chequeId) return undefined
    const cheque = cheques.find(c => c.id === compromiso.chequeId)
    return cheque ? { cheque, compromisoId: compromiso.id } : undefined
  }

  const chequesPendientes = cheques.filter(c => c.direccion === 'PAGO' && !chequeImpactaCaja(c.estado) && c.estado !== 'RECHAZADO' && c.estado !== 'ANULADO')

  return (
    <AppShell
      title="Egresos"
      onBack={() => navigate(-1)}
      actions={
        <button onClick={() => navigate('/egresos/nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
          <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
        </button>
      }
    >
      <div className="space-y-4">
        <MovimientosTabs active="egresos" />

        {chequesPendientes.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
            <Clock3 className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-indigo-900">{chequesPendientes.length} cheque(s) todavía no debitados</p>
              <p className="text-xs text-indigo-700">Tocá el cheque en la tarjeta del egreso para actualizar su estado.</p>
            </div>
          </div>
        )}

        <EntityList
          items={activos}
          keyExtractor={e => e.ref}
          emptyTitle="Sin egresos"
          emptyDescription="Todavía no se registraron pagos."
          emptyAction={{ label: 'Nuevo egreso', onClick: () => navigate('/egresos/nuevo') }}
          renderItem={egreso => {
            const chequeInfo = chequeDeEgreso(egreso)
            return (
              <EntityCard
                title={egreso.tipoEgreso}
                subtitle={`${egreso.id ?? 'Gasto fijo'} · ${formatDate(egreso.fecha)}`}
                onClick={() => navigate(egreso.id
                  ? `/ventas/${encodeURIComponent(egreso.id)}?tab=egresos&ref=${encodeURIComponent(egreso.ref)}`
                  : `/egresos/nuevo?ref=${encodeURIComponent(egreso.ref)}`
                )}
                statusNode={
                  chequeInfo ? (
                    // Con un Cheque real vinculado, su estado (más granular:
                    // Emitido/Entregado/Debitado/Rechazado/Anulado) reemplaza al
                    // estado legado del egreso como pill principal — mostrar los
                    // dos era redundante y confuso (ambos dicen "cheque").
                    <button
                      onClick={e => { e.stopPropagation(); if (puedeEditar) setPendingCheque(chequeInfo) }}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${CHEQUE_ESTADO_STYLE[chequeInfo.cheque.estado].color} ${CHEQUE_ESTADO_STYLE[chequeInfo.cheque.estado].bgColor}`}
                    >
                      Cheque: {CHEQUE_ESTADO_STYLE[chequeInfo.cheque.estado].label}
                    </button>
                  ) : puedeEditar ? (
                    <PillSelect
                      value={egreso.estado}
                      options={ESTADOS_EGRESO}
                      style={v => ESTADO_STYLE[v]}
                      onChange={estado => updateEgreso(egreso.ref, { estado })}
                    />
                  ) : (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_STYLE[egreso.estado].color} ${ESTADO_STYLE[egreso.estado].bgColor}`}>
                      {ESTADO_STYLE[egreso.estado].label}
                    </span>
                  )
                }
                fields={[
                  { label: 'Monto', value: formatCurrency(egreso.monto), highlight: true, row: 1, rowSpan: 2, size: 'lg' },
                  { label: 'Cliente', value: egreso.id ? (ventas.find(v => v.id === egreso.id)?.cliente ?? '—') : 'Gasto fijo', align: 'right', row: 1 },
                  { label: 'Cuenta', value: egreso.cuenta, align: 'right', row: 2 },
                  ...(chequeInfo ? [{ label: 'Vto. cheque', value: formatDate(chequeInfo.cheque.fechaVencimiento), align: 'right' as const, row: 3 }] : []),
                ]}
                actions={
                  (puedeEditar || puedeEliminar) && (
                    <div className="flex w-full justify-end">
                      <CardActionsMenu
                        onEdit={puedeEditar ? () => navigate(`/egresos/nuevo?ref=${egreso.ref}`) : undefined}
                        onDelete={puedeEliminar ? () => setPendingDelete(egreso) : undefined}
                      />
                    </div>
                  )
                }
              />
            )
          }}
        />
      </div>

      <ChequeEstadoDialog
        cheque={pendingCheque?.cheque ?? null}
        onClose={() => setPendingCheque(null)}
        onConfirm={async (nuevoEstado, fecha, cajaId) => {
          if (!pendingCheque) return
          // DEBITADO tiene que cascadear al compromiso_pago (fn_marcar_compromiso_pagado,
          // única vía que mueve caja real para un egreso) — el resto de las
          // transiciones (ENTREGADO/RECHAZADO/ANULADO) no tocan el compromiso.
          const resultado = nuevoEstado === 'DEBITADO'
            ? await marcarPagado(pendingCheque.compromisoId, fecha, cajaId)
            : await actualizarEstadoCheque(pendingCheque.cheque.id, nuevoEstado, fecha, cajaId)
          if (!resultado.ok) toast.error(resultado.error)
          else toast.success('Cheque actualizado')
        }}
      />

      <ConfirmModal
        open={!!pendingDelete}
        onOpenChange={open => !open && setPendingDelete(null)}
        title="Eliminar egreso"
        description={pendingDelete ? `Se dará de baja el egreso de ${formatCurrency(pendingDelete.monto)}${pendingDelete.id ? ` en ${pendingDelete.id}` : ''}. No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteEgreso(pendingDelete.ref)
          toast.success('Egreso eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}
