import { useState } from 'react'
import { toast } from 'sonner'
import { CONFIG_LISTS, validarCondicionesComerciales, type CondicionPago, type TipoCaja, type CondicionesComerciales } from '@/modules/porte'

interface CondicionesComercialesFormProps {
  onConvertir: (condiciones: CondicionesComerciales) => void
  submitting?: boolean
}

// Paso 2 del flujo Presupuesto → Venta: se muestra cuando el presupuesto ya
// está Aceptado pero todavía no generó una venta. Recién al completar estos
// campos se habilita "Convertir en venta" — entregaReal queda afuera a
// propósito, se completa después desde el detalle de la venta.
export function CondicionesComercialesForm({ onConvertir, submitting = false }: CondicionesComercialesFormProps) {
  const [condPago, setCondPago] = useState<CondicionPago | ''>('')
  const [vencCobro, setVencCobro] = useState('')
  const [cajaIntenc, setCajaIntenc] = useState<TipoCaja | ''>('')
  const [entregaCompr, setEntregaCompr] = useState('')
  const [respOp, setRespOp] = useState('')
  const [dias, setDias] = useState('')

  const condiciones: Partial<CondicionesComerciales> = {
    condPago: condPago || undefined,
    vencCobro: vencCobro || undefined,
    cajaIntenc: cajaIntenc || undefined,
    entregaCompr: entregaCompr || undefined,
    respOp: respOp || undefined,
  }
  const puedeConvertir = !validarCondicionesComerciales(condiciones)

  const handleConvertir = () => {
    if (!puedeConvertir || submitting) {
      if (!puedeConvertir) toast.error('Completá condición de pago, vencimiento de cobro, caja intención, entrega comprometida y responsable')
      return
    }
    onConvertir({
      condPago: condPago as CondicionPago,
      vencCobro,
      cajaIntenc: cajaIntenc as TipoCaja,
      entregaCompr,
      respOp: respOp.trim(),
      dias: dias === '' ? undefined : Number(dias),
    })
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-4 lg:col-span-2">
      <div>
        <p className="text-sm font-semibold text-primary">Condiciones comerciales</p>
        <p className="text-xs text-muted-foreground mt-0.5">Presupuesto aceptado — completá estos datos para convertirlo en venta.</p>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 block">Condición de pago <span className="text-destructive">*</span></label>
        <div className="flex gap-2 flex-wrap">
          {CONFIG_LISTS.CONDICION_PAGO.map(c => (
            <button key={c} type="button" onClick={() => setCondPago(c)} className={`px-3 py-2 rounded-xl border text-sm ${condPago === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Vencimiento de cobro <span className="text-destructive">*</span></label>
          <input type="date" value={vencCobro} onChange={e => setVencCobro(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Días</label>
          <input type="number" min="0" value={dias} onChange={e => setDias(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 block">Caja intención <span className="text-destructive">*</span></label>
        <div className="flex gap-2">
          {CONFIG_LISTS.TIPO_CAJA.map(c => (
            <button key={c} type="button" onClick={() => setCajaIntenc(c)} className={`flex-1 py-2.5 rounded-xl border text-sm ${cajaIntenc === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 block">Entrega comprometida <span className="text-destructive">*</span></label>
        <input type="date" value={entregaCompr} onChange={e => setEntregaCompr(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 block">Responsable <span className="text-destructive">*</span></label>
        <div className="flex gap-2 flex-wrap">
          {CONFIG_LISTS.RESPONSABLE.map(r => (
            <button key={r} type="button" onClick={() => setRespOp(r)} className={`px-3 py-2 rounded-xl border text-sm ${respOp === r ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{r}</button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleConvertir}
        disabled={!puedeConvertir || submitting}
        className="w-full py-4 bg-primary text-white rounded-2xl font-semibold text-sm disabled:opacity-40"
      >
        {submitting ? 'Convirtiendo...' : 'Convertir en venta'}
      </button>
    </div>
  )
}
