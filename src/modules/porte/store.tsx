import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
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

// ─── Store conectado a Supabase, por entidad, vía React Query ────────────────
// Cada entidad tiene su propio query key y se carga recién cuando un
// componente la usa por primera vez (lazy) — no hay un loadAll() que traiga
// las 9 tablas juntas. React Query resuelve stale-while-revalidate solo:
// staleTime 0 (default) muestra el cache al instante en cada mount/focus y
// dispara un refetch en paralelo en segundo plano, y ese refetch (mount o
// window focus) solo corre para queries con un observer activo — es decir,
// solo las entidades que el usuario ya visitó, nunca las 9 de una.
// Las mutaciones actualizan el cache de inmediato (misma UX optimista que
// antes) y persisten en Supabase en paralelo; RLS es la barrera real de
// escritura, esto es solo la capa de UI.

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

export type TableKey = 'ingresos' | 'egresos' | 'presupuestos' | 'ventas' | 'proveedores' | 'clientes' | 'gastosFijos' | 'variaciones' | 'aprendizajes'

const ALL_TABLE_KEYS: TableKey[] = ['ingresos', 'egresos', 'presupuestos', 'ventas', 'proveedores', 'clientes', 'gastosFijos', 'variaciones', 'aprendizajes']

function porteKey(table: TableKey): QueryKey {
  return ['porte', table]
}

// ─── Fetchers — uno por tabla/vista real de Supabase ─────────────────────────

async function fetchIngresos(): Promise<Ingreso[]> {
  const { data, error } = await supabase.from('ingresos').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToIngreso)
}
async function fetchEgresos(): Promise<Egreso[]> {
  const { data, error } = await supabase.from('egresos').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToEgreso)
}
async function fetchPresupuestos(): Promise<Presupuesto[]> {
  const { data, error } = await supabase.from('presupuestos').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToPresupuesto)
}
async function fetchVentas(): Promise<Venta[]> {
  const { data, error } = await supabase.from('v_ventas_detalle').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToVenta)
}
async function fetchProveedores(): Promise<Proveedor[]> {
  const { data, error } = await supabase.from('v_proveedores_saldo').select('*')
  if (error) throw error
  return (data ?? []).map(rowToProveedor)
}
async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToCliente)
}
async function fetchGastosFijos(): Promise<GastoFijo[]> {
  const { data, error } = await supabase.from('gastos_fijos').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToGastoFijo)
}
async function fetchVariaciones(): Promise<Variacion[]> {
  const { data, error } = await supabase.from('variaciones').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToVariacion)
}
async function fetchAprendizajes(): Promise<Aprendizaje[]> {
  const { data, error } = await supabase.from('aprendizajes').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToAprendizaje)
}

function useEntity<T>(table: TableKey, queryFn: () => Promise<T[]>): T[] {
  const { data } = useQuery({ queryKey: porteKey(table), queryFn })
  return data ?? []
}

// ─── Lectura — un hook por entidad, se dispara recién al montarse ───────────

export function useIngresos(): Ingreso[] { return useEntity('ingresos', fetchIngresos) }
export function useEgresos(): Egreso[] { return useEntity('egresos', fetchEgresos) }
export function usePresupuestos(): Presupuesto[] { return useEntity('presupuestos', fetchPresupuestos) }
export function useVentas(): Venta[] { return useEntity('ventas', fetchVentas) }
export function useProveedores(): Proveedor[] { return useEntity('proveedores', fetchProveedores) }
export function useClientes(): Cliente[] { return useEntity('clientes', fetchClientes) }
export function useGastosFijos(): GastoFijo[] { return useEntity('gastosFijos', fetchGastosFijos) }
export function useVariaciones(): Variacion[] { return useEntity('variaciones', fetchVariaciones) }
export function useAprendizajes(): Aprendizaje[] { return useEntity('aprendizajes', fetchAprendizajes) }

/**
 * Re-lee entidades puntuales desde Supabase. Necesario después de mutaciones
 * que pasan por afuera del store (ej. el asistente crea presupuestos/egresos/
 * ingresos vía el backend con service role) — sin esto, el usuario ve el dato
 * recién creado solo al recargar la página. Sin argumentos invalida las 9
 * entidades; pasando `tables` invalida solo esas — usado por el asistente,
 * que sabe qué tabla tocó su acción. Solo dispara un fetch real para las
 * entidades con un observer activo en ese momento (staleTime 0 + invalidate);
 * el resto queda marcada stale y se trae recién cuando el usuario la visite.
 */
