import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { CONFIG_LISTS, presupuestoTieneVentaAsociada, type Categoria, type EstadoComercial } from '@/modules/porte'
import { usePorteData } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '@/lib/format'

export default function PresupuestoFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { id } = useParams()
  const { presupuestos, ventas, addPresupuesto, updatePresupuesto, aceptarPresupuesto, nextPresupuestoId } = usePorteData()
  const existing = id ? presupuestos.find(p => p.id === decodeURIComponent(id)) : undefined

  const [cliente, setCliente] = useState(existing?.cliente ?? '')
  const [descripcion, setDescripcion] = useState(existing?.descripcion ?? '')
  const [categoria, setCategoria] = useState<Categoria>(existing?.categoria ?? CONFIG_LISTS.CATEGORIA[0])
  const [responsable, setResponsable] = useState(existing?.responsable ?? CONFIG_LISTS.RESPONSABLE[0])
  const [costoMat, setCostoMat] = useState(existing?.costoMat?.toString() ?? '')
  const [costoMo, setCostoMo] = useState(existing?.costoMo?.toString() ?? '')
  const [indVendidos, setIndVendidos] = useState(existing?.indVendidos?.toString() ?? '')
  const [impuestos, setImpuestos] = useState(existing?.impuestos?.toString() ?? '')
  const [comercial, setComercial] = useState(existing?.comercial?.toString() ?? '')
  const [beneficio, setBeneficio] = useState(existing?.beneficio?.toString() ?? '')
  const [estadoComercial, setEstadoComercial] = useState<EstadoComercial>(existing?.estadoComercial ?? 'Pedido')
  const [vencimiento, setVencimiento] = useState(existing?.vencimiento ?? '')
  const [observaciones, setObservaciones] = useState(existing?.observaciones ?? '')

  const costos = [costoMat, costoMo, indVendidos, impuestos, comercial, beneficio].map(v => Number(v))
  const montoTotal = costos.every((_, i) => [costoMat, costoMo, indVendidos, impuestos, comercial, beneficio][i] !== '')
    ? costos.reduce((sum, v) => sum + v, 0)
    : undefined

  const handleSave = () => {
    if (!cliente || !user) {
      toast.error('Completá el cliente')
      return
    }

    const payload = {
      cliente, descripcion, categoria, responsable,
      costoMat: costoMat === '' ? undefined : Number(costoMat),
      costoMo: costoMo === '' ? undefined : Number(costoMo),
      indVendidos: indVendidos === '' ? undefined : Number(indVendidos),
      impuestos: impuestos === '' ? undefined : Number(impuestos),
      comercial: comercial === '' ? undefined : Number(comercial),
      beneficio: beneficio === '' ? undefined : Number(beneficio),
      montoTotal,
      estadoComercial,
      vencimiento: vencimiento || undefined,
      observaciones: observaciones || undefined,
      enviado: existing?.enviado ?? false,
    }

    if (existing) {
      const pasaAAceptado = existing.estadoComercial !== 'Aceptado' && estadoComercial === 'Aceptado'
      const dejaDeEstarAceptado = existing.estadoComercial === 'Aceptado' && estadoComercial !== 'Aceptado'

      if (pasaAAceptado) {
        const resultado = aceptarPresupuesto(existing.id, user.id, payload)
        // TODO: reemplazar con api.put(`/presupuestos/${existing.id}`, payload) — la transición vive en el backend
        if (!resultado.ok) {
          toast.error(resultado.error)
          return
        }
        toast.success(`Presupuesto ${existing.id} aceptado — venta creada`, {
          action: { label: 'Ver venta', onClick: () => navigate(`/ventas/${encodeURIComponent(existing.id)}`) },
        })
        navigate('/presupuestos')
        return
      }

      if (dejaDeEstarAceptado && presupuestoTieneVentaAsociada(existing.id, ventas)) {
        toast.warning(`Este presupuesto ya generó una venta (${existing.id}). Cambiar el estado no la elimina; si fue un error, corregilo manualmente en Ventas.`)
      }

      updatePresupuesto(existing.id, payload)
      // TODO: reemplazar con api.put(`/presupuestos/${existing.id}`, payload)
      toast.success('Presupuesto actualizado')
    } else {
      const nuevoId = nextPresupuestoId()
      addPresupuesto({ id: nuevoId, fecha: new Date().toISOString().slice(0, 10), ...payload }, user.id)
      // TODO: reemplazar con api.post('/presupuestos', { id: nuevoId, ...payload })
      toast.success(`Presupuesto ${nuevoId} creado`)
    }

    navigate('/presupuestos')
  }

  return (
    <AppShell title={existing ? existing.id : 'Nuevo presupuesto'} onBack={() => navigate(-1)}>
      <div className="max-w-md mx-auto w-full space-y-4 lg:max-w-none lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
        <Field label="Cliente" required><input value={cliente} onChange={e => setCliente(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
        <Field label="Descripción"><input value={descripcion} onChange={e => setDescripcion(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>

        <Field label="Categoría">
          <div className="flex gap-2 flex-wrap">
            {CONFIG_LISTS.CATEGORIA.map(c => (
              <button key={c} onClick={() => setCategoria(c)} className={`px-3 py-2 rounded-xl border text-sm ${categoria === c ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{c}</button>
            ))}
          </div>
        </Field>

        <Field label="Responsable">
          <div className="flex gap-2 flex-wrap">
            {CONFIG_LISTS.RESPONSABLE.map(r => (
              <button key={r} onClick={() => setResponsable(r)} className={`px-3 py-2 rounded-xl border text-sm ${responsable === r ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{r}</button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-3">
          <Field label="Costo materiales"><input type="number" value={costoMat} onChange={e => setCostoMat(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Costo M.O."><input type="number" value={costoMo} onChange={e => setCostoMo(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Indirectos"><input type="number" value={indVendidos} onChange={e => setIndVendidos(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Impuestos"><input type="number" value={impuestos} onChange={e => setImpuestos(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Comercial"><input type="number" value={comercial} onChange={e => setComercial(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Beneficio"><input type="number" value={beneficio} onChange={e => setBeneficio(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
        </div>

        <div className="bg-primary/5 rounded-2xl p-4 flex items-center justify-between lg:col-span-2">
          <p className="text-sm text-muted-foreground">Monto total (calculado)</p>
          <p className="text-lg font-semibold text-primary">{montoTotal !== undefined ? formatCurrency(montoTotal) : 'Sin cotizar'}</p>
        </div>

        <Field label="Estado comercial" className="lg:col-span-2">
          <div className="flex gap-2 flex-wrap">
            {CONFIG_LISTS.ESTADO_COMERCIAL.map(e => (
              <button key={e} onClick={() => setEstadoComercial(e)} className={`px-3 py-2 rounded-xl border text-xs ${estadoComercial === e ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground'}`}>{e}</button>
            ))}
          </div>
        </Field>

        <Field label="Vencimiento"><input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
        <Field label="Observaciones"><textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-2xl border border-border bg-white text-sm" /></Field>

        <button onClick={handleSave} className="w-full py-4 bg-primary text-white rounded-2xl font-semibold text-sm lg:col-span-2">
          Guardar presupuesto
        </button>
      </div>
    </AppShell>
  )
}

function Field({ label, required, className = '', children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="text-sm text-muted-foreground mb-1.5 block">{label}{required && <span className="text-destructive"> *</span>}</label>
      {children}
    </div>
  )
}
