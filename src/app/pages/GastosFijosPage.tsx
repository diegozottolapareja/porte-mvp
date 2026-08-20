import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { EntityList } from '@/components/EntityList'
import { EntityCard } from '@/components/EntityCard'
import { CardActionsMenu } from '@/components/CardActionsMenu'
import { PermissionGuard } from '../components/PermissionGuard'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { PillSelect } from '@/components/PillSelect'
import { ChequeEstadoDialog } from '@/components/ChequeEstadoDialog'
import { EntityDetailDialog } from '@/components/EntityDetailDialog'
import { calcDiferencia, CONFIG_LISTS, CHEQUE_ESTADO_STYLE, type GastoFijo, type CategGastoFijo, type Periodicidad, type EstadoGastoFijo, type Cuenta, type TipoCaja, type Cheque } from '@/modules/porte'
import { useGastosFijos, useGastoFijoActions, useCajas, useMetodosPago, useCheques, useChequeActions } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, todayLocal } from '@/lib/format'
import { isNegativeAmount } from '@/lib/validation'

const ESTADO_STYLE: Record<EstadoGastoFijo, { label: string; color: string; bgColor: string }> = {
  PAGADO: { label: 'PAGADO', color: 'text-green-700', bgColor: 'bg-green-100' },
  PREVISTO: { label: 'PREVISTO', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  VENCIDO: { label: 'VENCIDO', color: 'text-red-700', bgColor: 'bg-red-100' },
}

const PERIODICIDADES: Periodicidad[] = ['Mensual', 'Bimestral', 'Trimestral', 'Anual', 'Único']
const ESTADOS: EstadoGastoFijo[] = ['PREVISTO', 'PAGADO', 'VENCIDO']

export default function GastosFijosPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const gastosFijos = useGastosFijos()
  const cheques = useCheques()
  const { updateGastoFijo, softDeleteGastoFijo } = useGastoFijoActions()
  const { actualizarEstadoCheque } = useChequeActions()
  const [editing, setEditing] = useState<GastoFijo | 'nuevo' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<GastoFijo | null>(null)
  const [pendingCheque, setPendingCheque] = useState<Cheque | null>(null)
  const [viewing, setViewing] = useState<GastoFijo | null>(null)
  const puedeEditar = can('gastosfijos:write')
  const puedeEliminar = can('gastosfijos:delete')

  const viewingCheque = viewing?.chequeId ? cheques.find(c => c.id === viewing.chequeId) : undefined
  const viewingDiferencia = viewing ? calcDiferencia(viewing) : null

  const activos = gastosFijos.filter(g => g.activo)

  return (
    <AppShell
      title="Gastos fijos"
      onBack={() => navigate(-1)}
      actions={
        <PermissionGuard permission="gastosfijos:write">
          <button onClick={() => setEditing('nuevo')} className="w-10 h-10 rounded-xl bg-white/20 lg:bg-primary lg:text-white lg:w-9 lg:h-9 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white lg:w-4 lg:h-4" />
          </button>
        </PermissionGuard>
      }
    >
      <EntityList
        items={activos}
        keyExtractor={g => g.id}
        emptyTitle="Sin gastos fijos"
        emptyAction={can('gastosfijos:write') ? { label: 'Nuevo gasto fijo', onClick: () => setEditing('nuevo') } : undefined}
        className="lg:grid lg:grid-cols-2 lg:items-start"
        renderItem={g => {
          const diferencia = calcDiferencia(g)
          const cheque = g.chequeId ? cheques.find(c => c.id === g.chequeId) : undefined
          return (
            <EntityCard
              title={g.concepto}
              subtitle={`${g.categoria} · ${g.periodicidad} · ${formatDate(g.fecha)}`}
              onClick={() => setViewing(g)}
              statusNode={
                puedeEditar ? (
                  <PillSelect
                    value={g.estado}
                    options={ESTADOS}
                    style={v => ESTADO_STYLE[v]}
                    onChange={estado => updateGastoFijo(g.id, {
                      estado,
                      // Marcar PAGADO desde acá es el camino rápido (sin
                      // abrir el diálogo) — si todavía no hay un "Real"
                      // cargado, se asume que se pagó lo previsto en vez
                      // de dejar la tarjeta en un estado inconsistente
                      // ("PAGADO" pero Real/Diferencia en "—").
                      ...(estado === 'PAGADO' && g.montoReal === null ? { montoReal: g.montoPrevisto } : {}),
                    })}
                  />
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_STYLE[g.estado].color} ${ESTADO_STYLE[g.estado].bgColor}`}>{g.estado}</span>
                )
              }
              fields={[
                { label: 'Previsto', value: formatCurrency(g.montoPrevisto), row: 1 },
                { label: 'Real', value: g.montoReal === null ? '—' : formatCurrency(g.montoReal), align: 'right', row: 1 },
                { label: 'Diferencia', value: diferencia === null ? '—' : formatCurrency(diferencia), row: 2, tone: diferencia === null ? undefined : diferencia > 0 ? 'negative' : 'positive' },
                ...(cheque ? [{ label: 'Vto. cheque', value: formatDate(cheque.fechaVencimiento), align: 'right' as const, row: 3 }] : []),
              ]}
              actions={
                (puedeEditar || puedeEliminar) && (
                  <div className="flex w-full justify-end">
                    <CardActionsMenu
                      onEdit={puedeEditar ? () => setEditing(g) : undefined}
                      onDelete={puedeEliminar ? () => setPendingDelete(g) : undefined}
                    />
                  </div>
                )
              }
            />
          )
        }}
      />

      <EntityDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.concepto ?? ''}
        subtitle={viewing ? `${viewing.categoria} · ${viewing.periodicidad} · ${formatDate(viewing.fecha)}` : undefined}
        statusNode={viewing && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_STYLE[viewing.estado].color} ${ESTADO_STYLE[viewing.estado].bgColor}`}>{viewing.estado}</span>
        )}
        fields={viewing ? [
          { label: 'Previsto', value: formatCurrency(viewing.montoPrevisto) },
          { label: 'Real', value: viewing.montoReal === null ? '—' : formatCurrency(viewing.montoReal) },
          { label: 'Diferencia', value: viewingDiferencia === null ? '—' : formatCurrency(viewingDiferencia) },
          { label: 'Cuenta', value: viewing.cuenta },
          { label: 'Caja', value: viewing.tipoCaja },
          ...(viewingCheque ? [
            { label: 'Cheque', value: CHEQUE_ESTADO_STYLE[viewingCheque.estado].label },
            { label: 'Banco', value: viewingCheque.banco ?? '—' },
            { label: 'Número', value: viewingCheque.numero ?? '—' },
            { label: 'Vto. cheque', value: formatDate(viewingCheque.fechaVencimiento) },
          ] : []),
          ...(viewing.observaciones ? [{ label: 'Observaciones', value: viewing.observaciones }] : []),
        ] : []}
        onEdit={viewing && puedeEditar ? () => { const g = viewing; setViewing(null); setEditing(g) } : undefined}
        footerExtra={viewing && viewingCheque && puedeEditar ? (
          <button
            onClick={() => { setPendingCheque(viewingCheque); setViewing(null) }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${CHEQUE_ESTADO_STYLE[viewingCheque.estado].color} ${CHEQUE_ESTADO_STYLE[viewingCheque.estado].bgColor}`}
          >
            Cambiar estado del cheque
          </button>
        ) : undefined}
      />

      <GastoFijoDialog
        key={editing === null ? 'closed' : editing === 'nuevo' ? 'nuevo' : editing.id}
        value={editing}
        onClose={() => setEditing(null)}
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
        title="Eliminar gasto fijo"
        description={pendingDelete ? `Se dará de baja "${pendingDelete.concepto}". No se borra físicamente, queda inactivo.` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) softDeleteGastoFijo(pendingDelete.id)
          toast.success('Gasto fijo eliminado')
          setPendingDelete(null)
        }}
      />
    </AppShell>
  )
}

function GastoFijoDialog({ value, onClose }: { value: GastoFijo | 'nuevo' | null; onClose: () => void }) {
  const { user } = useAuth()
  const { addGastoFijo, updateGastoFijo, guardarGastoFijoConCheque } = useGastoFijoActions()
  const { actualizarEstadoCheque } = useChequeActions()
  const cajas = useCajas()
  const metodosPago = useMetodosPago()
  const cheques = useCheques()
  const existing = value && value !== 'nuevo' ? value : undefined

  const [fecha, setFecha] = useState(existing?.fecha ?? todayLocal())
  const [concepto, setConcepto] = useState(existing?.concepto ?? '')
  const [categoria, setCategoria] = useState<CategGastoFijo>(existing?.categoria ?? CONFIG_LISTS.CATEG_GASTO_FIJO[0])
  const [montoPrevisto, setMontoPrevisto] = useState(existing?.montoPrevisto?.toString() ?? '')
  const [montoReal, setMontoReal] = useState(existing?.montoReal?.toString() ?? '')
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(existing?.periodicidad ?? 'Mensual')
  // "Caja" (entidad real) reemplaza al viejo selector de "Cuenta" — mismo
  // criterio que Ingreso/Egreso (round 2): son la misma lista mostrada dos
  // veces. `cuenta`/`tipoCaja` (legacy) se derivan de la caja elegida.
  const [cajaId, setCajaId] = useState(existing?.cajaId ?? '')
  const [cuentaLegacy] = useState<Cuenta>(existing?.cuenta ?? CONFIG_LISTS.CUENTAS[0])
  const [caja, setCaja] = useState<TipoCaja>(existing?.tipoCaja ?? 'BLANCA')
  const [metodoPagoId, setMetodoPagoId] = useState(existing?.metodoPagoId ?? '')
  const [estado, setEstado] = useState<EstadoGastoFijo>(existing?.estado ?? 'PREVISTO')
  const [observaciones, setObservaciones] = useState(existing?.observaciones ?? '')
  // Cheque como medio de pago (sección "Gastos Fijos con cheque" del
  // pedido): solo se puede elegir mientras el gasto todavía no tiene un
  // cheque asociado — una vez creado, el estado del cheque se avanza desde
  // la lista, no reabriendo este form (mismo criterio que Ingresos/Egresos).
  const [chequeBanco, setChequeBanco] = useState('')
  const [chequeNumero, setChequeNumero] = useState('')
  const [chequeFechaVencimiento, setChequeFechaVencimiento] = useState('')
  const [quitarCheque, setQuitarCheque] = useState(false)
  const [saving, setSaving] = useState(false)

  const cajaSeleccionada = cajas.find(c => c.id === cajaId)
  const cuenta = (cajaSeleccionada?.nombre as Cuenta | undefined) ?? cuentaLegacy
  const tipoCaja = (cajaSeleccionada?.tipoCaja as TipoCaja | undefined) ?? caja
  const metodoSeleccionado = metodosPago.find(m => m.id === metodoPagoId)
  const yaTieneCheque = !!existing?.chequeId
  const esCheque = !yaTieneCheque && metodoSeleccionado?.tipo === 'CHEQUE'
  const chequeLigado = existing?.chequeId ? cheques.find(c => c.id === existing.chequeId) : undefined
  const chequeYaAvanzado = !!chequeLigado && chequeLigado.estado !== 'EMITIDO'

  // Regla de negocio: caja Negra solo admite instrumentos INMEDIATO — mismo
  // filtrado bidireccional que Egreso (ver 0022_finanzas_regla_caja_instrumento.sql).
  const cajaElegidaEsNegra = cajaSeleccionada?.tipoCaja === 'NEGRA'
  const metodosDisponibles = cajaElegidaEsNegra ? metodosPago.filter(m => m.tipo === 'INMEDIATO') : metodosPago
  const cajasDisponibles = metodoSeleccionado && metodoSeleccionado.tipo !== 'INMEDIATO'
    ? cajas.filter(c => c.tipoCaja === 'BLANCA')
    : cajas

  const open = value !== null

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose()
  }

  const handleSave = async () => {
    if (!concepto || !montoPrevisto || !user) {
      toast.error('Completá concepto y monto previsto')
      return
    }
    if (isNegativeAmount(montoPrevisto) || isNegativeAmount(montoReal)) {
      toast.error('El monto no puede ser negativo')
      return
    }
    if (esCheque && !chequeFechaVencimiento) {
      toast.error('Completá la fecha de vencimiento del cheque')
      return
    }
    const payload = {
      fecha, concepto, categoria,
      montoPrevisto: Number(montoPrevisto),
      montoReal: montoReal === '' ? null : Number(montoReal),
      periodicidad, cuenta, tipoCaja, cajaId: cajaSeleccionada?.id, metodoPagoId: metodoPagoId || undefined,
      // Emitir el cheque es el acto de pago — la obligación queda PAGADO de
      // una, la salida real de caja se rastrea aparte con fechaPagoEfectivo.
      estado: esCheque ? ('PAGADO' as const) : estado,
      proveedorId: existing?.proveedorId ?? null,
      observaciones: observaciones || undefined,
    }

    if (esCheque) {
      setSaving(true)
      const resultado = await guardarGastoFijoConCheque(
        payload,
        { banco: chequeBanco || undefined, numero: chequeNumero || undefined, fechaVencimiento: chequeFechaVencimiento },
        user.id,
        existing?.id,
      )
      setSaving(false)
      if (!resultado.ok) {
        toast.error(resultado.error)
        return
      }
      toast.success(existing ? 'Gasto fijo actualizado' : 'Gasto fijo creado')
      onClose()
      return
    }

    if (existing) {
      updateGastoFijo(existing.id, payload)
      if (chequeLigado && !chequeYaAvanzado && quitarCheque) {
        setSaving(true)
        const resultado = await actualizarEstadoCheque(chequeLigado.id, 'ANULADO', todayLocal())
        setSaving(false)
        if (!resultado.ok) {
          toast.error(resultado.error)
          return
        }
      }
      toast.success('Gasto fijo actualizado')
    } else {
      addGastoFijo(payload, user.id)
      toast.success('Gasto fijo creado')
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? existing.concepto : 'Nuevo gasto fijo'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Concepto *</label>
              <input value={concepto} onChange={e => setConcepto(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Categoría</label>
            <div className="flex gap-2 flex-wrap">
              {CONFIG_LISTS.CATEG_GASTO_FIJO.map(c => (
                <button key={c} onClick={() => setCategoria(c)} className={`px-3 py-2 rounded-xl border text-sm ${categoria === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Monto previsto *</label>
              <input type="number" min="0" value={montoPrevisto} onChange={e => setMontoPrevisto(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Monto real</label>
              <input type="number" min="0" value={montoReal} onChange={e => setMontoReal(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Periodicidad</label>
            <div className="flex gap-2 flex-wrap">
              {PERIODICIDADES.map(p => (
                <button key={p} onClick={() => setPeriodicidad(p)} className={`px-3 py-2 rounded-xl border text-sm ${periodicidad === p ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Caja</label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setCajaId('')} className={`px-3 py-2 rounded-xl border text-sm ${!cajaId ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>Sin especificar</button>
              {cajasDisponibles.map(c => (
                <button key={c.id} onClick={() => setCajaId(c.id)} className={`px-3 py-2 rounded-xl border text-sm ${cajaId === c.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c.nombre}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">¿Cómo se paga?</label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setMetodoPagoId('')} disabled={yaTieneCheque} className={`px-3 py-2 rounded-xl border text-sm disabled:opacity-40 ${!metodoPagoId ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>Sin especificar</button>
              {metodosDisponibles.filter(m => m.activo).map(m => (
                <button key={m.id} onClick={() => setMetodoPagoId(m.id)} disabled={yaTieneCheque} className={`px-3 py-2 rounded-xl border text-sm disabled:opacity-40 ${metodoPagoId === m.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{m.nombre}</button>
              ))}
            </div>
            {cajaElegidaEsNegra && <p className="text-xs text-muted-foreground mt-1">Caja Negra elegida arriba — solo admite Efectivo o Transferencia.</p>}

            {chequeLigado && (
              <div className="mt-3 p-4 rounded-2xl border border-border bg-muted/40 space-y-2">
                <p className="text-sm font-medium">Cheque vinculado: {CHEQUE_ESTADO_STYLE[chequeLigado.estado].label}</p>
                <p className="text-xs text-muted-foreground">
                  {chequeLigado.banco || 'Sin banco'}{chequeLigado.numero ? ` · Nº ${chequeLigado.numero}` : ''} · Vto. {formatDate(chequeLigado.fechaVencimiento)}
                </p>
                {chequeYaAvanzado ? (
                  <p className="text-xs text-muted-foreground">
                    Este cheque ya está "{CHEQUE_ESTADO_STYLE[chequeLigado.estado].label}" — para anularlo, cambiá su estado desde la tarjeta del gasto fijo.
                  </p>
                ) : (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!quitarCheque} onChange={e => setQuitarCheque(!e.target.checked)} />
                    Mantener vinculado el cheque
                  </label>
                )}
              </div>
            )}

            {esCheque && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <p className="col-span-2 text-xs text-muted-foreground">
                  El vencimiento de arriba sigue siendo el de la obligación — la salida de caja se registra cuando el cheque se marca Debitado (desde la lista).
                </p>
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground mb-1.5 block">Banco</label>
                  <input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Número</label>
                  <input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Fecha vencimiento (débito)</label>
                  <input type="date" value={chequeFechaVencimiento} onChange={e => setChequeFechaVencimiento(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Tipo de caja</label>
              <div className="flex gap-2">
                {CONFIG_LISTS.TIPO_CAJA.map(c => (
                  <button key={c} onClick={() => setCaja(c)} disabled={!!cajaSeleccionada} className={`flex-1 py-2.5 rounded-xl border text-sm disabled:opacity-40 ${tipoCaja === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Estado</label>
              <div className="flex gap-2">
                {ESTADOS.map(e => (
                  <button key={e} onClick={() => setEstado(e)} disabled={esCheque} className={`flex-1 py-2.5 rounded-xl border text-xs disabled:opacity-40 ${(esCheque ? 'PAGADO' : estado) === e ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{e}</button>
                ))}
              </div>
              {esCheque && <p className="text-xs text-muted-foreground mt-1">Con cheque, el gasto queda PAGADO de una.</p>}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-2xl border border-border text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
