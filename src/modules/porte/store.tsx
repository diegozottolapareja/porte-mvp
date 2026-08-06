import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/app/contexts/AuthContext'
import type { Ingreso } from './data/ingresos'
import type { Egreso } from './data/egresos'
import type { Presupuesto } from './data/presupuestos'
import type { Venta } from './data/ventas'
import type { Proveedor } from './data/proveedores'
import type { GastoFijo } from './data/gastosFijos'
import type { Variacion } from './data/variaciones'
import type { Aprendizaje } from './data/aprendizajes'
import { procesarAceptacionPresupuesto } from './calculos'
import {
  rowToIngreso, ingresoToRow, rowToEgreso, egresoToRow, rowToPresupuesto, presupuestoToRow,
  rowToVenta, ventaToRow, rowToProveedor, proveedorToRow, rowToGastoFijo, gastoFijoToRow,
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
  gastosFijos: GastoFijo[]
  variaciones: Variacion[]
  aprendizajes: Aprendizaje[]

  addIngreso: (data: Omit<Ingreso, 'ref' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Ingreso
  addEgreso: (data: Omit<Egreso, 'ref' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Egreso
  addPresupuesto: (data: Omit<Presupuesto, 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Presupuesto
  addVenta: (data: Omit<Venta, 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Venta
  addProveedor: (data: Omit<Proveedor, 'idProv' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Proveedor
  addGastoFijo: (data: Omit<GastoFijo, 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => GastoFijo
  addVariacion: (data: Omit<Variacion, 'idVar' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Variacion
  addAprendizaje: (data: Omit<Aprendizaje, 'idApr' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>, userId: string) => Aprendizaje

  updateIngreso: (ref: string, data: Partial<Ingreso>) => void
  updateEgreso: (ref: string, data: Partial<Egreso>) => void
  updatePresupuesto: (id: string, data: Partial<Presupuesto>) => void
  updateVenta: (id: string, data: Partial<Venta>) => void
  updateProveedor: (idProv: string, data: Partial<Proveedor>) => void
  updateGastoFijo: (key: string, data: Partial<GastoFijo>) => void
  updateVariacion: (idVar: string, data: Partial<Variacion>) => void
  updateAprendizaje: (idApr: string, data: Partial<Aprendizaje>) => void

  nextPresupuestoId: () => string

  /**
   * Transición Presupuesto → Venta: crea la venta en el mismo acto en que el
   * presupuesto pasa a 'Aceptado'. Idempotente (no duplica si la venta ya existe).
   * Valida del lado del cliente para feedback inmediato — el trigger de la base
   * (fn_aceptar_presupuesto) es la barrera real, no bypasseable desde el frontend.
   */
  aceptarPresupuesto: (
    id: string,
    userId: string,
    overrides?: Partial<Presupuesto>,
  ) => { ok: true; venta?: Venta; duplicado?: boolean } | { ok: false; error: string }

  removeIngreso: (ref: string) => void
  removeEgreso: (ref: string) => void

  softDeleteIngreso: (ref: string) => void
  softDeleteEgreso: (ref: string) => void
  softDeletePresupuesto: (id: string) => void
  softDeleteProveedor: (idProv: string) => void
  softDeleteGastoFijo: (key: string) => void
  softDeleteVariacion: (idVar: string) => void
  softDeleteAprendizaje: (idApr: string) => void

  findDuplicateIngreso: (obraId: string, monto: number, fecha: string) => Ingreso | undefined
  findDuplicateEgreso: (obraId: string | undefined, monto: number, fecha: string) => Egreso | undefined
}

const PorteDataContext = createContext<PorteDataContextType | undefined>(undefined)

// GastoFijo no tiene clave primaria propia en el Excel — se identifica por concepto+fecha, igual que en las listas.
export function gastoFijoKey(g: Pick<GastoFijo, 'concepto' | 'fecha'>): string {
  return `${g.concepto}-${g.fecha}`
}

export function PorteDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
  const [variaciones, setVariaciones] = useState<Variacion[]>([])
  const [aprendizajes, setAprendizajes] = useState<Aprendizaje[]>([])

  useEffect(() => {
    if (!isAuthenticated) {
      setIngresos([]); setEgresos([]); setPresupuestos([]); setVentas([])
      setProveedores([]); setGastosFijos([]); setVariaciones([]); setAprendizajes([])
      setIsLoading(true)
      return
    }

    let cancelled = false
    async function loadAll() {
      const [ing, egr, pre, ven, prov, gf, vcar, apr] = await Promise.all([
        supabase.from('ingresos').select('*').order('created_at', { ascending: false }),
        supabase.from('egresos').select('*').order('created_at', { ascending: false }),
        supabase.from('presupuestos').select('*').order('created_at', { ascending: false }),
        supabase.from('v_ventas_detalle').select('*').order('created_at', { ascending: false }),
        supabase.from('v_proveedores_saldo').select('*'),
        supabase.from('gastos_fijos').select('*').order('created_at', { ascending: false }),
        supabase.from('variaciones').select('*').order('created_at', { ascending: false }),
        supabase.from('aprendizajes').select('*').order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      if (ing.data) setIngresos(ing.data.map(rowToIngreso))
      if (egr.data) setEgresos(egr.data.map(rowToEgreso))
      if (pre.data) setPresupuestos(pre.data.map(rowToPresupuesto))
      if (ven.data) setVentas(ven.data.map(rowToVenta))
      if (prov.data) setProveedores(prov.data.map(rowToProveedor))
      if (gf.data) setGastosFijos(gf.data.map(rowToGastoFijo))
      if (vcar.data) setVariaciones(vcar.data.map(rowToVariacion))
      if (apr.data) setAprendizajes(apr.data.map(rowToAprendizaje))
      setIsLoading(false)
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
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [isAuthenticated])

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

  const addGastoFijo: PorteDataContextType['addGastoFijo'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: GastoFijo = { ...data, activo: true, createdAt: now, createdBy: userId, updatedAt: now }
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

  const aceptarPresupuesto: PorteDataContextType['aceptarPresupuesto'] = (id, userId, overrides) => {
    const existente = presupuestos.find(p => p.id === id)
    if (!existente) return { ok: false, error: 'Presupuesto no encontrado' }

    const candidato = { ...existente, ...overrides, estadoComercial: 'Aceptado' as const }
    const now = new Date().toISOString()
    const resultado = procesarAceptacionPresupuesto(candidato, ventas, now)
    if (resultado.errorValidacion) return { ok: false, error: resultado.errorValidacion }

    setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, ...overrides, estadoComercial: 'Aceptado', updatedAt: now } : p))

    let ventaCreada: Venta | undefined
    if (resultado.venta) {
      ventaCreada = { ...resultado.venta, createdAt: now, createdBy: userId, updatedAt: now }
      setVentas(prev => [ventaCreada!, ...prev])
    }

    // El update dispara fn_aceptar_presupuesto en la base, que crea la venta real
    // (idempotente vía on conflict do nothing) — el insert local ya hecho arriba
    // queda como espejo optimista, sin duplicar nada del lado del servidor.
    supabase.from('presupuestos').update({ ...presupuestoToRow(overrides ?? {}), estado_comercial: 'Aceptado', updated_at: now }).eq('id', id)
      .then(({ error }) => { if (error) logPersistError('aceptarPresupuesto', error) })

    return { ok: true, venta: ventaCreada, duplicado: resultado.duplicado }
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
  const updateGastoFijo: PorteDataContextType['updateGastoFijo'] = (key, data) => {
    const now = new Date().toISOString()
    const target = gastosFijos.find(g => gastoFijoKey(g) === key)
    setGastosFijos(prev => prev.map(g => gastoFijoKey(g) === key ? { ...g, ...data, updatedAt: now } : g))
    if (target) {
      supabase.from('gastos_fijos').update({ ...gastoFijoToRow(data), updated_at: now })
        .eq('concepto', target.concepto).eq('fecha', target.fecha)
        .then(({ error }) => { if (error) logPersistError('updateGastoFijo', error) })
    }
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
  const softDeleteGastoFijo = (key: string) => updateGastoFijo(key, { activo: false })
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
        ingresos, egresos, presupuestos, ventas, proveedores, gastosFijos, variaciones, aprendizajes,
        addIngreso, addEgreso, addPresupuesto, addVenta, addProveedor, addGastoFijo, addVariacion, addAprendizaje,
        updateIngreso, updateEgreso, updatePresupuesto, updateVenta, updateProveedor, updateGastoFijo, updateVariacion, updateAprendizaje,
        nextPresupuestoId,
        aceptarPresupuesto,
        removeIngreso, removeEgreso,
        softDeleteIngreso, softDeleteEgreso, softDeletePresupuesto, softDeleteProveedor, softDeleteGastoFijo, softDeleteVariacion, softDeleteAprendizaje,
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
