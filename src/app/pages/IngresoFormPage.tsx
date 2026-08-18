import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { Field } from '@/components/Field'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ConfirmModal } from '@/components/ConfirmModal'
import { CONFIG_LISTS, type TipoIngreso, type Cuenta, type TipoCaja, type Ingreso, derivarAcreditacionIngreso } from '@/modules/porte'
import { useVentas, useIngresos, useIngresoActions, useMetodosCobro, useCajas } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, todayLocal } from '@/lib/format'
import { toPositiveAmount } from '@/lib/validation'

export default function IngresoFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const ventas = useVentas()
  const ingresos = useIngresos()
  const metodosCobro = useMetodosCobro()
  const cajas = useCajas()
  const { addIngreso, updateIngreso, removeIngreso, findDuplicateIngreso } = useIngresoActions()
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
  const [metodoCobroId, setMetodoCobroId] = useState(editing?.metodoCobroId ?? '')
  const [pendingDuplicate, setPendingDuplicate] = useState<Ingreso | null>(null)
  const [pendingLoadAnother, setPendingLoadAnother] = useState(false)

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
  const derivado = useMemo(() => {
    const montoNum = Number(monto)
    if (!metodoSeleccionado || !fecha || !Number.isFinite(montoNum) || montoNum <= 0) return undefined
    return derivarAcreditacionIngreso(metodoSeleccionado, fecha, montoNum)
  }, [metodoSeleccionado, fecha, monto])
  const cajaDestino = metodoSeleccionado?.cajaId ? cajas.find(c => c.id === metodoSeleccionado.cajaId) : undefined

  const doSave = (loadAnother: boolean, montoNum: number) => {
    if (!user) return

    const payload = {
      fecha, id: obraId, tipoIngreso, concepto, monto: montoNum,
      cuenta: (cajaDestino?.nombre as Cuenta | undefined) ?? CONFIG_LISTS.CUENTAS[0],
      caja: (cajaDestino?.tipoCaja as TipoCaja | undefined) ?? caja,
      metodoCobroId: metodoCobroId || undefined, fechaAcreditacion: derivado?.fechaAcreditacion,
      cajaId: cajaDestino?.id ?? undefined,
    }

    if (editing) {
      updateIngreso(editing.ref, payload)
      // TODO: reemplazar con api.put(`/ingresos/${editing.ref}`, { ... })
      toast.success('Ingreso actualizado')
      navigate(volverA ?? '/mis-registros')
      return
    }

    const nuevo = addIngreso({ ...payload, estado: 'Confirmado' }, user.id)
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
    const duplicado = findDuplicateIngreso(obraId, montoNum, fecha)
    if (duplicado && duplicado.ref !== editRef) {
      setPendingDuplicate(duplicado)
      setPendingLoadAnother(loadAnother)
      return
    }
    doSave(loadAnother, montoNum)
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
                className={`px-3 py-2 rounded-xl border text-sm ${metodoCobroId === m.id ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}
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
        </Field>

        <div className="flex gap-3 pt-2 lg:col-span-2">
          <button onClick={() => handleSave(true)} className="flex-1 py-4 bg-white border border-border rounded-2xl font-medium text-sm">
            Guardar y cargar otro
          </button>
          <button onClick={() => handleSave(false)} className="flex-1 py-4 bg-primary text-white rounded-2xl font-semibold text-sm">
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
          if (montoNum) doSave(pendingLoadAnother, montoNum)
        }}
      />
    </AppShell>
  )
}
