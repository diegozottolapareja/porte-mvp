import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Field } from '@/components/Field'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { LoadingDots } from '@/components/LoadingDots'
import { CONFIG_LISTS, CHEQUE_ESTADO_STYLE, type TipoEgreso, type Cuenta, type TipoCaja, type Egreso, type EstadoEgreso } from '@/modules/porte'
import { useVentas, useProveedores, useEgresosConEstado, useEgresoActions, useMetodosPago, useTarjetas, useCajas, useCompromisosPago, useCompromisoPagoActions, chequeDeEgreso, useCheques, type PagoEgresoInput } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, todayLocal, addDaysLocal } from '@/lib/format'
import { toPositiveAmount } from '@/lib/validation'
import { supabase } from '@/lib/supabaseClient'

// Categoría directa/indirecta puede repetirse entre las dos listas (ej.
// SERVICIOS, HERRAMIENTAS) — se muestran una sola vez.
const CATEGORIAS_EGRESO = [...new Set([...CONFIG_LISTS.CATEG_DIRECTOS, ...CONFIG_LISTS.CATEG_INDIRECTOS])]
const ESTADOS_EGRESO: EstadoEgreso[] = ['Confirmado', 'Pendiente']

// Gate de carga: en una navegación en frío (F5 / deep link a
// `?ref=EG-XXXX`), `useEgresosConEstado()` puede resolver después del primer
// render. Si el form interior montara ya con `egresos === []`, sus
// `useState(editing?.campo ?? default)` capturarían el default para siempre
// (el inicializador de useState solo corre una vez). Este componente exterior
// no monta `EgresoForm` hasta que la query terminó — así el único render que
// importa ya tiene los datos reales, y nunca se ve un form "nuevo" vacío
// pisando por encima de un registro que en realidad existe.
export default function EgresoFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editRef = searchParams.get('ref')
  const { data: egresos, isPending } = useEgresosConEstado()

  if (editRef && isPending) {
    return (
      <AppShell title="Editar egreso" onBack={() => navigate(-1)}>
        <div className="py-16 flex justify-center"><LoadingDots /></div>
      </AppShell>
    )
  }

  const editing = editRef ? egresos.find(e => e.ref === editRef) : undefined
  if (editRef && !editing) {
    return (
      <AppShell title="Egreso no encontrado" onBack={() => navigate(-1)}>
        <p className="text-sm text-muted-foreground text-center py-16">No se encontró el egreso {editRef}.</p>
      </AppShell>
    )
  }

  return <EgresoForm key={editRef ?? 'nuevo'} editing={editing} />
}

