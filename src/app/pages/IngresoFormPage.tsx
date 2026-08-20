import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { Field } from '@/components/Field'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { CONFIG_LISTS, type TipoIngreso, type Cuenta, type TipoCaja, type Ingreso, type EstadoIngreso, derivarAcreditacionIngreso } from '@/modules/porte'
import { useVentas, useIngresos, useIngresoActions, useMetodosCobro, useCajas } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, todayLocal } from '@/lib/format'
import { toPositiveAmount } from '@/lib/validation'

const ESTADOS_INGRESO: EstadoIngreso[] = ['Confirmado', 'Pendiente']

export default function IngresoFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const ventas = useVentas()
  const ingresos = useIngresos()
  const metodosCobro = useMetodosCobro()
  const cajas = useCajas()
  const { addIngreso, updateIngreso, removeIngreso, findDuplicateIngreso, addIngresoConCheque } = useIngresoActions()
  const [searchParams] = useSearchParams()
  const editRef = searchParams.get('ref')
  const obraIdParam = searchParams.get('obraId')
  const editing = editRef ? ingresos.find(i => i.ref === editRef) : undefined
  // Si viene desde la ficha de venta, guardar tiene que volver ahí para ver el ingreso listado.
  const volverA = obraIdParam ? `/ventas/${encodeURIComponent(obraIdParam)}` : undefined

  const [fecha, setFecha] = useState(editing?.fecha ?? todayLocal())
  const [obraId, setObraId] = useState(editing?.id ?? obraIdParam ?? '')
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngreso>(editing?.tipoIngreso ?? 'ANTICIPO')
  const [concepto, setConcepto] = useState(editing?.concepto ?? '')
  const [monto, setMonto] = useState(editing?.monto.toString() ?? '')
  const [caja, setCaja] = useState<TipoCaja>(editing?.caja ?? 'BLANCA')
  const [estado, setEstado] = useState<EstadoIngreso>(editing?.estado ?? 'Confirmado')
  const [metodoCobroId, setMetodoCobroId] = useState(editing?.metodoCobroId ?? '')
  // Cheque como medio de cobro (sección "Ingresos con cheque" del pedido):
  // solo para ingresos nuevos, mismo criterio que el bloque CHEQUE de
  // EgresoFormPage — editar un ingreso ya cargado con cheque no reabre estos
  // campos, el estado del cheque se avanza desde IngresosPage.
  const [chequeBanco, setChequeBanco] = useState('')
  const [chequeNumero, setChequeNumero] = useState('')
  const [chequeFechaVencimiento, setChequeFechaVencimiento] = useState('')
  const [pendingDuplicate, setPendingDuplicate] = useState<Ingreso | null>(null)
  const [pendingLoadAnother, setPendingLoadAnother] = useState(false)
  const [saving, setSaving] = useState(false)

  const obraOptions = ventas.map(v => ({ value: v.id, label: v.id, sublabel: v.cliente }))

  // Método de cobro (sección 4/22 del pedido): deriva caja destino, fecha de
  // acreditación, comisión y neto esperado — nunca hardcodeado. Es un preview
  // no persistido; la comisión/neto se recalculan siempre desde la config
  // vigente del método, no se guardan como snapshot.
  //
  // "Método de cobro" reemplaza al viejo selector de "Cuenta": ambos listaban
  // las mismas 4 cajas (Banco Macro/MercadoPago/Efectivo Blanco/Efectivo
  // Negro) — tener los dos era mostrar la misma elección dos veces. El
  // método ya trae la caja asociada (metodo.cajaId), así que no hace falta
  // un segundo campo para elegirla de nuevo.
  const metodoSeleccionado = metodosCobro.find(m => m.id === metodoCobroId)
  const esCheque = !editing && metodoSeleccionado?.tipo === 'CHEQUE'
  // Un cheque no se acredita a un plazo fijo (dias_acreditacion) — la fecha
  // real depende de cuándo se marque ACREDITADO (ver ChequeEstadoDialog en
  // IngresosPage), así que acá no hay derivado que mostrar ni guardar.
  const derivado = useMemo(() => {
    const montoNum = Number(monto)
    if (!metodoSeleccionado || esCheque || !fecha || !Number.isFinite(montoNum) || montoNum <= 0) return undefined
    return derivarAcreditacionIngreso(metodoSeleccionado, fecha, montoNum)
  }, [metodoSeleccionado, esCheque, fecha, monto])
  const cajaDestino = metodoSeleccionado?.cajaId ? cajas.find(c => c.id === metodoSeleccionado.cajaId) : undefined

  const doSaveEditing = (montoNum: number) => {
    if (!user || !editing) return
    updateIngreso(editing.ref, {
      fecha, id: obraId, tipoIngreso, concepto, monto: montoNum,
      cuenta: (cajaDestino?.nombre as Cuenta | undefined) ?? CONFIG_LISTS.CUENTAS[0],
      caja: (cajaDestino?.tipoCaja as TipoCaja | undefined) ?? caja,
      cajaId: cajaDestino?.id ?? undefined,
      estado,
      // Un ingreso ya cargado con cheque mantiene su fechaAcreditacion/chequeId
      // tal cual — se actualizan solo desde el flujo de estado del cheque,
      // nunca reescribiéndolos acá.
      ...(editing.chequeId ? {} : { metodoCobroId: metodoCobroId || undefined, fechaAcreditacion: derivado?.fechaAcreditacion }),
    })
    // TODO: reemplazar con api.put(`/ingresos/${editing.ref}`, { ... })
    toast.success('Ingreso actualizado')
    navigate(volverA ?? '/mis-registros')
  }

  const doSaveNuevo = async (loadAnother: boolean, montoNum: number) => {
    if (!user) return

    const basePayload = {
      fecha, id: obraId, tipoIngreso, concepto, monto: montoNum,
      cuenta: (cajaDestino?.nombre as Cuenta | undefined) ?? CONFIG_LISTS.CUENTAS[0],
      caja: (cajaDestino?.tipoCaja as TipoCaja | undefined) ?? caja,
      cajaId: cajaDestino?.id ?? undefined,
    }

    if (esCheque) {
      setSaving(true)
      const resultado = await addIngresoConCheque(
        { ...basePayload, metodoCobroId: metodoCobroId || undefined },
        { banco: chequeBanco || undefined, numero: chequeNumero || undefined, fechaVencimiento: chequeFechaVencimiento },
        user.id,
      )
      setSaving(false)
      if (!resultado.ok) {
        toast.error(resultado.error)
        return
      }
      toast.success(`Ingreso de ${formatCurrency(resultado.ingreso.monto)} cargado en ${resultado.ingreso.id}`, { duration: 5000 })
      if (loadAnother) { setConcepto(''); setMonto('') } else navigate(volverA ?? '/carga')
      return
    }

    const nuevo = addIngreso({
      ...basePayload, metodoCobroId: metodoCobroId || undefined, fechaAcreditacion: derivado?.fechaAcreditacion,
      estado: 'Confirmado',
    }, user.id)
    // TODO: reemplazar con api.post('/ingresos', nuevo)

    toast.success(`Ingreso de ${formatCurrency(nuevo.monto)} cargado en ${nuevo.id}`, {
      duration: 5000,
      action: { label: 'Deshacer', onClick: () => removeIngreso(nuevo.ref) },
    })

    if (loadAnother) {
      setConcepto('')
      setMonto('')
    } else {
      navigate(volverA ?? '/carga')
    }
  }

  const handleSave = (loadAnother: boolean) => {
    const montoNum = toPositiveAmount(monto)
    if (!obraId || !montoNum) {
      toast.error(!obraId ? 'Completá la venta' : 'El monto debe ser mayor a cero')
      return
    }
    if (esCheque && !chequeFechaVencimiento) {
      toast.error('Completá la fecha de vencimiento del cheque')
      return
    }
    const duplicado = findDuplicateIngreso(obraId, montoNum, fecha)
    if (duplicado && duplicado.ref !== editRef) {
      setPendingDuplicate(duplicado)
      setPendingLoadAnother(loadAnother)
      return
    }
    if (editing) doSaveEditing(montoNum)
    else void doSaveNuevo(loadAnother, montoNum)
  }

  return (
    <AppShell title={editing ? 'Editar ingreso' : 'Nuevo ingreso'} onBack={() => navigate(-1)}>
      {/* En desktop se acomoda en 2 columnas (pantalla web); en mobile queda en
          una sola columna, como el resto de los forms de alta (ver PresupuestoFormPage). */}
      <div className="max-w-md mx-auto w-full space-y-4 lg:max-w-none lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
        <Field label="Fecha">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </Field>

        <Field label="Venta">
          <SearchableSelect options={obraOptions} value={obraId} onChange={setObraId} placeholder="Buscar venta o cliente..." />
        </Field>

        <Field label="Tipo de ingreso">
          <div className="flex gap-2 flex-wrap">
            {CONFIG_LISTS.TIPO_INGRESO.map(t => (
              <button
                key={t}
                onClick={() => setTipoIngreso(t)}
                className={`px-3 py-2 rounded-xl border text-sm ${tipoIngreso === t ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Concepto">
          <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Anticipo 50%" className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </Field>

        <Field label="Monto">
          <input type="number" min="0.01" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </Field>

        <Field label="Caja" className="lg:col-span-2">
          <div className="flex gap-2">
            {CONFIG_LISTS.TIPO_CAJA.map(c => (
              <button
                key={c}
                onClick={() => setCaja(c)}
                disabled={!!metodoCobroId}
                className={`flex-1 py-2.5 rounded-xl border text-sm disabled:opacity-40 ${caja === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        {editing && (
          <Field label="Estado">
            <div className="flex gap-2">
              {ESTADOS_INGRESO.map(e => (
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
        )}

        <Field label="Método de cobro" className="lg:col-span-2">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setMetodoCobroId('')}
              className={`px-3 py-2 rounded-xl border text-sm ${!metodoCobroId ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
            >
              Sin especificar
            </button>
            {metodosCobro.filter(m => m.activo).map(m => (
              <button
                key={m.id}
                onClick={() => setMetodoCobroId(m.id)}
                disabled={!!editing}
                className={`px-3 py-2 rounded-xl border text-sm disabled:opacity-40 ${metodoCobroId === m.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
              >
                {m.nombre}
              </button>
            ))}
          </div>
          {derivado && cajaDestino && (
            <div className="mt-2 p-3 rounded-xl bg-muted text-xs text-muted-foreground space-y-0.5">
              <p>Caja destino: <span className="text-dark-graphite font-medium">{cajaDestino.nombre}</span></p>
              <p>Fecha de acreditación: <span className="text-dark-graphite font-medium">{formatDate(derivado.fechaAcreditacion)}</span></p>
              {derivado.comision > 0 && <p>Comisión: <span className="text-dark-graphite font-medium">{formatCurrency(derivado.comision)}</span></p>}
              <p>Neto esperado: <span className="text-dark-graphite font-medium">{formatCurrency(derivado.netoEsperado)}</span></p>
            </div>
          )}

          {esCheque && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <p className="col-span-2 text-xs text-muted-foreground">
                El ingreso queda registrado hoy, pero no suma a caja líquida hasta que el cheque se marque Acreditado (desde la lista de Ingresos).
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
                <label className="text-sm text-muted-foreground mb-1.5 block">Fecha vencimiento</label>
                <input type="date" value={chequeFechaVencimiento} onChange={e => setChequeFechaVencimiento(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
              </div>
            </div>
          )}
        </Field>

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
        title="Posible ingreso duplicado"
        description={pendingDuplicate ? `Ya existe un ingreso de ${formatCurrency(pendingDuplicate.monto)} en ${pendingDuplicate.id} el ${formatDate(pendingDuplicate.fecha)}. ¿Confirmás que este es un registro distinto?` : undefined}
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
