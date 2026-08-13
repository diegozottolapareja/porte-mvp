import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/app/contexts/AuthContext'
import type { Ingreso } from './data/ingresos'
import type { Egreso } from './data/egresos'
import type { Presupuesto } from './data/presupuestos'
import type { Venta } from './data/ventas'
import type { Proveedor } from './data/proveedores'
import type { Cliente, ClienteUpdate } from './data/clientes'
import type { GastoFijo } from './data/gastosFijos'
import type { Variacion } from './data/variaciones'
import type { Aprendizaje } from './data/aprendizajes'
import { validarPresupuestoParaVenta, construirVentaDesdePresupuesto, validarCondicionesComerciales, type CondicionesComerciales } from './calculos'
import {
  rowToIngreso, ingresoToRow, rowToEgreso, egresoToRow, rowToPresupuesto, presupuestoToRow,
  rowToVenta, ventaToRow, rowToProveedor, proveedorToRow, rowToCliente, clienteToRow, rowToGastoFijo, gastoFijoToRow,
  rowToVariacion, variacionToRow, rowToAprendizaje, aprendizajeToRow,
} from './mappers'

// ─── Store conectado a Supabase ───────────────────────────────────────────────
// Carga inicial desde las tablas reales. Las mutaciones actualizan el estado
// local de inmediato (misma UX que antes) y persisten en Supabase en paralelo;
// RLS es la barrera real de escritura, esto es solo la capa de UI.

