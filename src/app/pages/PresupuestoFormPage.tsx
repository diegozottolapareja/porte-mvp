import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { AppShell } from '@/components/AppShell'
import { CondicionesComercialesFields, CONDICIONES_COMERCIALES_DRAFT_VACIO, type CondicionesComercialesDraft } from '@/components/CondicionesComercialesFields'
import { CONFIG_LISTS, validarCondicionesComerciales, presupuestoTieneVentaAsociada, type Categoria, type EstadoComercial, type CondicionPago, type TipoCaja } from '@/modules/porte'
import { usePresupuestos, useVentas, useClientes, usePresupuestoActions } from '@/modules/porte/store'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, localDateString, todayLocal } from '@/lib/format'
import { isNegativeAmount } from '@/lib/validation'

export default function PresupuestoFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { id } = useParams()
  const presupuestos = usePresupuestos()
  const ventas = useVentas()
  const clientes = useClientes()
  const { addPresupuesto, updatePresupuesto, convertirEnVenta, nextPresupuestoId } = usePresupuestoActions()
  const existing = id ? presupuestos.find(p => p.id === decodeURIComponent(id)) : undefined
  const clientesActivos = clientes.filter(c => c.activo)

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
  // Un presupuesto nuevo vence a las 48hs de creado por defecto — el usuario puede cambiarlo.
  const [vencimiento, setVencimiento] = useState(existing?.vencimiento ?? localDateString(new Date(Date.now() + 48 * 60 * 60 * 1000)))
  const [observaciones, setObservaciones] = useState(existing?.observaciones ?? '')
  const [condiciones, setCondiciones] = useState<CondicionesComercialesDraft>(CONDICIONES_COMERCIALES_DRAFT_VACIO)
  const [convirtiendo, setConvirtiendo] = useState(false)

  const costoValues = [costoMat, costoMo, indVendidos, impuestos, comercial, beneficio]
  const hayAlgunCostoCargado = costoValues.some(v => v !== '')
  const montoTotal = hayAlgunCostoCargado
    ? costoValues.reduce((sum, v) => sum + (v === '' ? 0 : Number(v)), 0)
    : undefined

  // Un presupuesto ya convertido no puede volver a mutar en "Crear venta" —
  // el único botón se comporta como guardado normal aunque siga Aceptado.
  const yaConvertido = !!existing && presupuestoTieneVentaAsociada(existing.id, ventas)
  // Requiere `existing`: la Venta tiene una FK contra presupuestos.id, así que
  // no se puede convertir algo que todavía no se guardó en la base.
  const modoCrearVenta = !!existing && estadoComercial === 'Aceptado' && !yaConvertido
  const puedeConvertir = modoCrearVenta && !validarCondicionesComerciales({
    condPago: condiciones.condPago || undefined,
    vencCobro: condiciones.vencCobro || undefined,
    cajaIntenc: condiciones.cajaIntenc || undefined,
    entregaCompr: condiciones.entregaCompr || undefined,
    respOp: condiciones.respOp || undefined,
  })

  const handlePrimaryAction = async () => {
    if (!cliente || !user) {
      toast.error('Elegí un cliente')
      return
    }
    // La regla "no crear presupuesto sin cliente existente" solo aplica al alta —
    // el trigger de la base (trg_validar_cliente_presupuesto) también es solo INSERT.
    if (!existing && !clientesActivos.some(c => c.nombre.trim().toLowerCase() === cliente.trim().toLowerCase())) {
      toast.error('El cliente no existe — crealo primero desde Clientes')
      return
    }
    if (costoMat === '' || costoMo === '') {
      toast.error('Costo materiales y Costo M.O. son obligatorios')
      return
    }

    const costoFields: Array<[string, string]> = [
      ['Costo materiales', costoMat], ['Costo M.O.', costoMo], ['Indirectos', indVendidos],
      ['Impuestos', impuestos], ['Comercial', comercial], ['Beneficio', beneficio],
    ]
    const costoNegativo = costoFields.find(([, v]) => isNegativeAmount(v))
    if (costoNegativo) {
      toast.error(`${costoNegativo[0]} no puede ser negativo`)
      return
    }
    if (montoTotal !== undefined && montoTotal <= 0) {
      toast.error('El monto total debe ser mayor a cero')
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

    if (!modoCrearVenta) {
      if (existing) {
        const dejaDeEstarAceptado = existing.estadoComercial === 'Aceptado' && estadoComercial !== 'Aceptado'
        if (dejaDeEstarAceptado && yaConvertido) {
          toast.warning(`Este presupuesto ya generó una venta (${existing.id}). Cambiar el estado no la elimina; si fue un error, corregilo manualmente en Ventas.`)
        }
        updatePresupuesto(existing.id, payload)
        toast.success('Presupuesto actualizado')
      } else {
        const nuevoId = nextPresupuestoId()
        addPresupuesto({ id: nuevoId, fecha: todayLocal(), ...payload }, user.id)
        toast.success(`Presupuesto ${nuevoId} creado`)
      }
      navigate('/presupuestos')
      return
    }

    if (!existing || !puedeConvertir || convirtiendo) return
    setConvirtiendo(true)
    try {
      const resultado = await convertirEnVenta(existing.id, {
        condPago: condiciones.condPago as CondicionPago,
        vencCobro: condiciones.vencCobro,
        cajaIntenc: condiciones.cajaIntenc as TipoCaja,
        entregaCompr: condiciones.entregaCompr,
        respOp: condiciones.respOp.trim(),
        dias: condiciones.dias === '' ? undefined : Number(condiciones.dias),
      }, user.id, payload)
      if (!resultado.ok) {
        toast.error(resultado.error)
        return
      }
      toast.success(`Venta ${resultado.venta.id} creada`, {
        action: { label: 'Ver venta', onClick: () => navigate(`/ventas/${encodeURIComponent(resultado.venta.id)}`) },
      })
      navigate(`/ventas/${encodeURIComponent(resultado.venta.id)}`)
    } finally {
      setConvirtiendo(false)
    }
  }

  // Si el presupuesto existente quedó con un cliente que ya no está activo
  // (baja posterior), lo mostramos igual para no pisarlo silenciosamente al guardar.
  const clienteExistenteInactivo = existing && cliente
    && !clientesActivos.some(c => c.nombre.trim().toLowerCase() === cliente.trim().toLowerCase())
    ? cliente
    : undefined

  return (
    <AppShell title={existing ? existing.id : 'Nuevo presupuesto'} onBack={() => navigate(-1)}>
      <div className="max-w-md mx-auto w-full space-y-4 lg:max-w-none lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
        <Field label="Cliente" required>
          {clientesActivos.length === 0 ? (
            <div className="flex items-center justify-between h-12 px-4 rounded-2xl border border-dashed border-border bg-white text-sm text-muted-foreground">
              <span>No hay clientes cargados</span>
              <button type="button" onClick={() => navigate('/clientes')} className="text-primary font-medium">Crear cliente</button>
            </div>
          ) : (
            <select value={cliente} onChange={e => setCliente(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm">
              <option value="">Elegí un cliente...</option>
              {clienteExistenteInactivo && <option value={clienteExistenteInactivo}>{clienteExistenteInactivo} (inactivo)</option>}
              {clientesActivos.map(c => (
                <option key={c.idCli} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
          )}
        </Field>
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
          <Field label="Costo materiales" required><input type="number" min="0" value={costoMat} onChange={e => setCostoMat(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Costo M.O." required><input type="number" min="0" value={costoMo} onChange={e => setCostoMo(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Indirectos"><input type="number" min="0" value={indVendidos} onChange={e => setIndVendidos(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Impuestos"><input type="number" min="0" value={impuestos} onChange={e => setImpuestos(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Comercial"><input type="number" min="0" value={comercial} onChange={e => setComercial(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
          <Field label="Beneficio"><input type="number" min="0" value={beneficio} onChange={e => setBeneficio(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
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

        {modoCrearVenta && <CondicionesComercialesFields value={condiciones} onChange={patch => setCondiciones(prev => ({ ...prev, ...patch }))} />}

        <Field label="Vencimiento"><input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-border bg-white text-sm" /></Field>
        <Field label="Observaciones"><textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-2xl border border-border bg-white text-sm" /></Field>

        <button
          onClick={handlePrimaryAction}
          disabled={modoCrearVenta && (!puedeConvertir || convirtiendo)}
          className="w-full py-4 bg-primary text-white rounded-2xl font-semibold text-sm lg:col-span-2 disabled:opacity-40"
        >
          {modoCrearVenta ? (convirtiendo ? 'Creando venta...' : 'Crear venta') : 'Guardar presupuesto'}
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