function EgresoForm({ editing }: { editing: Egreso | undefined }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const ventas = useVentas()
  const proveedores = useProveedores()
  const metodosPago = useMetodosPago()
  const tarjetas = useTarjetas()
  const cajas = useCajas()
  const { addEgreso, updateEgreso, removeEgreso, findDuplicateEgreso, addEgresoConPago, attachChequeAEgreso } = useEgresoActions()
  const { desvincularChequeDeEgreso } = useCompromisoPagoActions()
  const compromisosPago = useCompromisosPago()
  const cheques = useCheques()
  const [searchParams] = useSearchParams()
  const editRef = editing?.ref ?? null
  const obraIdParam = searchParams.get('obraId')
  // Si viene desde la ficha de venta, guardar tiene que volver ahí para ver el egreso listado.
  const volverA = obraIdParam ? `/ventas/${encodeURIComponent(obraIdParam)}` : undefined
  // Cheque real ya vinculado a este egreso (vía compromisos_pago), si hay
  // uno — a diferencia del viejo flag `estado==='Emitido'`, este es el que
  // efectivamente cuenta en el banner de "cheques todavía no debitados".
  const chequeInfo = chequeDeEgreso(editing, cheques, compromisosPago)
  const chequeLigado = chequeInfo?.cheque
  const chequeYaAvanzado = !!chequeLigado && chequeLigado.estado !== 'EMITIDO'

  const [fecha, setFecha] = useState(editing?.fecha ?? todayLocal())
  const [obraId, setObraId] = useState(editing?.id ?? obraIdParam ?? '')
  const [proveedorId, setProveedorId] = useState(editing?.proveedor ?? '')
  const [tipoEgreso, setTipoEgreso] = useState<TipoEgreso>(editing?.tipoEgreso ?? 'MATERIALES')
  const [categoria, setCategoria] = useState<string>(editing?.categoria ?? CONFIG_LISTS.CATEG_DIRECTOS[0])
  const [monto, setMonto] = useState(editing?.monto.toString() ?? '')
  // "Caja" (Banco Macro/MercadoPago/Efectivo Blanco/Efectivo Negro) reemplaza
  // al viejo selector de "Cuenta": eran la misma lista mostrada dos veces
  // (`cuenta` de texto libre vs. la entidad `cajas` real de 0018_finanzas_
  // cajas_metodos.sql). Ahora hay un solo campo, con las cajas reales — se
  // sigue guardando en `cuenta`/`caja_id` para no romper nada existente.
  const [cajaId, setCajaId] = useState(editing?.cajaId ?? '')
  const [cuentaLegacy] = useState<Cuenta>(editing?.cuenta ?? CONFIG_LISTS.CUENTAS[0])
  const [caja, setCaja] = useState<TipoCaja>(editing?.caja ?? 'BLANCA')
  const [estado, setEstado] = useState<EstadoEgreso>(editing?.estado ?? 'Confirmado')
  // "Es un cheque" en edición: a diferencia del alta, acá vincula/desvincula
  // un Cheque real (vía attachChequeAEgreso/desvincularChequeDeEgreso) — no
  // un flag cosmético. Tildarlo cuando no hay cheque todavía pide banco/
  // número/vencimiento; destildarlo cuando ya hay uno lo desvincula (el
  // cheque real no se anula, solo si sigue EMITIDO — ver `chequeYaAvanzado`).
  const [esCheque, setEsCheque] = useState(false)
  const [quitarCheque, setQuitarCheque] = useState(false)
  const [chequeBancoNuevo, setChequeBancoNuevo] = useState('')
  const [chequeNumeroNuevo, setChequeNumeroNuevo] = useState('')
  const [chequeVencimientoNuevo, setChequeVencimientoNuevo] = useState('')

  // ─── "¿Cómo se paga?" — solo para egresos nuevos (sección 22 del pedido) ──
  // Reemplaza el checkbox "Es un cheque": según el método, genera el/los
  // compromiso_pago correspondientes (ver addEgresoConPago en store.tsx) en
  // vez de solo guardar el egreso. Editar un egreso existente no pasa por acá
  // — el pago ya se generó cuando se creó, no se regenera al editar.
  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [chequeBanco, setChequeBanco] = useState('')
  const [chequeNumero, setChequeNumero] = useState('')
  const [chequeFechaVencimiento, setChequeFechaVencimiento] = useState('')
  const [fechaVencimientoCC, setFechaVencimientoCC] = useState('')
  const [tarjetaId, setTarjetaId] = useState('')
  const [cuotas, setCuotas] = useState('1')

  const [pendingDuplicate, setPendingDuplicate] = useState<Egreso | null>(null)
  const [pendingLoadAnother, setPendingLoadAnother] = useState(false)
  const [saving, setSaving] = useState(false)

  const obraOptions = ventas.map(v => ({ value: v.id, label: v.id, sublabel: v.cliente }))
  const proveedorOptions = proveedores.filter(p => p.activo).map(p => ({ value: p.idProv, label: p.nombre, sublabel: p.rubro }))
  const metodoSeleccionado = metodosPago.find(m => m.id === metodoPagoId)
  const proveedorSeleccionado = proveedores.find(p => p.idProv === proveedorId)
  // Si no se eligió caja a mano pero sí un método con caja por defecto, usarla
  // acá también — si no, `cuenta`/`caja` (legacy) quedaban desalineados del
  // caja_id real que store.tsx resuelve para el compromiso (bug encontrado en
  // testing: método "Efectivo" sin caja explícita generaba el compromiso en
  // Efectivo Blanco pero guardaba cuenta="Banco Macro" en el egreso).
  const cajaEfectivaId = cajaId || (!editing ? metodoSeleccionado?.cajaId : undefined)
  const cajaSeleccionada = cajas.find(c => c.id === cajaEfectivaId)
  const cuenta = (cajaSeleccionada?.nombre as Cuenta | undefined) ?? cuentaLegacy
  const cajaTipo = (cajaSeleccionada?.tipoCaja as TipoCaja | undefined) ?? caja

  // Regla de negocio: una caja Negra solo admite instrumentos INMEDIATO
  // (efectivo/transferencia) — cheque, cuenta corriente y tarjeta dejan
  // rastro formal y exigen caja Blanca. Se filtra en ambos sentidos para que
  // nunca se pueda armar una combinación inválida desde el formulario (la
  // base también la rechaza — ver 0022_finanzas_regla_caja_instrumento.sql).
  const cajaElegidaEsNegra = cajas.find(c => c.id === cajaId)?.tipoCaja === 'NEGRA'
  const metodosDisponibles = cajaElegidaEsNegra ? metodosPago.filter(m => m.tipo === 'INMEDIATO') : metodosPago
  const cajasDisponibles = metodoSeleccionado && metodoSeleccionado.tipo !== 'INMEDIATO'
    ? cajas.filter(c => c.tipoCaja === 'BLANCA')
    : cajas

  const doSaveEditing = async (montoNum: number) => {
    if (!user || !editing) return
    updateEgreso(editing.ref, {
      fecha, id: obraId || undefined, proveedor: proveedorId || undefined, tipoEgreso, categoria,
      monto: montoNum, cuenta, caja: cajaTipo, cajaId: cajaSeleccionada?.id,
      estado,
    })
    // TODO: reemplazar con api.put(`/egresos/${editing.ref}`, payload)

    if (!chequeLigado && esCheque) {
      setSaving(true)
      const resultado = await attachChequeAEgreso(
        editing.ref,
        { banco: chequeBancoNuevo || undefined, numero: chequeNumeroNuevo || undefined, fechaVencimiento: chequeVencimientoNuevo },
        user.id,
      )
      setSaving(false)
      if (!resultado.ok) {
        toast.error(resultado.error)
        return
      }
    } else if (chequeLigado && chequeInfo && !chequeYaAvanzado && quitarCheque) {
      setSaving(true)
      const resultado = await desvincularChequeDeEgreso(chequeInfo.compromisoId)
      setSaving(false)
      if (!resultado.ok) {
        toast.error(resultado.error)
        return
      }
    }

    toast.success('Egreso actualizado')
    navigate(volverA ?? '/mis-registros')
  }

  const doSaveNuevo = async (loadAnother: boolean, montoNum: number) => {
    if (!user) return

    if (!metodoSeleccionado) {
      // Sin método elegido: se guarda como antes (sin generar compromiso), para
      // no bloquear cargas rápidas de gastos que todavía no tienen esa info.
      const nuevo = addEgreso({
        fecha, id: obraId || undefined, proveedor: proveedorId || undefined, tipoEgreso, categoria,
        monto: montoNum, cuenta, caja: cajaTipo, cajaId: cajaSeleccionada?.id, estado: 'Confirmado',
      }, user.id)
      // TODO: reemplazar con api.post('/egresos', nuevo)
      toast.success(`Egreso de ${formatCurrency(nuevo.monto)} registrado${nuevo.id ? ` en ${nuevo.id}` : ''}`, {
        duration: 5000,
        action: { label: 'Deshacer', onClick: () => removeEgreso(nuevo.ref) },
      })
      if (loadAnother) setMonto('')
      else navigate(volverA ?? '/carga')
      return
    }

    const pago: PagoEgresoInput = {
      metodoPagoId: metodoSeleccionado.id,
      cajaId: cajaId || undefined,
      chequeBanco: chequeBanco || undefined,
      chequeNumero: chequeNumero || undefined,
      chequeFechaVencimiento: chequeFechaVencimiento || undefined,
      fechaVencimientoCC: fechaVencimientoCC || undefined,
      tarjetaId: tarjetaId || undefined,
      cuotas: Number(cuotas) || 1,
    }

    setSaving(true)
    const resultado = await addEgresoConPago(
      { fecha, id: obraId || undefined, proveedor: proveedorId || undefined, tipoEgreso, categoria, monto: montoNum, cuenta, caja: cajaTipo, cajaId: cajaSeleccionada?.id },
      pago, user.id,
    )
    setSaving(false)

    if (!resultado.ok) {
      toast.error(resultado.error)
      return
    }

    toast.success(`Egreso de ${formatCurrency(resultado.egreso.monto)} registrado${resultado.egreso.id ? ` en ${resultado.egreso.id}` : ''}`, { duration: 5000 })
    if (loadAnother) setMonto('')
    else navigate(volverA ?? '/carga')
  }

  const handleVerComprobante = async () => {
    if (!editing?.comprobantePath) return
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(editing.comprobantePath, 60)
    if (error || !data) {
      toast.error('No se pudo abrir el comprobante')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const handleSave = (loadAnother: boolean) => {
    const montoNum = toPositiveAmount(monto)
    if (!montoNum) {
      toast.error('El monto debe ser mayor a cero')
      return
    }
    if (!editing && metodoSeleccionado?.tipo === 'CHEQUE' && !chequeFechaVencimiento) {
      toast.error('Completá la fecha de vencimiento del cheque')
      return
    }
    if (!editing && metodoSeleccionado?.tipo === 'TARJETA_CREDITO' && !tarjetaId) {
      toast.error('Elegí la tarjeta')
      return
    }
    if (editing && !chequeLigado && esCheque && !chequeVencimientoNuevo) {
      toast.error('Completá la fecha de vencimiento del cheque')
      return
    }
    const duplicado = findDuplicateEgreso(obraId || undefined, montoNum, fecha)
    if (duplicado && duplicado.ref !== editRef) {
      setPendingDuplicate(duplicado)
      setPendingLoadAnother(loadAnother)
      return
    }
    if (editing) void doSaveEditing(montoNum)
    else void doSaveNuevo(loadAnother, montoNum)
  }

  return (
    <AppShell title={editing ? 'Editar egreso' : 'Nuevo egreso'} onBack={() => navigate(-1)}>
      {/* En desktop se acomoda en 2 columnas (pantalla web); en mobile queda en
          una sola columna, como el resto de los forms de alta (ver PresupuestoFormPage). */}
      <div className="max-w-md mx-auto w-full space-y-4 lg:max-w-none lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
        {editing?.comprobantePath && (
          <button onClick={handleVerComprobante} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-2xl text-sm text-primary font-medium lg:col-span-2">
            <FileText className="w-4 h-4" /> Ver comprobante
          </button>
        )}

        <Field label="Fecha">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </Field>

        <Field label="Venta (opcional si es gasto fijo)">
          <SearchableSelect options={obraOptions} value={obraId} onChange={setObraId} placeholder="Buscar venta o cliente..." />
        </Field>

        <Field label="Proveedor">
          <SearchableSelect options={proveedorOptions} value={proveedorId} onChange={setProveedorId} placeholder="Buscar proveedor..." />
        </Field>

        <Field label="Monto">
          <input type="number" min="0.01" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </Field>

        <Field label="Tipo de egreso" className="lg:col-span-2">
          <div className="flex gap-2 flex-wrap">
            {CONFIG_LISTS.TIPO_EGRESO.map(t => (
              <button
                key={t}
                onClick={() => setTipoEgreso(t)}
                className={`px-3 py-2 rounded-xl border text-sm ${tipoEgreso === t ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Categoría" className="lg:col-span-2">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIAS_EGRESO.map(c => (
              <button
                key={c}
                onClick={() => setCategoria(c)}
                className={`px-3 py-2 rounded-xl border text-sm ${categoria === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Caja">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCajaId('')}
              className={`px-3 py-2 rounded-xl border text-sm ${!cajaId ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
            >
              Sin especificar
            </button>
            {cajasDisponibles.map(c => (
              <button
                key={c.id}
                onClick={() => setCajaId(c.id)}
                className={`px-3 py-2 rounded-xl border text-sm ${cajaId === c.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
          {metodoSeleccionado && metodoSeleccionado.tipo !== 'INMEDIATO' && (
            <p className="text-xs text-muted-foreground mt-2">
              {metodoSeleccionado.nombre} deja rastro formal — solo se puede pagar desde una caja Blanca.
            </p>
          )}
        </Field>

        <Field label="Tipo de caja">
          <div className="flex gap-2">
            {CONFIG_LISTS.TIPO_CAJA.map(c => (
              <button
                key={c}
                onClick={() => setCaja(c)}
                disabled={!!cajaSeleccionada}
                className={`flex-1 py-2.5 rounded-xl border text-sm disabled:opacity-40 ${cajaTipo === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        {editing ? (
          <div className="lg:col-span-2 space-y-4">
            <Field label="Estado">
              <div className="flex gap-2">
                {ESTADOS_EGRESO.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEstado(e)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm ${estado === e ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </Field>

            {chequeLigado ? (
              <div className="p-4 rounded-2xl border border-border bg-muted/40 space-y-2">
                <p className="text-sm font-medium">
                  Cheque vinculado: {CHEQUE_ESTADO_STYLE[chequeLigado.estado].label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {chequeLigado.banco || 'Sin banco'}{chequeLigado.numero ? ` · Nº ${chequeLigado.numero}` : ''} · Vto. {formatDate(chequeLigado.fechaVencimiento)}
                </p>
                {chequeYaAvanzado ? (
                  <p className="text-xs text-muted-foreground">
                    Este cheque ya está "{CHEQUE_ESTADO_STYLE[chequeLigado.estado].label}" — para anularlo, cambiá su estado desde la tarjeta del egreso.
                  </p>
                ) : (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!quitarCheque} onChange={e => setQuitarCheque(!e.target.checked)} />
                    Mantener vinculado el cheque
                  </label>
                )}
                {!chequeYaAvanzado && quitarCheque && (
                  <p className="text-xs text-muted-foreground">
                    Se desvincula del egreso — el cheque sigue existiendo, no se anula.
                  </p>
                )}
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={esCheque} onChange={e => setEsCheque(e.target.checked)} />
                  Se paga con cheque
                </label>

                {esCheque && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-sm text-muted-foreground mb-1.5 block">Banco</label>
                      <input value={chequeBancoNuevo} onChange={e => setChequeBancoNuevo(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Número</label>
                      <input value={chequeNumeroNuevo} onChange={e => setChequeNumeroNuevo(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Fecha vencimiento</label>
                      <input type="date" value={chequeVencimientoNuevo} onChange={e => setChequeVencimientoNuevo(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <Field label="¿Cómo se paga?" className="lg:col-span-2">
            <div className="flex gap-2 flex-wrap">
              {metodosDisponibles.filter(m => m.activo).map(m => (
                <button
                  key={m.id}
                  onClick={() => setMetodoPagoId(m.id)}
                  className={`px-3 py-2 rounded-xl border text-sm ${metodoPagoId === m.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
            {cajaElegidaEsNegra && (
              <p className="text-xs text-muted-foreground mt-2">
                Caja Negra elegida arriba — solo admite Efectivo o Transferencia.
              </p>
            )}

            {metodoSeleccionado && !cajaId && (
              <p className="text-xs text-muted-foreground mt-2">
                Sin caja elegida arriba, usa la de {metodosPago.find(m => m.id === metodoPagoId)?.nombre} por defecto ({cajas.find(c => c.id === metodoSeleccionado.cajaId)?.nombre ?? 'sin definir'}).
              </p>
            )}

            {metodoSeleccionado?.tipo === 'CHEQUE' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground mb-1.5 block">Banco</label>
                  <input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Número</label>
                  <input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Fecha vencimiento</label>
                  <input type="date" value={chequeFechaVencimiento} onChange={e => setChequeFechaVencimiento(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                </div>
              </div>
            )}

            {metodoSeleccionado?.tipo === 'CUENTA_CORRIENTE' && (
              <div className="mt-3">
                <label className="text-sm text-muted-foreground mb-1.5 block">Vencimiento</label>
                <input
                  type="date"
                  value={fechaVencimientoCC}
                  onChange={e => setFechaVencimientoCC(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm"
                />
                {proveedorSeleccionado?.plazoDias && !fechaVencimientoCC && (
                  <p className="text-xs text-muted-foreground mt-1">Si lo dejás vacío, vence el {formatDate(addDaysLocal(fecha, proveedorSeleccionado.plazoDias))} (plazo del proveedor).</p>
                )}
              </div>
            )}

            {metodoSeleccionado?.tipo === 'TARJETA_CREDITO' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground mb-1.5 block">Tarjeta</label>
                  <div className="flex gap-2 flex-wrap">
                    {tarjetas.filter(t => t.activa).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTarjetaId(t.id)}
                        className={`px-3 py-2 rounded-xl border text-sm ${tarjetaId === t.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
                      >
                        {t.nombre}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Cuotas</label>
                  <input type="number" min="1" step="1" value={cuotas} onChange={e => setCuotas(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                </div>
              </div>
            )}
          </Field>
        )}

        <div className="flex gap-3 pt-2 lg:col-span-2">
          <button onClick={() => handleSave(true)} disabled={saving} className="flex-1 py-4 bg-white border border-border rounded-2xl font-medium text-sm disabled:opacity-50">
            Guardar y cargar otro
          </button>
          <button onClick={() => handleSave(false)} disabled={saving} className="flex-1 py-4 bg-primary text-white rounded-2xl font-semibold text-sm disabled:opacity-50">
            Guardar
          </button>
        </div>
      </div>

      <ConfirmModal
        open={!!pendingDuplicate}
        onOpenChange={open => !open && setPendingDuplicate(null)}
        title="Posible egreso duplicado"
        description={pendingDuplicate ? `Ya existe un egreso de ${formatCurrency(pendingDuplicate.monto)}${pendingDuplicate.id ? ` en ${pendingDuplicate.id}` : ''} el ${formatDate(pendingDuplicate.fecha)}. ¿Confirmás que este es un registro distinto?` : undefined}
        confirmLabel="Cargar igual"
        onConfirm={() => {
          setPendingDuplicate(null)
          const montoNum = toPositiveAmount(monto)
          if (!montoNum) return
          if (editing) void doSaveEditing(montoNum)
          else void doSaveNuevo(pendingLoadAnother, montoNum)
        }}
      />
    </AppShell>
  )
}