function logPersistError(op: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[porte-store] ${op} falló al persistir en Supabase:`, error)
}

function nextRef(prefix: string, items: Array<{ ref?: string }>): string {
  const max = items.reduce((acc, i) => {
    const n = i.ref ? Number(i.ref.replace(`${prefix}-`, '')) : 0
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}

function nextSeqId(prefix: string, ids: string[]): string {
  const max = ids.reduce((acc, id) => {
    const n = Number(id.replace(`${prefix}-`, ''))
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}

interface PorteDataContextType {
  isLoading: boolean
  ingresos: Ingreso[]
  egresos: Egreso[]
  presupuestos: Presupuesto[]
  ventas: Venta[]
  proveedores: Proveedor[]
  clientes: Cliente[]
  gastosFijos: GastoFijo[]
  variaciones: Variacion[]
  aprendizajes: Aprendizaje[]

  addIngreso: (data: Omit<Ingreso, 'ref' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Ingreso
  addEgreso: (data: Omit<Egreso, 'ref' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Egreso
  addPresupuesto: (data: Omit<Presupuesto, 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Presupuesto
  addVenta: (data: Omit<Venta, 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Venta
  addProveedor: (data: Omit<Proveedor, 'idProv' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Proveedor
  addCliente: (data: Omit<Cliente, 'idCli' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Cliente
  /**
   * Da de alta el cliente en el maestro si el nombre (case-insensitive) no
   * existe todavía — usado al cargar un presupuesto o una venta con un
   * nombre de cliente en texto libre, para que el maestro de Clientes se
   * mantenga sincronizado sin pedirle un paso extra al usuario.
   */
  findOrCreateCliente: (nombre: string, userId: string) => Cliente
  addGastoFijo: (data: Omit<GastoFijo, 'id' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => GastoFijo
  addVariacion: (data: Omit<Variacion, 'idVar' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Variacion
  addAprendizaje: (data: Omit<Aprendizaje, 'idApr' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Aprendizaje

  updateIngreso: (ref: string, data: Partial<Ingreso>) => void
  updateEgreso: (ref: string, data: Partial<Egreso>) => void
  updatePresupuesto: (id: string, data: Partial<Presupuesto>) => void
  updateVenta: (id: string, data: Partial<Venta>) => void
  updateProveedor: (idProv: string, data: Partial<Proveedor>) => void
  updateCliente: (idCli: string, data: ClienteUpdate) => void
  updateGastoFijo: (id: string, data: Partial<GastoFijo>) => void
  updateVariacion: (idVar: string, data: Partial<Variacion>) => void
  updateAprendizaje: (idApr: string, data: Partial<Aprendizaje>) => void

  /**
   * Re-lee todas las tablas desde Supabase. Necesario después de mutaciones que
   * pasan por afuera del store (ej. el asistente crea presupuestos/egresos/ingresos
   * vía el backend con service role) — sin esto, el usuario ve el dato recién
   * creado solo al recargar la página.
   */
  refetch: () => Promise<void>

  nextPresupuestoId: () => string

  /**
   * Paso 1 del flujo Presupuesto → Venta: solo cambia estadoComercial a
   * 'Aceptado'. Ya NO crea la venta — eso pasa recién en convertirEnVenta(),
   * una vez completas las condiciones comerciales.
   */
  aceptarPresupuesto: (
    id: string,
    overrides?: Partial<Presupuesto>,
  ) => { ok: true } | { ok: false; error: string }

  /**
   * Paso 2: crea la Venta congelando los costos del presupuesto + las
   * condiciones comerciales cargadas. Requiere que el presupuesto esté
   * 'Aceptado' (ya sea porque ya lo estaba, o porque `overrides` lo marca así
   * en el mismo llamado) y que todavía no tenga una venta asociada
   * (idempotente). Valida del lado del cliente para feedback inmediato — el
   * trigger de la base (trg_validar_condiciones_comerciales) es la barrera
   * real. A diferencia del resto de las mutaciones del store, espera la
   * confirmación real de Supabase antes de tocar el estado local: es el único
   * flujo donde una inserción puede fallar legítimamente (trigger o PK
   * duplicada por doble submit) y un "éxito" optimista dejaría una venta
   * fantasma.
   *
   * `overrides`: cambios de edición del presupuesto todavía no guardados
   * (típicamente incluye estadoComercial: 'Aceptado') que se aplican acá en
   * memoria antes de validar/construir la venta, y se persisten recién si la
   * venta se creó con éxito. Permite "Aceptar + Convertir" en un solo click
   * sin encadenar dos llamadas al store (que verían estado stale entre sí).
   */
  convertirEnVenta: (
    presupuestoId: string,
    condiciones: CondicionesComerciales,
    userId: string,
    overrides?: Partial<Presupuesto>,
  ) => Promise<{ ok: true; venta: Venta } | { ok: false; error: string }>

  removeIngreso: (ref: string) => void
  removeEgreso: (ref: string) => void

  softDeleteIngreso: (ref: string) => void
  softDeleteEgreso: (ref: string) => void
  softDeletePresupuesto: (id: string) => void
  softDeleteProveedor: (idProv: string) => void
  softDeleteCliente: (idCli: string) => void
  softDeleteGastoFijo: (id: string) => void
  softDeleteVariacion: (idVar: string) => void
  softDeleteAprendizaje: (idApr: string) => void

  findDuplicateIngreso: (obraId: string, monto: number, fecha: string) => Ingreso | undefined
  findDuplicateEgreso: (obraId: string | undefined, monto: number, fecha: string) => Egreso | undefined
}

const PorteDataContext = createContext<PorteDataContextType | undefined>(undefined)

export function PorteDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
  const [variaciones, setVariaciones] = useState<Variacion[]>([])
  const [aprendizajes, setAprendizajes] = useState<Aprendizaje[]>([])

  // Guarda contra setState después de un logout mientras un refetch está en
  // vuelo — refetch() se expone al resto de la app (ej. el asistente) y ya no
  // corre solo dentro del useEffect de abajo, así que no puede depender del
  // closure `cancelled` de un solo montaje.
  const authGuardRef = useRef(isAuthenticated)
  useEffect(() => { authGuardRef.current = isAuthenticated }, [isAuthenticated])

  const loadAll = useCallback(async () => {
    const [ing, egr, pre, ven, prov, cli, gf, vcar, apr] = await Promise.all([
      supabase.from('ingresos').select('*').order('created_at', { ascending: false }),
      supabase.from('egresos').select('*').order('created_at', { ascending: false }),
      supabase.from('presupuestos').select('*').order('created_at', { ascending: false }),
      supabase.from('v_ventas_detalle').select('*').order('created_at', { ascending: false }),
      supabase.from('v_proveedores_saldo').select('*'),
      supabase.from('clientes').select('*').order('created_at', { ascending: false }),
      supabase.from('gastos_fijos').select('*').order('created_at', { ascending: false }),
      supabase.from('variaciones').select('*').order('created_at', { ascending: false }),
      supabase.from('aprendizajes').select('*').order('created_at', { ascending: false }),
    ])
    if (!authGuardRef.current) return
    if (ing.data) setIngresos(ing.data.map(rowToIngreso))
    if (egr.data) setEgresos(egr.data.map(rowToEgreso))
    if (pre.data) setPresupuestos(pre.data.map(rowToPresupuesto))
    if (ven.data) setVentas(ven.data.map(rowToVenta))
    if (prov.data) setProveedores(prov.data.map(rowToProveedor))
    if (cli.data) setClientes(cli.data.map(rowToCliente))
    if (gf.data) setGastosFijos(gf.data.map(rowToGastoFijo))
    if (vcar.data) setVariaciones(vcar.data.map(rowToVariacion))
    if (apr.data) setAprendizajes(apr.data.map(rowToAprendizaje))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setIngresos([]); setEgresos([]); setPresupuestos([]); setVentas([])
      setProveedores([]); setClientes([]); setGastosFijos([]); setVariaciones([]); setAprendizajes([])
      setIsLoading(true)
      return
    }

    loadAll()

    // Re-fetch al volver a la pestaña: el store solo carga una vez al montar,
    // así que sin esto una sesión ya abierta no ve datos cargados por otro usuario.
    function onVisible() {
      if (document.visibilityState === 'visible') loadAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [isAuthenticated, loadAll])

  const addIngreso: PorteDataContextType['addIngreso'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Ingreso = { ...data, ref: nextRef('IN', ingresos), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setIngresos(prev => [nuevo, ...prev])
    supabase.from('ingresos').insert({ ...ingresoToRow(nuevo), ref: nuevo.ref, created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addIngreso', error) })
    return nuevo
  }

  const addEgreso: PorteDataContextType['addEgreso'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Egreso = { ...data, ref: nextRef('EG', egresos), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setEgresos(prev => [nuevo, ...prev])
    supabase.from('egresos').insert({ ...egresoToRow(nuevo), ref: nuevo.ref, created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addEgreso', error) })
    return nuevo
  }

  const addPresupuesto: PorteDataContextType['addPresupuesto'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Presupuesto = { ...data, activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setPresupuestos(prev => [nuevo, ...prev])
    supabase.from('presupuestos').insert({ ...presupuestoToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addPresupuesto', error) })
    return nuevo
  }

  const addVenta: PorteDataContextType['addVenta'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Venta = { ...data, createdAt: now, createdBy: userId, updatedAt: now }
    setVentas(prev => [nuevo, ...prev])
    supabase.from('ventas').insert({ ...ventaToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addVenta', error) })
    return nuevo
  }

  const addProveedor: PorteDataContextType['addProveedor'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Proveedor = { ...data, idProv: nextSeqId('PROV', proveedores.map(p => p.idProv)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setProveedores(prev => [nuevo, ...prev])
    supabase.from('proveedores').insert({ ...proveedorToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addProveedor', error) })
    return nuevo
  }

  const addCliente: PorteDataContextType['addCliente'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Cliente = { ...data, idCli: nextSeqId('CLI', clientes.map(c => c.idCli)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setClientes(prev => [nuevo, ...prev])
    supabase.from('clientes').insert({ ...clienteToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addCliente', error) })
    return nuevo
  }

  const findOrCreateCliente: PorteDataContextType['findOrCreateCliente'] = (nombre, userId) => {
    const nombreTrim = nombre.trim()
    const existente = clientes.find(c => c.nombre.trim().toLowerCase() === nombreTrim.toLowerCase())
    if (existente) return existente
    return addCliente({ nombre: nombreTrim }, userId)
  }

  const addGastoFijo: PorteDataContextType['addGastoFijo'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: GastoFijo = { ...data, id: crypto.randomUUID(), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setGastosFijos(prev => [nuevo, ...prev])
    supabase.from('gastos_fijos').insert({ ...gastoFijoToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addGastoFijo', error) })
    return nuevo
  }

  const addVariacion: PorteDataContextType['addVariacion'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Variacion = { ...data, idVar: nextSeqId('VAR', variaciones.map(v => v.idVar)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setVariaciones(prev => [nuevo, ...prev])
    supabase.from('variaciones').insert({ ...variacionToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addVariacion', error) })
    return nuevo
  }

  const addAprendizaje: PorteDataContextType['addAprendizaje'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Aprendizaje = { ...data, idApr: nextSeqId('APR', aprendizajes.map(a => a.idApr)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setAprendizajes(prev => [nuevo, ...prev])
    supabase.from('aprendizajes').insert({ ...aprendizajeToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addAprendizaje', error) })
    return nuevo
  }

  const nextPresupuestoId: PorteDataContextType['nextPresupuestoId'] = () => {
    // Presupuestos y ventas comparten el mismo espacio de IDs (PR-XXXX) — considerar ambos evita colisiones.
    const idsToCheck = [...presupuestos.map(p => p.id), ...ventas.map(v => v.id)]
    const max = idsToCheck.reduce((acc, id) => {
      const n = Number(id.replace('PR - ', '').replace('PR-', ''))
      return Number.isFinite(n) ? Math.max(acc, n) : acc
    }, 0)
    return `PR - ${String(max + 1).padStart(4, '0')}`
  }

  const updatePresupuesto: PorteDataContextType['updatePresupuesto'] = (id, data) => {
    const now = new Date().toISOString()
    setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: now } : p))
    supabase.from('presupuestos').update({ ...presupuestoToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updatePresupuesto', error) })
  }

  const aceptarPresupuesto: PorteDataContextType['aceptarPresupuesto'] = (id, overrides) => {
    const existente = presupuestos.find(p => p.id === id)
    if (!existente) return { ok: false, error: 'Presupuesto no encontrado' }

    const candidato = { ...existente, ...overrides }
    const errorValidacion = validarPresupuestoParaVenta(candidato)
    if (errorValidacion) return { ok: false, error: errorValidacion }

    const now = new Date().toISOString()
    setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, ...overrides, estadoComercial: 'Aceptado', updatedAt: now } : p))

    supabase.from('presupuestos').update({ ...presupuestoToRow(overrides ?? {}), estado_comercial: 'Aceptado', updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('aceptarPresupuesto', error) })

    return { ok: true }
  }

  const convertirEnVenta: PorteDataContextType['convertirEnVenta'] = async (presupuestoId, condiciones, userId, overrides) => {
    const presupuestoGuardado = presupuestos.find(p => p.id === presupuestoId)
    if (!presupuestoGuardado) return { ok: false, error: 'Presupuesto no encontrado' }

    // `overrides` permite aceptar y convertir en un solo paso: PresupuestoFormPage
    // pasa acá los cambios de edición todavía no guardados (incluido
    // estadoComercial: 'Aceptado') en vez de llamar primero a aceptarPresupuesto()
    // y recién después a esto — encadenar esas dos llamadas del store leería acá
    // el `presupuestos` de un render viejo (el setState de la primera no se
    // refleja hasta el próximo render) y rechazaría la conversión igual.
    const presupuesto = overrides ? { ...presupuestoGuardado, ...overrides } : presupuestoGuardado

    if (presupuesto.estadoComercial !== 'Aceptado') {
      return { ok: false, error: 'El presupuesto tiene que estar Aceptado antes de convertirlo en venta' }
    }
    if (ventas.some(v => v.id === presupuestoId)) {
      return { ok: false, error: 'Ya existe una venta para este presupuesto' }
    }

    const errorPresupuesto = validarPresupuestoParaVenta(presupuesto)
    if (errorPresupuesto) return { ok: false, error: errorPresupuesto }

    const errorCondiciones = validarCondicionesComerciales(condiciones)
    if (errorCondiciones) return { ok: false, error: errorCondiciones }

    const now = new Date().toISOString()
    const nuevaVenta: Venta = {
      ...construirVentaDesdePresupuesto(presupuesto, now),
      condPago: condiciones.condPago,
      vencCobro: condiciones.vencCobro,
      cajaIntenc: condiciones.cajaIntenc,
      entregaCompr: condiciones.entregaCompr,
      respOp: condiciones.respOp.trim(),
      dias: condiciones.dias,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    }

    // A diferencia del resto del store, acá se espera la confirmación real de
    // Supabase antes de tocar el estado local — este insert puede fallar
    // legítimamente (trigger de condiciones comerciales, PK duplicada por
    // doble submit) y un "éxito" optimista dejaría una venta fantasma.
    const { error } = await supabase
      .from('ventas')
      .insert({ ...ventaToRow(nuevaVenta), created_by: userId, created_at: now, updated_at: now })

    if (error) {
      logPersistError('convertirEnVenta', error)
      return { ok: false, error: 'No se pudo guardar la venta. Intentá de nuevo.' }
    }

    // El presupuesto recién se marca Aceptado (+ el resto de los overrides) una
    // vez que la venta ya se confirmó — si el insert de arriba hubiera fallado,
    // el presupuesto queda como estaba en vez de mostrar "Aceptado" sin venta.
    if (overrides) {
      setPresupuestos(prev => prev.map(p => p.id === presupuestoId ? { ...p, ...overrides, updatedAt: now } : p))
      supabase.from('presupuestos').update({ ...presupuestoToRow(overrides), updated_at: now }).eq('id', presupuestoId)
        .then(({ error: presupuestoError }) => { if (presupuestoError) logPersistError('convertirEnVenta:presupuesto', presupuestoError) })
    }

    setVentas(prev => [nuevaVenta, ...prev])
    return { ok: true, venta: nuevaVenta }
  }

  const updateIngreso: PorteDataContextType['updateIngreso'] = (ref, data) => {
    const now = new Date().toISOString()
    setIngresos(prev => prev.map(i => i.ref === ref ? { ...i, ...data, updatedAt: now } : i))
    supabase.from('ingresos').update({ ...ingresoToRow(data), updated_at: now }).eq('ref', ref)
      .then(({ error }) => { if (error) logPersistError('updateIngreso', error) })
  }
  const updateEgreso: PorteDataContextType['updateEgreso'] = (ref, data) => {
    const now = new Date().toISOString()
    setEgresos(prev => prev.map(e => e.ref === ref ? { ...e, ...data, updatedAt: now } : e))
    supabase.from('egresos').update({ ...egresoToRow(data), updated_at: now }).eq('ref', ref)
      .then(({ error }) => { if (error) logPersistError('updateEgreso', error) })
  }

  const updateVenta: PorteDataContextType['updateVenta'] = (id, data) => {
    const now = new Date().toISOString()
    setVentas(prev => prev.map(v => v.id === id ? { ...v, ...data, updatedAt: now } : v))
    supabase.from('ventas').update({ ...ventaToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updateVenta', error) })
  }

  const updateProveedor: PorteDataContextType['updateProveedor'] = (idProv, data) => {
    const now = new Date().toISOString()
    setProveedores(prev => prev.map(p => p.idProv === idProv ? { ...p, ...data, updatedAt: now } : p))
    supabase.from('proveedores').update({ ...proveedorToRow(data), updated_at: now }).eq('id_prov', idProv)
      .then(({ error }) => { if (error) logPersistError('updateProveedor', error) })
  }
  const updateCliente: PorteDataContextType['updateCliente'] = (idCli, data) => {
    const now = new Date().toISOString()
    // `data` puede traer `null` en los campos de contacto (borrado intencional) —
    // para el estado local, que solo conoce `string | undefined`, un borrado se
    // representa como `undefined`; el `null` real solo le importa a la fila de
    // Supabase (clienteToRow lo traduce a NULL).
    const localData: Partial<Cliente> = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value === null ? undefined : value]),
    )
    setClientes(prev => prev.map(c => c.idCli === idCli ? { ...c, ...localData, updatedAt: now } : c))
    supabase.from('clientes').update({ ...clienteToRow(data), updated_at: now }).eq('id_cli', idCli)
      .then(({ error }) => { if (error) logPersistError('updateCliente', error) })
  }
  const updateGastoFijo: PorteDataContextType['updateGastoFijo'] = (id, data) => {
    const now = new Date().toISOString()
    setGastosFijos(prev => prev.map(g => g.id === id ? { ...g, ...data, updatedAt: now } : g))
    supabase.from('gastos_fijos').update({ ...gastoFijoToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updateGastoFijo', error) })
  }
  const updateVariacion: PorteDataContextType['updateVariacion'] = (idVar, data) => {
    const now = new Date().toISOString()
    setVariaciones(prev => prev.map(v => v.idVar === idVar ? { ...v, ...data, updatedAt: now } : v))
    supabase.from('variaciones').update({ ...variacionToRow(data), updated_at: now }).eq('id_var', idVar)
      .then(({ error }) => { if (error) logPersistError('updateVariacion', error) })
  }
  const updateAprendizaje: PorteDataContextType['updateAprendizaje'] = (idApr, data) => {
    const now = new Date().toISOString()
    setAprendizajes(prev => prev.map(a => a.idApr === idApr ? { ...a, ...data, updatedAt: now } : a))
    supabase.from('aprendizajes').update({ ...aprendizajeToRow(data), updated_at: now }).eq('id_apr', idApr)
      .then(({ error }) => { if (error) logPersistError('updateAprendizaje', error) })
  }

  const removeIngreso = (ref: string) => {
    setIngresos(prev => prev.filter(i => i.ref !== ref))
    supabase.from('ingresos').delete().eq('ref', ref).then(({ error }) => { if (error) logPersistError('removeIngreso', error) })
  }
  const removeEgreso = (ref: string) => {
    setEgresos(prev => prev.filter(e => e.ref !== ref))
    supabase.from('egresos').delete().eq('ref', ref).then(({ error }) => { if (error) logPersistError('removeEgreso', error) })
  }

  const softDeleteIngreso = (ref: string) => updateIngreso(ref, { activo: false })
  const softDeleteEgreso = (ref: string) => updateEgreso(ref, { activo: false })
  const softDeletePresupuesto = (id: string) => updatePresupuesto(id, { activo: false })
  const softDeleteProveedor = (idProv: string) => updateProveedor(idProv, { activo: false })
  const softDeleteCliente = (idCli: string) => updateCliente(idCli, { activo: false })
  const softDeleteGastoFijo = (id: string) => updateGastoFijo(id, { activo: false })
  const softDeleteVariacion = (idVar: string) => updateVariacion(idVar, { activo: false })
  const softDeleteAprendizaje = (idApr: string) => updateAprendizaje(idApr, { activo: false })

  const findDuplicateIngreso: PorteDataContextType['findDuplicateIngreso'] = (obraId, monto, fecha) =>
    ingresos.find(i => i.activo && i.id === obraId && i.monto === monto && i.fecha === fecha)

  const findDuplicateEgreso: PorteDataContextType['findDuplicateEgreso'] = (obraId, monto, fecha) =>
    egresos.find(e => e.activo && e.id === obraId && e.monto === monto && e.fecha === fecha)

  return (
    <PorteDataContext.Provider
      value={{
        isLoading,
        ingresos, egresos, presupuestos, ventas, proveedores, clientes, gastosFijos, variaciones, aprendizajes,
        addIngreso, addEgreso, addPresupuesto, addVenta, addProveedor, addCliente, findOrCreateCliente, addGastoFijo, addVariacion, addAprendizaje,
        updateIngreso, updateEgreso, updatePresupuesto, updateVenta, updateProveedor, updateCliente, updateGastoFijo, updateVariacion, updateAprendizaje,
        refetch: loadAll,
        nextPresupuestoId,
        aceptarPresupuesto,
        convertirEnVenta,
        removeIngreso, removeEgreso,
        softDeleteIngreso, softDeleteEgreso, softDeletePresupuesto, softDeleteProveedor, softDeleteCliente, softDeleteGastoFijo, softDeleteVariacion, softDeleteAprendizaje,
        findDuplicateIngreso, findDuplicateEgreso,
      }}
    >
      {children}
    </PorteDataContext.Provider>
  )
}

export function usePorteData() {
  const ctx = useContext(PorteDataContext)
  if (!ctx) throw new Error('usePorteData must be used within PorteDataProvider')
  return ctx
}
