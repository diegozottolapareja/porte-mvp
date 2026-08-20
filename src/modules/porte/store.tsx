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
import type { Caja } from './data/cajas'
import type { MetodoCobro } from './data/metodosCobro'
import type { MetodoPago } from './data/metodosPago'
import type { Cheque, ChequeEstado } from './data/cheques'
import type { TarjetaCredito, ResumenTarjeta } from './data/tarjetas'
import type { CompromisoPago } from './data/compromisosPago'
import type { Profile } from './data/profiles'
import { validarPresupuestoParaVenta, construirVentaDesdePresupuesto, validarCondicionesComerciales, calcularCuotasTarjeta, type CondicionesComerciales } from './calculos'
import { addDaysLocal, todayLocal } from '@/lib/format'
import {
  rowToIngreso, ingresoToRow, rowToEgreso, egresoToRow, rowToPresupuesto, presupuestoToRow,
  rowToVenta, ventaToRow, rowToProveedor, proveedorToRow, rowToCliente, clienteToRow, rowToGastoFijo, gastoFijoToRow,
  rowToVariacion, variacionToRow, rowToAprendizaje, aprendizajeToRow,
  rowToCaja, cajaToRow, rowToMetodoCobro, metodoCobroToRow, rowToMetodoPago, metodoPagoToRow,
  rowToCheque, rowToTarjeta, tarjetaToRow, rowToResumenTarjeta, rowToCompromisoPago,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

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
  | 'cajas' | 'metodosCobro' | 'metodosPago' | 'cheques' | 'tarjetas' | 'resumenesTarjeta' | 'compromisosPago' | 'profiles'

const ALL_TABLE_KEYS: TableKey[] = [
  'ingresos', 'egresos', 'presupuestos', 'ventas', 'proveedores', 'clientes', 'gastosFijos', 'variaciones', 'aprendizajes',
  'cajas', 'metodosCobro', 'metodosPago', 'cheques', 'tarjetas', 'resumenesTarjeta', 'compromisosPago', 'profiles',
]

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
async function fetchCajas(): Promise<Caja[]> {
  const { data, error } = await supabase.from('cajas').select('*').order('nombre')
  if (error) throw error
  return (data ?? []).map(rowToCaja)
}
async function fetchMetodosCobro(): Promise<MetodoCobro[]> {
  const { data, error } = await supabase.from('metodos_cobro').select('*').order('nombre')
  if (error) throw error
  return (data ?? []).map(rowToMetodoCobro)
}
async function fetchMetodosPago(): Promise<MetodoPago[]> {
  const { data, error } = await supabase.from('metodos_pago').select('*').order('nombre')
  if (error) throw error
  return (data ?? []).map(rowToMetodoPago)
}
async function fetchCheques(): Promise<Cheque[]> {
  const { data, error } = await supabase.from('cheques').select('*').order('fecha_vencimiento')
  if (error) throw error
  return (data ?? []).map(rowToCheque)
}
async function fetchTarjetas(): Promise<TarjetaCredito[]> {
  const { data, error } = await supabase.from('tarjetas_credito').select('*').order('nombre')
  if (error) throw error
  return (data ?? []).map(rowToTarjeta)
}
async function fetchResumenesTarjeta(): Promise<ResumenTarjeta[]> {
  const { data, error } = await supabase.from('resumenes_tarjeta').select('*').order('fecha_vencimiento')
  if (error) throw error
  return (data ?? []).map(rowToResumenTarjeta)
}
async function fetchCompromisosPago(): Promise<CompromisoPago[]> {
  const { data, error } = await supabase.from('compromisos_pago').select('*').order('fecha_vencimiento')
  if (error) throw error
  return (data ?? []).map(rowToCompromisoPago)
}
async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('id, nombre, role, activo').order('nombre')
  if (error) throw error
  return (data ?? []).map(r => ({ id: r.id, nombre: r.nombre, role: r.role, activo: r.activo }))
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
export function useCajas(): Caja[] { return useEntity('cajas', fetchCajas) }
export function useMetodosCobro(): MetodoCobro[] { return useEntity('metodosCobro', fetchMetodosCobro) }
export function useMetodosPago(): MetodoPago[] { return useEntity('metodosPago', fetchMetodosPago) }
export function useCheques(): Cheque[] { return useEntity('cheques', fetchCheques) }
export function useTarjetas(): TarjetaCredito[] { return useEntity('tarjetas', fetchTarjetas) }
export function useResumenesTarjeta(): ResumenTarjeta[] { return useEntity('resumenesTarjeta', fetchResumenesTarjeta) }
export function useCompromisosPago(): CompromisoPago[] { return useEntity('compromisosPago', fetchCompromisosPago) }
export function useProfiles(): Profile[] { return useEntity('profiles', fetchProfiles) }

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

// ─── RPC financieras — Caja/Disponible/Proyección/Flujo (Postgres, no JS) ───
// Toda la regla vive en las funciones SQL (0021_finanzas_rpc.sql); acá solo
// se invocan y cachean por parámetros. `cajaId` opcional filtra a una caja;
// sin él, las funciones agregan todas.

export interface CajaActualRow {
  cajaId: string; cajaNombre: string; saldoInicial: number
  ingresosAcreditados: number; pagosDebitados: number; saldoActual: number
}
export interface DisponibleFinanciero {
  cajaActual: number; cobrosConfirmadosPeriodo: number; compromisosPeriodo: number
  gastosFijosPeriodo: number; disponibleEstimado: number
}
export interface ProyeccionCajaDia {
  fecha: string; saldoInicialDia: number; ingresosConfirmados: number; ingresosEstimados: number
  pagosComprometidos: number; saldoFinal: number; enRojo: boolean
}
export interface FlujoCajaMes {
  mes: number; entradas: number; salidas: number; flujoNeto: number; saldoInicial: number; saldoFinal: number
}

export function useCajaActual(fechaCorte: string) {
  return useQuery({
    queryKey: ['porte', 'rpc', 'cajaActual', fechaCorte],
    queryFn: async (): Promise<CajaActualRow[]> => {
      const { data, error } = await supabase.rpc('get_caja_actual', { fecha_corte: fechaCorte })
      if (error) throw error
      return (data ?? []).map((r: Row) => ({
        cajaId: r.caja_id, cajaNombre: r.caja_nombre, saldoInicial: Number(r.saldo_inicial),
        ingresosAcreditados: Number(r.ingresos_acreditados), pagosDebitados: Number(r.pagos_debitados),
        saldoActual: Number(r.saldo_actual),
      }))
    },
  })
}

export function useDisponibleFinanciero(fechaDesde: string, fechaHasta: string, cajaId: string | null) {
  return useQuery({
    queryKey: ['porte', 'rpc', 'disponibleFinanciero', fechaDesde, fechaHasta, cajaId],
    queryFn: async (): Promise<DisponibleFinanciero | undefined> => {
      const { data, error } = await supabase.rpc('get_disponible_financiero', {
        fecha_desde: fechaDesde, fecha_hasta: fechaHasta, caja_id_param: cajaId,
      })
      if (error) throw error
      const r: Row | undefined = data?.[0]
      if (!r) return undefined
      return {
        cajaActual: Number(r.caja_actual), cobrosConfirmadosPeriodo: Number(r.cobros_confirmados_periodo),
        compromisosPeriodo: Number(r.compromisos_periodo), gastosFijosPeriodo: Number(r.gastos_fijos_periodo),
        disponibleEstimado: Number(r.disponible_estimado),
      }
    },
  })
}

export function useProyeccionCaja(fechaDesde: string, fechaHasta: string, cajaId: string | null) {
  return useQuery({
    queryKey: ['porte', 'rpc', 'proyeccionCaja', fechaDesde, fechaHasta, cajaId],
    queryFn: async (): Promise<ProyeccionCajaDia[]> => {
      const { data, error } = await supabase.rpc('get_proyeccion_caja', {
        fecha_desde: fechaDesde, fecha_hasta: fechaHasta, caja_id_param: cajaId,
      })
      if (error) throw error
      return (data ?? []).map((r: Row) => ({
        fecha: r.fecha, saldoInicialDia: Number(r.saldo_inicial_dia), ingresosConfirmados: Number(r.ingresos_confirmados),
        ingresosEstimados: Number(r.ingresos_estimados), pagosComprometidos: Number(r.pagos_comprometidos),
        saldoFinal: Number(r.saldo_final), enRojo: r.en_rojo,
      }))
    },
  })
}

/** Derivado en JS por ser una simple reducción sobre filas ya calculadas por SQL — no es una regla nueva, solo lectura del resultado de get_proyeccion_caja. */
export interface Descalce { primeraFechaNegativa: string | null; saldoMinimo: number; montoNecesarioCobertura: number }
export function calcularDescalce(dias: ProyeccionCajaDia[]): Descalce {
  const negativo = dias.find(d => d.enRojo)
  const saldoMinimo = dias.length ? Math.min(...dias.map(d => d.saldoFinal)) : 0
  return {
    primeraFechaNegativa: negativo?.fecha ?? null,
    saldoMinimo,
    montoNecesarioCobertura: saldoMinimo < 0 ? -saldoMinimo : 0,
  }
}

export function useFlujoCaja(anio: number, cajaId: string | null) {
  return useQuery({
    queryKey: ['porte', 'rpc', 'flujoCaja', anio, cajaId],
    queryFn: async (): Promise<FlujoCajaMes[]> => {
      const { data, error } = await supabase.rpc('get_flujo_caja', { anio, caja_id_param: cajaId })
      if (error) throw error
      return (data ?? []).map((r: Row) => ({
        mes: r.mes, entradas: Number(r.entradas), salidas: Number(r.salidas), flujoNeto: Number(r.flujo_neto),
        saldoInicial: Number(r.saldo_inicial), saldoFinal: Number(r.saldo_final),
      }))
    },
  })
}

export function usePendienteAcreditacion(fechaCorte: string, cajaId: string | null) {
  return useQuery({
    queryKey: ['porte', 'rpc', 'pendienteAcreditacion', fechaCorte, cajaId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_pendiente_acreditacion', { fecha_corte: fechaCorte, caja_id_param: cajaId })
      if (error) throw error
      return Number(data ?? 0)
    },
  })
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

  /**
   * Ingreso cobrado con cheque (sección "Ingresos con cheque" del pedido):
   * reutiliza la misma entidad `cheques` que Egresos, con `direccion='COBRO'`
   * y arranca en 'EN_CARTERA' — nunca 'ACREDITADO' desde que se carga, así
   * que `fechaAcreditacion` queda sin definir hasta que el cheque se marca
   * ACREDITADO (ver `useChequeActions.actualizarEstadoCheque`, que cascadea
   * la fecha real acá). No optimista, como `addEgresoConPago`: si el cheque
   * se crea pero el ingreso falla, el usuario tiene que enterarse.
   */
  const addIngresoConCheque = async (
    data: Omit<Ingreso, 'ref' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt' | 'estado' | 'fechaAcreditacion' | 'chequeId'>,
    cheque: { banco?: string; numero?: string; fechaVencimiento: string },
    userId: string,
  ): Promise<{ ok: true; ingreso: Ingreso } | { ok: false; error: string }> => {
    const now = new Date().toISOString()
    const current = queryClient.getQueryData<Ingreso[]>(porteKey('ingresos')) ?? []
    const ref = nextRef('IN', current)

    const { data: chequeRow, error: chequeError } = await supabase.from('cheques').insert({
      direccion: 'COBRO', numero: cheque.numero ?? null, banco: cheque.banco ?? null, monto: data.monto,
      fecha_emision: data.fecha, fecha_vencimiento: cheque.fechaVencimiento, caja_id: data.cajaId ?? null,
      estado: 'EN_CARTERA', created_by: userId,
    }).select('id').single()
    if (chequeError || !chequeRow) {
      logPersistError('addIngresoConCheque:cheque', chequeError)
      return { ok: false, error: 'No se pudo registrar el cheque' }
    }

    const nuevo: Ingreso = {
      ...data, ref, estado: 'Confirmado', chequeId: chequeRow.id,
      activo: true, createdAt: now, createdBy: userId, updatedAt: now,
    }
    const { error: ingresoError } = await supabase.from('ingresos')
      .insert({ ...ingresoToRow(nuevo), ref, created_by: userId, created_at: now, updated_at: now })
    if (ingresoError) {
      logPersistError('addIngresoConCheque:ingreso', ingresoError)
      return { ok: false, error: 'El cheque se registró pero no se pudo guardar el ingreso. Revisalo en Finanzas.' }
    }

    queryClient.setQueryData<Ingreso[]>(porteKey('ingresos'), prev => (prev ? [nuevo, ...prev] : prev))
    void queryClient.invalidateQueries({ queryKey: ['porte', 'cheques'] })
    void queryClient.invalidateQueries({ queryKey: ['porte', 'rpc'] })
    return { ok: true, ingreso: nuevo }
  }

  return { addIngreso, updateIngreso, removeIngreso, softDeleteIngreso, findDuplicateIngreso, addIngresoConCheque }
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

  /**
   * Crea el egreso y, según el método de pago elegido, el/los compromiso(s)
   * de pago que representan cuándo esa plata sale realmente de caja — es el
   * único lugar donde se genera un compromiso a partir de un egreso (sección
   * 6/8/9/10/11 del pedido). A diferencia de `addEgreso`, espera confirmación
   * real de Supabase en vez de optimista: si el egreso se guarda pero falla
   * el compromiso, el usuario tiene que enterarse (queda un egreso sin
   * registro financiero) en vez de ver un éxito falso.
   */
  const addEgresoConPago = async (
    data: Omit<Egreso, 'ref' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt' | 'estado' | 'fechaEmision' | 'fechaAcreditacion'>,
    pago: PagoEgresoInput,
    userId: string,
  ): Promise<{ ok: true; egreso: Egreso } | { ok: false; error: string }> => {
    const metodosPago = queryClient.getQueryData<MetodoPago[]>(porteKey('metodosPago')) ?? []
    const metodo = metodosPago.find(m => m.id === pago.metodoPagoId)
    if (!metodo) return { ok: false, error: 'Método de pago inválido' }

    const now = new Date().toISOString()
    const current = queryClient.getQueryData<Egreso[]>(porteKey('egresos')) ?? []
    const ref = nextRef('EG', current)
    const cajaId = pago.cajaId ?? metodo.cajaId ?? undefined
    const egreso: Egreso = { ...data, ref, cajaId, estado: 'Confirmado', activo: true, createdAt: now, createdBy: userId, updatedAt: now }

    const { error: egresoError } = await supabase.from('egresos')
      .insert({ ...egresoToRow(egreso), ref, created_by: userId, created_at: now, updated_at: now })
    if (egresoError) {
      logPersistError('addEgresoConPago:egreso', egresoError)
      return { ok: false, error: 'No se pudo guardar el egreso' }
    }

    try {
      if (metodo.tipo === 'INMEDIATO') {
        const { error } = await supabase.from('compromisos_pago').insert({
          egreso_id: ref, monto: egreso.monto, metodo_pago_id: metodo.id,
          fecha_vencimiento: egreso.fecha, fecha_acreditacion: egreso.fecha, caja_id: cajaId ?? null,
          estado: 'PAGADO', created_by: userId,
        })
        if (error) throw error
      } else if (metodo.tipo === 'CHEQUE') {
        if (!pago.chequeFechaVencimiento) throw new Error('Falta la fecha de vencimiento del cheque')
        const { data: cheque, error: chequeError } = await supabase.from('cheques').insert({
          direccion: 'PAGO', numero: pago.chequeNumero ?? null, banco: pago.chequeBanco ?? null, monto: egreso.monto,
          fecha_emision: egreso.fecha, fecha_vencimiento: pago.chequeFechaVencimiento, caja_id: cajaId ?? null,
          estado: 'EMITIDO', created_by: userId,
        }).select('id').single()
        if (chequeError || !cheque) throw chequeError ?? new Error('No se pudo crear el cheque')
        const { error } = await supabase.from('compromisos_pago').insert({
          egreso_id: ref, monto: egreso.monto, metodo_pago_id: metodo.id, fecha_vencimiento: pago.chequeFechaVencimiento,
          caja_id: cajaId ?? null, estado: 'PENDIENTE', cheque_id: cheque.id, created_by: userId,
        })
        if (error) throw error
      } else if (metodo.tipo === 'CUENTA_CORRIENTE') {
        const proveedores = queryClient.getQueryData<Proveedor[]>(porteKey('proveedores')) ?? []
        const proveedor = proveedores.find(p => p.idProv === data.proveedor)
        const vencimiento = pago.fechaVencimientoCC ?? addDaysLocal(egreso.fecha, proveedor?.plazoDias ?? 30)
        const { error } = await supabase.from('compromisos_pago').insert({
          egreso_id: ref, monto: egreso.monto, metodo_pago_id: metodo.id, fecha_vencimiento: vencimiento,
          caja_id: cajaId ?? null, estado: 'PENDIENTE', created_by: userId,
        })
        if (error) throw error
      } else if (metodo.tipo === 'TARJETA_CREDITO') {
        if (!pago.tarjetaId) throw new Error('Falta elegir la tarjeta')
        const tarjetas = queryClient.getQueryData<TarjetaCredito[]>(porteKey('tarjetas')) ?? []
        const tarjeta = tarjetas.find(t => t.id === pago.tarjetaId)
        if (!tarjeta) throw new Error('Tarjeta inválida')

        const cuotas = calcularCuotasTarjeta(egreso.fecha, egreso.monto, pago.cuotas ?? 1, tarjeta.diaVencimiento)
        for (const cuota of cuotas) {
          const { data: existente } = await supabase.from('resumenes_tarjeta')
            .select('id, monto').eq('tarjeta_id', tarjeta.id).eq('periodo', cuota.periodo).maybeSingle()

          let resumenId: string
          if (existente) {
            resumenId = existente.id
            const { error } = await supabase.from('resumenes_tarjeta')
              .update({ monto: Number(existente.monto) + cuota.monto, updated_at: now }).eq('id', resumenId)
            if (error) throw error
          } else {
            const { data: nuevoResumen, error } = await supabase.from('resumenes_tarjeta').insert({
              tarjeta_id: tarjeta.id, periodo: cuota.periodo, fecha_cierre: cuota.fechaVencimiento,
              fecha_vencimiento: cuota.fechaVencimiento, monto: cuota.monto, estado: 'PENDIENTE', created_by: userId,
            }).select('id').single()
            if (error || !nuevoResumen) throw error ?? new Error('No se pudo crear el resumen de tarjeta')
            resumenId = nuevoResumen.id
          }

          const { error: compromisoError } = await supabase.from('compromisos_pago').insert({
            egreso_id: ref, monto: cuota.monto, metodo_pago_id: metodo.id, fecha_vencimiento: cuota.fechaVencimiento,
            caja_id: cajaId ?? tarjeta.cajaDebitoId ?? null, estado: 'PENDIENTE',
            tarjeta_id: tarjeta.id, resumen_tarjeta_id: resumenId, created_by: userId,
          })
          if (compromisoError) throw compromisoError
        }
      }
    } catch (err) {
      logPersistError('addEgresoConPago:compromiso', err)
      return { ok: false, error: 'El egreso se guardó pero no se pudo generar el compromiso de pago. Revisalo en Finanzas.' }
    }

    queryClient.setQueryData<Egreso[]>(porteKey('egresos'), prev => (prev ? [egreso, ...prev] : prev))
    void queryClient.invalidateQueries({ queryKey: ['porte', 'compromisosPago'] })
    void queryClient.invalidateQueries({ queryKey: ['porte', 'cheques'] })
    void queryClient.invalidateQueries({ queryKey: ['porte', 'resumenesTarjeta'] })
    void queryClient.invalidateQueries({ queryKey: ['porte', 'rpc'] })
    return { ok: true, egreso }
  }

  /**
   * Vincula un cheque real a un egreso YA EXISTENTE (a diferencia de
   * `addEgresoConPago`, que solo corre al crear uno nuevo) — cubre el caso de
   * "esto en realidad se pagó/se va a pagar con cheque" descubierto después
   * de cargar el egreso. Crea el cheque (EMITIDO) + su compromiso_pago, igual
   * que la rama CHEQUE de `addEgresoConPago`, para que el egreso pase a
   * contar en el banner de "cheques todavía no debitados" de EgresosPage.
   */
  const attachChequeAEgreso = async (
    egresoRef: string,
    chequeInput: { banco?: string; numero?: string; fechaVencimiento: string },
    userId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const current = queryClient.getQueryData<Egreso[]>(porteKey('egresos')) ?? []
    const egreso = current.find(e => e.ref === egresoRef)
    if (!egreso) return { ok: false, error: 'Egreso no encontrado' }

    const metodosPago = queryClient.getQueryData<MetodoPago[]>(porteKey('metodosPago')) ?? []
    const metodoCheque = metodosPago.find(m => m.tipo === 'CHEQUE')

    const { data: cheque, error: chequeError } = await supabase.from('cheques').insert({
      direccion: 'PAGO', numero: chequeInput.numero || null, banco: chequeInput.banco || null, monto: egreso.monto,
      fecha_emision: egreso.fecha, fecha_vencimiento: chequeInput.fechaVencimiento, caja_id: egreso.cajaId ?? null,
      estado: 'EMITIDO', created_by: userId,
    }).select('id').single()
    if (chequeError || !cheque) {
      logPersistError('attachChequeAEgreso:cheque', chequeError)
      return { ok: false, error: 'No se pudo crear el cheque' }
    }

    const { error: compromisoError } = await supabase.from('compromisos_pago').insert({
      egreso_id: egresoRef, monto: egreso.monto, metodo_pago_id: metodoCheque?.id ?? null,
      fecha_vencimiento: chequeInput.fechaVencimiento, caja_id: egreso.cajaId ?? null,
      estado: 'PENDIENTE', cheque_id: cheque.id, created_by: userId,
    })
    if (compromisoError) {
      logPersistError('attachChequeAEgreso:compromiso', compromisoError)
      return { ok: false, error: 'El cheque se creó pero no se pudo vincular al egreso. Revisalo en Finanzas.' }
    }

    void queryClient.invalidateQueries({ queryKey: ['porte', 'compromisosPago'] })
    void queryClient.invalidateQueries({ queryKey: ['porte', 'cheques'] })
    void queryClient.invalidateQueries({ queryKey: ['porte', 'rpc'] })
    return { ok: true }
  }

  return { addEgreso, updateEgreso, removeEgreso, softDeleteEgreso, findDuplicateEgreso, addEgresoConPago, attachChequeAEgreso }
}

export interface PagoEgresoInput {
  metodoPagoId: string
  cajaId?: string
  chequeBanco?: string
  chequeNumero?: string
  chequeFechaVencimiento?: string
  fechaVencimientoCC?: string
  tarjetaId?: string
  cuotas?: number
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

  /**
   * Gasto fijo pagado con cheque (sección "Gastos Fijos con cheque" del
   * pedido): misma entidad `cheques`, `direccion='PAGO'`, arranca 'EMITIDO'
   * — igual que un egreso pagado con cheque. `fecha` sigue siendo el
   * vencimiento de la obligación; `fechaPagoEfectivo` (la salida real de
   * caja) queda sin definir hasta que el cheque se marca DEBITADO (ver
   * `useChequeActions.actualizarEstadoCheque`). Sirve tanto para alta como
   * edición (`existingId`) — no optimista, mismo criterio que
   * `addEgresoConPago`/`addIngresoConCheque`.
   */
  const guardarGastoFijoConCheque = async (
    data: Omit<GastoFijo, 'id' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt' | 'chequeId' | 'fechaPagoEfectivo'>,
    cheque: { banco?: string; numero?: string; fechaVencimiento: string },
    userId: string,
    existingId?: string,
  ): Promise<{ ok: true; gastoFijo: GastoFijo } | { ok: false; error: string }> => {
    const now = new Date().toISOString()

    const { data: chequeRow, error: chequeError } = await supabase.from('cheques').insert({
      direccion: 'PAGO', numero: cheque.numero ?? null, banco: cheque.banco ?? null, monto: data.montoPrevisto,
      fecha_emision: todayLocal(), fecha_vencimiento: cheque.fechaVencimiento, caja_id: data.cajaId ?? null,
      estado: 'EMITIDO', created_by: userId,
    }).select('id').single()
    if (chequeError || !chequeRow) {
      logPersistError('guardarGastoFijoConCheque:cheque', chequeError)
      return { ok: false, error: 'No se pudo registrar el cheque' }
    }

    const id = existingId ?? crypto.randomUUID()
    const gastoFijo: GastoFijo = {
      ...data, id, chequeId: chequeRow.id, fechaPagoEfectivo: null,
      activo: true, createdAt: now, createdBy: userId, updatedAt: now,
    }
    const { error } = existingId
      ? await supabase.from('gastos_fijos').update({ ...gastoFijoToRow(gastoFijo), updated_at: now }).eq('id', existingId)
      : await supabase.from('gastos_fijos').insert({ ...gastoFijoToRow(gastoFijo), created_by: userId, created_at: now, updated_at: now })
    if (error) {
      logPersistError('guardarGastoFijoConCheque:gastoFijo', error)
      return { ok: false, error: 'El cheque se registró pero no se pudo guardar el gasto fijo. Revisalo en Finanzas.' }
    }

    queryClient.setQueryData<GastoFijo[]>(porteKey('gastosFijos'), prev => {
      if (!prev) return prev
      return existingId ? prev.map(g => (g.id === existingId ? gastoFijo : g)) : [gastoFijo, ...prev]
    })
    void queryClient.invalidateQueries({ queryKey: ['porte', 'cheques'] })
    void queryClient.invalidateQueries({ queryKey: ['porte', 'rpc'] })
    return { ok: true, gastoFijo }
  }

  return { addGastoFijo, updateGastoFijo, softDeleteGastoFijo, guardarGastoFijoConCheque }
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

// ─── Finanzas — acciones (18/19_FINANZAS) ──────────────────────────────────

export function useCajaActions() {
  const queryClient = useQueryClient()

  const addCaja = (data: Omit<Caja, 'id' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): Caja => {
    const now = new Date().toISOString()
    const nuevo: Caja = { ...data, id: crypto.randomUUID(), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<Caja[]>(porteKey('cajas'), prev => (prev ? [...prev, nuevo] : prev))
    supabase.from('cajas').insert({ ...cajaToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addCaja', error) })
    return nuevo
  }

  const updateCaja = (id: string, data: Partial<Caja>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<Caja[]>(porteKey('cajas'), prev => prev?.map(c => (c.id === id ? { ...c, ...data, updatedAt: now } : c)))
    supabase.from('cajas').update({ ...cajaToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updateCaja', error) })
  }

  return { addCaja, updateCaja }
}

export function useMetodoCobroActions() {
  const queryClient = useQueryClient()

  const addMetodoCobro = (data: Omit<MetodoCobro, 'id' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): MetodoCobro => {
    const now = new Date().toISOString()
    const nuevo: MetodoCobro = { ...data, id: crypto.randomUUID(), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<MetodoCobro[]>(porteKey('metodosCobro'), prev => (prev ? [...prev, nuevo] : prev))
    supabase.from('metodos_cobro').insert({ ...metodoCobroToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addMetodoCobro', error) })
    return nuevo
  }

  const updateMetodoCobro = (id: string, data: Partial<MetodoCobro>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<MetodoCobro[]>(porteKey('metodosCobro'), prev => prev?.map(m => (m.id === id ? { ...m, ...data, updatedAt: now } : m)))
    supabase.from('metodos_cobro').update({ ...metodoCobroToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updateMetodoCobro', error) })
  }

  const softDeleteMetodoCobro = (id: string) => updateMetodoCobro(id, { activo: false })

  return { addMetodoCobro, updateMetodoCobro, softDeleteMetodoCobro }
}

export function useMetodoPagoActions() {
  const queryClient = useQueryClient()

  const addMetodoPago = (data: Omit<MetodoPago, 'id' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): MetodoPago => {
    const now = new Date().toISOString()
    const nuevo: MetodoPago = { ...data, id: crypto.randomUUID(), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<MetodoPago[]>(porteKey('metodosPago'), prev => (prev ? [...prev, nuevo] : prev))
    supabase.from('metodos_pago').insert({ ...metodoPagoToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addMetodoPago', error) })
    return nuevo
  }

  const updateMetodoPago = (id: string, data: Partial<MetodoPago>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<MetodoPago[]>(porteKey('metodosPago'), prev => prev?.map(m => (m.id === id ? { ...m, ...data, updatedAt: now } : m)))
    supabase.from('metodos_pago').update({ ...metodoPagoToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updateMetodoPago', error) })
  }

  const softDeleteMetodoPago = (id: string) => updateMetodoPago(id, { activo: false })

  return { addMetodoPago, updateMetodoPago, softDeleteMetodoPago }
}

export function useTarjetaActions() {
  const queryClient = useQueryClient()

  const addTarjeta = (data: Omit<TarjetaCredito, 'id' | 'activa' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string): TarjetaCredito => {
    const now = new Date().toISOString()
    const nuevo: TarjetaCredito = { ...data, id: crypto.randomUUID(), activa: true, createdAt: now, createdBy: userId, updatedAt: now }
    queryClient.setQueryData<TarjetaCredito[]>(porteKey('tarjetas'), prev => (prev ? [...prev, nuevo] : prev))
    supabase.from('tarjetas_credito').insert({ ...tarjetaToRow(nuevo), created_by: userId, created_at: now, updated_at: now })
      .then(({ error }) => { if (error) logPersistError('addTarjeta', error) })
    return nuevo
  }

  const updateTarjeta = (id: string, data: Partial<TarjetaCredito>) => {
    const now = new Date().toISOString()
    queryClient.setQueryData<TarjetaCredito[]>(porteKey('tarjetas'), prev => prev?.map(t => (t.id === id ? { ...t, ...data, updatedAt: now } : t)))
    supabase.from('tarjetas_credito').update({ ...tarjetaToRow(data), updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('updateTarjeta', error) })
  }

  const softDeleteTarjeta = (id: string) => updateTarjeta(id, { activa: false })

  return { addTarjeta, updateTarjeta, softDeleteTarjeta }
}

export function useCompromisoPagoActions() {
  const queryClient = useQueryClient()

  /**
   * Única vía que mueve caja real para un compromiso pendiente (cheque
   * debitado, cuenta corriente saldada, resumen de tarjeta pagado) — llama a
   * fn_marcar_compromiso_pagado (0019_finanzas_cheques_tarjetas_compromisos.sql),
   * que cascadea al cheque/resumen relacionado. No hay cache optimista acá:
   * espera confirmación real y después invalida todo lo financiero.
   */
  const marcarPagado = async (compromisoId: string, fecha: string, cajaId?: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { error } = await supabase.rpc('fn_marcar_compromiso_pagado', {
      p_compromiso_id: compromisoId, p_fecha: fecha, p_caja_id: cajaId ?? null,
    })
    if (error) {
      logPersistError('marcarPagado', error)
      return { ok: false, error: error.message ?? 'No se pudo marcar el compromiso como pagado' }
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['porte', 'compromisosPago'] }),
      queryClient.invalidateQueries({ queryKey: ['porte', 'cheques'] }),
      queryClient.invalidateQueries({ queryKey: ['porte', 'resumenesTarjeta'] }),
      queryClient.invalidateQueries({ queryKey: ['porte', 'rpc'] }),
    ])
    return { ok: true }
  }

  return { marcarPagado }
}

/**
 * Avanza el estado de un cheque de Ingreso o Gasto Fijo (llama a
 * fn_marcar_cheque_estado, 0024_finanzas_cheques_centralizados.sql) —
 * reutilizada por igual desde IngresosPage y GastosFijosPage a través del
 * diálogo genérico de cheque. Egresos sigue con `marcarPagado` de
 * `useCompromisoPagoActions` sin cambios: un cheque de egreso se enlaza vía
 * compromisos_pago, no directo, así que su cascada de caja vive en
 * fn_marcar_compromiso_pagado, no acá.
 */
export function useChequeActions() {
  const queryClient = useQueryClient()

  const actualizarEstadoCheque = async (
    chequeId: string, nuevoEstado: ChequeEstado, fecha: string, cajaId?: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { error } = await supabase.rpc('fn_marcar_cheque_estado', {
      p_cheque_id: chequeId, p_nuevo_estado: nuevoEstado, p_fecha: fecha, p_caja_id: cajaId ?? null,
    })
    if (error) {
      logPersistError('actualizarEstadoCheque', error)
      return { ok: false, error: error.message ?? 'No se pudo actualizar el estado del cheque' }
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['porte', 'cheques'] }),
      queryClient.invalidateQueries({ queryKey: ['porte', 'ingresos'] }),
      queryClient.invalidateQueries({ queryKey: ['porte', 'gastosFijos'] }),
      queryClient.invalidateQueries({ queryKey: ['porte', 'rpc'] }),
    ])
    return { ok: true }
  }

  return { actualizarEstadoCheque }
}
