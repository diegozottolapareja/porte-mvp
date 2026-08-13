import { CONFIG_LISTS, type CondicionPago, type TipoCaja } from '@/modules/porte'

export interface CondicionesComercialesDraft {
  condPago: CondicionPago | ''
  vencCobro: string
  cajaIntenc: TipoCaja | ''
  entregaCompr: string
  respOp: string
  dias: string
}

export const CONDICIONES_COMERCIALES_DRAFT_VACIO: CondicionesComercialesDraft = {
  condPago: '', vencCobro: '', cajaIntenc: '', entregaCompr: '', respOp: '', dias: '',
}

interface CondicionesComercialesFieldsProps {
  value: CondicionesComercialesDraft
  onChange: (patch: Partial<CondicionesComercialesDraft>) => void
}

// Paso 2 del flujo Presupuesto → Venta: se muestra en cuanto el estado
// comercial elegido es Aceptado, controlado por el padre (PresupuestoFormPage)
// que también posee el único botón de acción del formulario — entregaReal
// queda afuera a propósito, se completa después desde el detalle de la venta.
export function CondicionesComercialesFields({ value, onChange }: CondicionesComercialesFieldsProps) {
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
            <button key={c} type="button" onClick={() => onChange({ condPago: c })} className={`px-3 py-2 rounded-xl border text-sm ${value.condPago === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Vencimiento de cobro <span className="text-destructive">*</span></label>
          <input type="date" value={value.vencCobro} onChange={e => onChange({ vencCobro: e.target.value })} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Días</label>
          <input type="number" min="0" value={value.dias} onChange={e => onChange({ dias: e.target.value })} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 block">Caja intención <span className="text-destructive">*</span></label>
        <div className="flex gap-2">
          {CONFIG_LISTS.TIPO_CAJA.map(c => (
            <button key={c} type="button" onClick={() => onChange({ cajaIntenc: c })} className={`flex-1 py-2.5 rounded-xl border text-sm ${value.cajaIntenc === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 block">Entrega comprometida <span className="text-destructive">*</span></label>
        <input type="date" value={value.entregaCompr} onChange={e => onChange({ entregaCompr: e.target.value })} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 block">Responsable <span className="text-destructive">*</span></label>
        <div className="flex gap-2 flex-wrap">
          {CONFIG_LISTS.RESPONSABLE.map(r => (
            <button key={r} type="button" onClick={() => onChange({ respOp: r })} className={`px-3 py-2 rounded-xl border text-sm ${value.respOp === r ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{r}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