export function usePorteRefetch() {
  const queryClient = useQueryClient()
  return useCallback((tables?: TableKey[]): Promise<void> => {
    const keys = tables && tables.length > 0 ? tables : ALL_TABLE_KEYS
    return Promise.all(keys.map(t => queryClient.invalidateQueries({ queryKey: porteKey(t) }))).then(() => undefined)
  }, [queryClient])
}

/**
 * Sin Provider de contexto: cada componente usa el hook de la entidad que
 * necesita, y React Query dedupea/cachea por query key entre componentes.
 * Este componente solo limpia el cache al desloguearse, para que una sesión
 * siguiente (mismo u otro usuario) no arranque mostrando datos stale de la
 * anterior.
 */
export function PorteDataProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isAuthenticated) queryClient.clear()
  }, [isAuthenticated, queryClient])

  return <>{children}</>
}

// ─── Mutaciones — agrupadas por entidad, leen/escriben directo el cache ─────

export function useIngresoActions() {
  const queryClient = useQueryClient()

  const addIngreso = (data: Omit<Ingreso, 'ref' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): Ingreso => {
    const now = new Date().toISOString()
    const current = queryClient.getQueryData<Ingreso[]>(porteKey('ingresos')) ?? []
    const nuevo: Ingreso = { ...data, ref: nextRef('IN', current), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<Ingreso[]>(porteKey('ingresos'), prev => (prev ? [nuevo, ...prev] : prev))
    supabase.from('ingresos').insert({ ...ingresoToRow(nuevo), ref: nuevo.ref, created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addIngreso', error) })
    return nuevo
  }

  const updateIngreso = (ref: string, data: Partial<Ingreso>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<Ingreso[]>(porteKey('ingresos'), prev => prev?.map(i => (i.ref === ref ? { ...i, ...data, updatedAt: now } : i)))
    supabase.from('ingresos').update({ ...ingresoToRow(data), updated_at: now }).eq('ref', ref)
      .then(({ error }) => { if (error) logPersistError('updateIngreso', error) })
  }

  const removeIngreso = (ref: string) => {
    queryClient.setQueryData<Ingreso[]>(porteKey('ingresos'), prev => prev?.filter(i => i.ref !== ref))
    supabase.from('ingresos').delete().eq('ref', ref).then(({ error }) => { if (error) logPersistError('removeIngreso', error) })
  }

  const softDeleteIngreso = (ref: string) => updateIngreso(ref, { activo: false })

  const findDuplicateIngreso = (obraId: string, monto: number, fecha: string): Ingreso | undefined => {
    const current = queryClient.getQueryData<Ingreso[]>(porteKey('ingresos')) ?? []
    return current.find(i => i.activo && i.id === obraId && i.monto === monto && i.fecha === fecha)
  }

  return { addIngreso, updateIngreso, removeIngreso, softDeleteIngreso, findDuplicateIngreso }
}

export function useEgresoActions() {
  const queryClient = useQueryClient()

  const addEgreso = (data: Omit<Egreso, 'ref' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): Egreso => {
    const now = new Date().toISOString()
    const current = queryClient.getQueryData<Egreso[]>(porteKey('egresos')) ?? []
    const nuevo: Egreso = { ...data, ref: nextRef('EG', current), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<Egreso[]>(porteKey('egresos'), prev => (prev ? [nuevo, ...prev] : prev))
    supabase.from('egresos').insert({ ...egresoToRow(nuevo), ref: nuevo.ref, created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addEgreso', error) })
    return nuevo
  }

  const updateEgreso = (ref: string, data: Partial<Egreso>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<Egreso[]>(porteKey('egresos'), prev => prev?.map(e => (e.ref === ref ? { ...e, ...data, updatedAt: now } : e)))
    supabase.from('egresos').update({ ...egresoToRow(data), updated_at: now }).eq('ref', ref)
      .then(({ error }) => { if (error) logPersistError('updateEgreso', error) })
  }

  const removeEgreso = (ref: string) => {
    queryClient.setQueryData<Egreso[]>(porteKey('egresos'), prev => prev?.filter(e => e.ref !== ref))
    supabase.from('egresos').delete().eq('ref', ref).then(({ error }) => { if (error) logPersistError('removeEgreso', error) })
  }

  const softDeleteEgreso = (ref: string) => updateEgreso(ref, { activo: false })

  const findDuplicateEgreso = (obraId: string | undefined, monto: number, fecha: string): Egreso | undefined => {
    const current = queryClient.getQueryData<Egreso[]>(porteKey('egresos')) ?? []
    return current.find(e => e.activo && e.id === obraId && e.monto === monto && e.fecha === fecha)
  }

  return { addEgreso, updateEgreso, removeEgreso, softDeleteEgreso, findDuplicateEgreso }
}

export function usePresupuestoActions() {
  const queryClient = useQueryClient()

  const addPresupuesto = (data: Omit<Presupuesto, 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): Presupuesto => {
    const now = new Date().toISOString()
    const nuevo: Presupuesto = { ...data, activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<Presupuesto[]>(porteKey('presupuestos'), prev => (prev ? [nuevo, ...prev] : prev))
    supabase.from('presupuestos').insert({ ...presupuestoToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addPresupuesto', error) })
    return nuevo
  }

  const updatePresupuesto = (id: string, data: Partial<Presupuesto>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<Presupuesto[]>(porteKey('presupuestos'), prev => prev?.map(p => (p.id === id ? { ...p, ...data, updatedAt: now } : p)))
    supabase.from('presupuestos').update({ ...presupuestoToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updatePresupuesto', error) })
  }

  const softDeletePresupuesto = (id: string) => updatePresupuesto(id, { activo: false })

  const nextPresupuestoId = (): string => {
    // Presupuestos y ventas comparten el mismo espacio de IDs (PR-XXXX) — considerar ambos evita colisiones.
    const presupuestos = queryClient.getQueryData<Presupuesto[]>(porteKey('presupuestos')) ?? []
    const ventas = queryClient.getQueryData<Venta[]>(porteKey('ventas')) ?? []
    const idsToCheck = [...presupuestos.map(p => p.id), ...ventas.map(v => v.id)]
    const max = idsToCheck.reduce((acc, id) => {
      const n = Number(id.replace('PR - ', '').replace('PR-', ''))
      return Number.isFinite(n) ? Math.max(acc, n) : acc
    }, 0)
    return `PR - ${String(max + 1).padStart(4, '0')}`
  }

  /**
   * Paso 1 del flujo Presupuesto → Venta: solo cambia estadoComercial a
   * 'Aceptado'. No crea la venta — eso pasa recién en convertirEnVenta(), una
   * vez completas las condiciones comerciales.
   */
  const aceptarPresupuesto = (id: string, overrides?: Partial<Presupuesto>): { ok: true } | { ok: false; error: string } => {
    const presupuestos = queryClient.getQueryData<Presupuesto[]>(porteKey('presupuestos')) ?? []
    const existente = presupuestos.find(p => p.id === id)
    if (!existente) return { ok: false, error: 'Presupuesto no encontrado' }

    const candidato = { ...existente, ...overrides }
    const errorValidacion = validarPresupuestoParaVenta(candidato)
    if (errorValidacion) return { ok: false, error: errorValidacion }

    const now = new Date().toISOString()
    queryClient.setQueryData<Presupuesto[]>(porteKey('presupuestos'), prev => prev?.map(p => (p.id === id ? { ...p, ...overrides, estadoComercial: 'Aceptado', updatedAt: now } : p)))

    supabase.from('presupuestos').update({ ...presupuestoToRow(overrides ?? {}), estado_comercial: 'Aceptado', updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('aceptarPresupuesto', error) })

    return { ok: true }
  }

  /**
   * Paso 2: crea la Venta congelando los costos del presupuesto + las
   * condiciones comerciales cargadas. Requiere que el presupuesto esté
   * 'Aceptado' (ya sea porque ya lo estaba, o porque `overrides` lo marca así
   * en el mismo llamado) y que todavía no tenga una venta asociada
   * (idempotente). Valida del lado del cliente para feedback inmediato — el
   * trigger de la base (trg_validar_condiciones_comerciales) es la barrera
   * real. A diferencia del resto de las mutaciones, espera la confirmación
   * real de Supabase antes de tocar el cache: es el único flujo donde una
   * inserción puede fallar legítimamente (trigger o PK duplicada por doble
   * submit) y un "éxito" optimista dejaría una venta fantasma.
   *
   * `overrides`: cambios de edición del presupuesto todavía no guardados
   * (típicamente incluye estadoComercial: 'Aceptado') que se aplican acá antes
   * de validar/construir la venta, y se persisten recién si la venta se creó
   * con éxito. Permite "Aceptar + Convertir" en un solo click.
   */
  const convertirEnVenta = async (
    presupuestoId: string,
    condiciones: CondicionesComerciales,
    userId: string,
    overrides?: Partial<Presupuesto>,
  ): Promise<{ ok: true; venta: Venta } | { ok: false; error: string }> => {
    const presupuestos = queryClient.getQueryData<Presupuesto[]>(porteKey('presupuestos')) ?? []
    const ventas = queryClient.getQueryData<Venta[]>(porteKey('ventas')) ?? []
    const presupuestoGuardado = presupuestos.find(p => p.id === presupuestoId)
    if (!presupuestoGuardado) return { ok: false, error: 'Presupuesto no encontrado' }

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
      queryClient.setQueryData<Presupuesto[]>(porteKey('presupuestos'), prev => prev?.map(p => (p.id === presupuestoId ? { ...p, ...overrides, updatedAt: now } : p)))
      supabase.from('presupuestos').update({ ...presupuestoToRow(overrides), updated_at: now }).eq('id', presupuestoId)
        .then(({ error: presupuestoError }) => { if (presupuestoError) logPersistError('convertirEnVenta:presupuesto', presupuestoError) })
    }

    queryClient.setQueryData<Venta[]>(porteKey('ventas'), prev => (prev ? [nuevaVenta, ...prev] : prev))
    return { ok: true, venta: nuevaVenta }
  }

  return { addPresupuesto, updatePresupuesto, softDeletePresupuesto, nextPresupuestoId, aceptarPresupuesto, convertirEnVenta }
}

export function useVentaActions() {
  const queryClient = useQueryClient()

  const addVenta = (data: Omit<Venta, 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): Venta => {
    const now = new Date().toISOString()
    const nuevo: Venta = { ...data, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<Venta[]>(porteKey('ventas'), prev => (prev ? [nuevo, ...prev] : prev))
    supabase.from('ventas').insert({ ...ventaToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addVenta', error) })
    return nuevo
  }

  const updateVenta = (id: string, data: Partial<Venta>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<Venta[]>(porteKey('ventas'), prev => prev?.map(v => (v.id === id ? { ...v, ...data, updatedAt: now } : v)))
    supabase.from('ventas').update({ ...ventaToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updateVenta', error) })
  }

  return { addVenta, updateVenta }
}

export function useProveedorActions() {
  const queryClient = useQueryClient()

  const addProveedor = (data: Omit<Proveedor, 'idProv' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): Proveedor => {
    const now = new Date().toISOString()
    const current = queryClient.getQueryData<Proveedor[]>(porteKey('proveedores')) ?? []
    const nuevo: Proveedor = { ...data, idProv: nextSeqId('PROV', current.map(p => p.idProv)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<Proveedor[]>(porteKey('proveedores'), prev => (prev ? [nuevo, ...prev] : prev))
    supabase.from('proveedores').insert({ ...proveedorToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addProveedor', error) })
    return nuevo
  }

  const updateProveedor = (idProv: string, data: Partial<Proveedor>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<Proveedor[]>(porteKey('proveedores'), prev => prev?.map(p => (p.idProv === idProv ? { ...p, ...data, updatedAt: now } : p)))
    supabase.from('proveedores').update({ ...proveedorToRow(data), updated_at: now }).eq('id_prov', idProv)
      .then(({ error }) => { if (error) logPersistError('updateProveedor', error) })
  }

  const softDeleteProveedor = (idProv: string) => updateProveedor(idProv, { activo: false })

  return { addProveedor, updateProveedor, softDeleteProveedor }
}

export function useClienteActions() {
  const queryClient = useQueryClient()

  const addCliente = (data: Omit<Cliente, 'idCli' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): Cliente => {
    const now = new Date().toISOString()
    const current = queryClient.getQueryData<Cliente[]>(porteKey('clientes')) ?? []
    const nuevo: Cliente = { ...data, idCli: nextSeqId('CLI', current.map(c => c.idCli)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<Cliente[]>(porteKey('clientes'), prev => (prev ? [nuevo, ...prev] : prev))
    supabase.from('clientes').insert({ ...clienteToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addCliente', error) })
    return nuevo
  }

  /**
   * Da de alta el cliente en el maestro si el nombre (case-insensitive) no
   * existe todavía — usado al cargar un presupuesto o una venta con un
   * nombre de cliente en texto libre, para que el maestro de Clientes se
   * mantenga sincronizado sin pedirle un paso extra al usuario.
   */
  const findOrCreateCliente = (nombre: string, userId: string): Cliente => {
    const current = queryClient.getQueryData<Cliente[]>(porteKey('clientes')) ?? []
    const nombreTrim = nombre.trim()
    const existente = current.find(c => c.nombre.trim().toLowerCase() === nombreTrim.toLowerCase())
    if (existente) return existente
    return addCliente({ nombre: nombreTrim }, userId)
  }

  const updateCliente = (idCli: string, data: ClienteUpdate) => {
    const now = new Date().toISOString()
    // `data` puede traer `null` en los campos de contacto (borrado intencional) —
    // para el cache, que solo conoce `string | undefined`, un borrado se
    // representa como `undefined`; el `null` real solo le importa a la fila de
    // Supabase (clienteToRow lo traduce a NULL).
    const localData: Partial<Cliente> = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value === null ? undefined : value]),
    )
    queryClient.setQueryData<Cliente[]>(porteKey('clientes'), prev => prev?.map(c => (c.idCli === idCli ? { ...c, ...localData, updatedAt: now } : c)))
    supabase.from('clientes').update({ ...clienteToRow(data), updated_at: now }).eq('id_cli', idCli)
      .then(({ error }) => { if (error) logPersistError('updateCliente', error) })
  }

  const softDeleteCliente = (idCli: string) => updateCliente(idCli, { activo: false })

  return { addCliente, updateCliente, softDeleteCliente, findOrCreateCliente }
}

export function useGastoFijoActions() {
  const queryClient = useQueryClient()

  const addGastoFijo = (data: Omit<GastoFijo, 'id' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): GastoFijo => {
    const now = new Date().toISOString()
    const nuevo: GastoFijo = { ...data, id: crypto.randomUUID(), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<GastoFijo[]>(porteKey('gastosFijos'), prev => (prev ? [nuevo, ...prev] : prev))
    supabase.from('gastos_fijos').insert({ ...gastoFijoToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addGastoFijo', error) })
    return nuevo
  }

  const updateGastoFijo = (id: string, data: Partial<GastoFijo>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<GastoFijo[]>(porteKey('gastosFijos'), prev => prev?.map(g => (g.id === id ? { ...g, ...data, updatedAt: now } : g)))
    supabase.from('gastos_fijos').update({ ...gastoFijoToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updateGastoFijo', error) })
  }

  const softDeleteGastoFijo = (id: string) => updateGastoFijo(id, { activo: false })

  return { addGastoFijo, updateGastoFijo, softDeleteGastoFijo }
}

export function useVariacionActions() {
  const queryClient = useQueryClient()

  const addVariacion = (data: Omit<Variacion, 'idVar' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): Variacion => {
    const now = new Date().toISOString()
    const current = queryClient.getQueryData<Variacion[]>(porteKey('variaciones')) ?? []
    const nuevo: Variacion = { ...data, idVar: nextSeqId('VAR', current.map(v => v.idVar)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<Variacion[]>(porteKey('variaciones'), prev => (prev ? [nuevo, ...prev] : prev))
    supabase.from('variaciones').insert({ ...variacionToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addVariacion', error) })
    return nuevo
  }

  const updateVariacion = (idVar: string, data: Partial<Variacion>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<Variacion[]>(porteKey('variaciones'), prev => prev?.map(v => (v.idVar === idVar ? { ...v, ...data, updatedAt: now } : v)))
    supabase.from('variaciones').update({ ...variacionToRow(data), updated_at: now }).eq('id_var', idVar)
      .then(({ error }) => { if (error) logPersistError('updateVariacion', error) })
  }

  const softDeleteVariacion = (idVar: string) => updateVariacion(idVar, { activo: false })

  return { addVariacion, updateVariacion, softDeleteVariacion }
}

export function useAprendizajeActions() {
  const queryClient = useQueryClient()

  const addAprendizaje = (data: Omit<Aprendizaje, 'idApr' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): Aprendizaje => {
    const now = new Date().toISOString()
    const current = queryClient.getQueryData<Aprendizaje[]>(porteKey('aprendizajes')) ?? []
    const nuevo: Aprendizaje = { ...data, idApr: nextSeqId('APR', current.map(a => a.idApr)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<Aprendizaje[]>(porteKey('aprendizajes'), prev => (prev ? [nuevo, ...prev] : prev))
    supabase.from('aprendizajes').insert({ ...aprendizajeToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addAprendizaje', error) })
    return nuevo
  }

  const updateAprendizaje = (idApr: string, data: Partial<Aprendizaje>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<Aprendizaje[]>(porteKey('aprendizajes'), prev => prev?.map(a => (a.idApr === idApr ? { ...a, ...data, updatedAt: now } : a)))
    supabase.from('aprendizajes').update({ ...aprendizajeToRow(data), updated_at: now }).eq('id_apr', idApr)
      .then(({ error }) => { if (error) logPersistError('updateAprendizaje', error) })
  }

  const softDeleteAprendizaje = (idApr: string) => updateAprendizaje(idApr, { activo: false })

  return { addAprendizaje, updateAprendizaje, softDeleteAprendizaje }
}
