import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Field } from '@/components/Field'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { CONFIG_LISTS, type TipoEgreso, type Cuenta, type TipoCaja, type Egreso, type EstadoEgreso } from '@/modules/porte'
import { useVentas, useProveedores, useEgresos, useEgresoActions, useMetodosPago, useTarjetas, useCajas, type PagoEgresoInput } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, todayLocal, addDaysLocal } from '@/lib/format'
import { toPositiveAmount } from '@/lib/validation'
import { supabase } from '@/lib/supabaseClient'

// Categoría directa/indirecta puede repetirse entre las dos listas (ej.
// SERVICIOS, HERRAMIENTAS) — se muestran una sola vez.
const CATEGORIAS_EGRESO = [...new Set([...CONFIG_LISTS.CATEG_DIRECTOS, ...CONFIG_LISTS.CATEG_INDIRECTOS])]
// "Incompleto" no es seleccionable a mano — mismo criterio que la pill de
// EgresosPage.tsx: es un estado derivado (ver validación de duplicados), no
// una transición manual válida.
const ESTADOS_EGRESO: EstadoEgreso[] = ['Confirmado', 'Pendiente', 'Emitido']

export default function EgresoFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const ventas = useVentas()
  const proveedores = useProveedores()
  const egresos = useEgresos()
  const metodosPago = useMetodosPago()
  const tarjetas = useTarjetas()
  const cajas = useCajas()
  const { addEgreso, updateEgreso, removeEgreso, findDuplicateEgreso, addEgresoConPago } = useEgresoActions()
  const [searchParams] = useSearchParams()
  const editRef = searchParams.get('ref')
  const obraIdParam = searchParams.get('obraId')
  const editing = editRef ? egresos.find(e => e.ref === editRef) : undefined
  // Si viene desde la ficha de venta, guardar tiene que volver ahí para ver el egreso listado.
  const volverA = obraIdParam ? `/ventas/${encodeURIComponent(obraIdParam)}` : undefined

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
  // Edición de un egreso ya cargado: mantiene el flag legacy tal cual estaba
  // (no se reinterpretan egresos viejos como si tuvieran un método de pago
  // nuevo — ver comentario de la sección "¿Cómo se paga?" más abajo).
  const [estado, setEstado] = useState<EstadoEgreso>(editing?.estado ?? 'Confirmado')
  const [esCheque, setEsCheque] = useState(!!editing?.fechaEmision)
  const [fechaEmision, setFechaEmision] = useState(editing?.fechaEmision ?? '')
  const [fechaAcreditacionLegacy, setFechaAcreditacionLegacy] = useState(editing?.fechaAcreditacion ?? '')

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

  const doSaveEditing = (montoNum: number) => {
    if (!user || !editing) return
    updateEgreso(editing.ref, {
      fecha, id: obraId || undefined, proveedor: proveedorId || undefined, tipoEgreso, categoria,
      monto: montoNum, cuenta, caja: cajaTipo, cajaId: cajaSeleccionada?.id,
      estado,
      fechaEmision: esCheque ? fechaEmision : undefined,
      fechaAcreditacion: esCheque ? fechaAcreditacionLegacy : undefined,
    })
    // TODO: reemplazar con api.put(`/egresos/${editing.ref}`, payload)
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
    const duplicado = findDuplicateEgreso(obraId || undefined, montoNum, fecha)
    if (duplicado && duplicado.ref !== editRef) {
      setPendingDuplicate(duplicado)
      setPendingLoadAnother(loadAnother)
      return
    }
    if (editing) doSaveEditing(montoNum)
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

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={esCheque} onChange={e => setEsCheque(e.target.checked)} />
              Es un cheque
            </label>

            {esCheque && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Fecha emisión</label>
                  <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Fecha acreditación</label>
                  <input type="date" value={fechaAcreditacionLegacy} onChange={e => setFechaAcreditacionLegacy(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
                </div>
              </div>
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
          if (editing) doSaveEditing(montoNum)
          else void doSaveNuevo(pendingLoadAnother, montoNum)
        }}
      />
    </AppShell>
  )
}
