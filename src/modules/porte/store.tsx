import { createContext, useContext, useState, type ReactNode } from 'react'
import { MOCK_INGRESOS, type Ingreso } from './data/ingresos'
import { MOCK_EGRESOS, type Egreso } from './data/egresos'
import { MOCK_PRESUPUESTOS, type Presupuesto } from './data/presupuestos'
import { MOCK_VENTAS, type Venta } from './data/ventas'
import { MOCK_PROVEEDORES, type Proveedor } from './data/proveedores'
import { MOCK_GASTOS_FIJOS, type GastoFijo } from './data/gastosFijos'
import { MOCK_VARIACIONES, type Variacion } from './data/variaciones'
import { MOCK_APRENDIZAJES, type Aprendizaje } from './data/aprendizajes'
import { procesarAceptacionPresupuesto } from './calculos'

// ─── Store en memoria para altas/ediciones/bajas en runtime ──────────────────
// No hay backend todavía — esto simula la persistencia mientras se conecta la API real.

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
   * `overrides` permite pasar cambios de campos que se están guardando en el mismo
   * submit (ej. desde el formulario completo) para validar contra los valores nuevos.
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
  const [ingresos, setIngresos] = useState<Ingreso[]>(MOCK_INGRESOS)
  const [egresos, setEgresos] = useState<Egreso[]>(MOCK_EGRESOS)
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>(MOCK_PRESUPUESTOS)
  const [ventas, setVentas] = useState<Venta[]>(MOCK_VENTAS)
  const [proveedores, setProveedores] = useState<Proveedor[]>(MOCK_PROVEEDORES)
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>(MOCK_GASTOS_FIJOS)
  const [variaciones, setVariaciones] = useState<Variacion[]>(MOCK_VARIACIONES)
  const [aprendizajes, setAprendizajes] = useState<Aprendizaje[]>(MOCK_APRENDIZAJES)

  const addIngreso: PorteDataContextType['addIngreso'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Ingreso = { ...data, ref: nextRef('IN', ingresos), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setIngresos(prev => [nuevo, ...prev])
    return nuevo
  }

  const addEgreso: PorteDataContextType['addEgreso'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Egreso = { ...data, ref: nextRef('EG', egresos), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setEgresos(prev => [nuevo, ...prev])
    return nuevo
  }

  const addPresupuesto: PorteDataContextType['addPresupuesto'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Presupuesto = { ...data, activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setPresupuestos(prev => [nuevo, ...prev])
    return nuevo
  }

  const addVenta: PorteDataContextType['addVenta'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Venta = { ...data, createdAt: now, createdBy: userId, updatedAt: now }
    setVentas(prev => [nuevo, ...prev])
    return nuevo
  }

  const addProveedor: PorteDataContextType['addProveedor'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Proveedor = { ...data, idProv: nextSeqId('PROV', proveedores.map(p => p.idProv)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setProveedores(prev => [nuevo, ...prev])
    return nuevo
  }

  const addGastoFijo: PorteDataContextType['addGastoFijo'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: GastoFijo = { ...data, activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setGastosFijos(prev => [nuevo, ...prev])
    return nuevo
  }

  const addVariacion: PorteDataContextType['addVariacion'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Variacion = { ...data, idVar: nextSeqId('VAR', variaciones.map(v => v.idVar)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setVariaciones(prev => [nuevo, ...prev])
    return nuevo
  }

  const addAprendizaje: PorteDataContextType['addAprendizaje'] = (data, userId) => {
    const now = new Date().toISOString()
    const nuevo: Aprendizaje = { ...data, idApr: nextSeqId('APR', aprendizajes.map(a => a.idApr)), activo: true, createdAt: now, createdBy: userId, updatedAt: now }
    setAprendizajes(prev => [nuevo, ...prev])
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

  const updatePresupuesto: PorteDataContextType['updatePresupuesto'] = (id, data) =>
    setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p))

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

    return { ok: true, venta: ventaCreada, duplicado: resultado.duplicado }
  }

  const updateIngreso: PorteDataContextType['updateIngreso'] = (ref, data) =>
    setIngresos(prev => prev.map(i => i.ref === ref ? { ...i, ...data, updatedAt: new Date().toISOString() } : i))
  const updateEgreso: PorteDataContextType['updateEgreso'] = (ref, data) =>
    setEgresos(prev => prev.map(e => e.ref === ref ? { ...e, ...data, updatedAt: new Date().toISOString() } : e))

  const updateVenta: PorteDataContextType['updateVenta'] = (id, data) =>
    setVentas(prev => prev.map(v => v.id === id ? { ...v, ...data, updatedAt: new Date().toISOString() } : v))

  const updateProveedor: PorteDataContextType['updateProveedor'] = (idProv, data) =>
    setProveedores(prev => prev.map(p => p.idProv === idProv ? { ...p, ...data, updatedAt: new Date().toISOString() } : p))
  const updateGastoFijo: PorteDataContextType['updateGastoFijo'] = (key, data) =>
    setGastosFijos(prev => prev.map(g => gastoFijoKey(g) === key ? { ...g, ...data, updatedAt: new Date().toISOString() } : g))
  const updateVariacion: PorteDataContextType['updateVariacion'] = (idVar, data) =>
    setVariaciones(prev => prev.map(v => v.idVar === idVar ? { ...v, ...data, updatedAt: new Date().toISOString() } : v))
  const updateAprendizaje: PorteDataContextType['updateAprendizaje'] = (idApr, data) =>
    setAprendizajes(prev => prev.map(a => a.idApr === idApr ? { ...a, ...data, updatedAt: new Date().toISOString() } : a))

  const removeIngreso = (ref: string) => setIngresos(prev => prev.filter(i => i.ref !== ref))
  const removeEgreso = (ref: string) => setEgresos(prev => prev.filter(e => e.ref !== ref))

  const softDeleteIngreso = (ref: string) =>
    setIngresos(prev => prev.map(i => i.ref === ref ? { ...i, activo: false, updatedAt: new Date().toISOString() } : i))
  const softDeleteEgreso = (ref: string) =>
    setEgresos(prev => prev.map(e => e.ref === ref ? { ...e, activo: false, updatedAt: new Date().toISOString() } : e))
  const softDeletePresupuesto = (id: string) =>
    setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, activo: false, updatedAt: new Date().toISOString() } : p))
  const softDeleteProveedor = (idProv: string) =>
    setProveedores(prev => prev.map(p => p.idProv === idProv ? { ...p, activo: false, updatedAt: new Date().toISOString() } : p))
  const softDeleteGastoFijo = (key: string) =>
    setGastosFijos(prev => prev.map(g => gastoFijoKey(g) === key ? { ...g, activo: false, updatedAt: new Date().toISOString() } : g))
  const softDeleteVariacion = (idVar: string) =>
    setVariaciones(prev => prev.map(v => v.idVar === idVar ? { ...v, activo: false, updatedAt: new Date().toISOString() } : v))
  const softDeleteAprendizaje = (idApr: string) =>
    setAprendizajes(prev => prev.map(a => a.idApr === idApr ? { ...a, activo: false, updatedAt: new Date().toISOString() } : a))

  const findDuplicateIngreso: PorteDataContextType['findDuplicateIngreso'] = (obraId, monto, fecha) =>
    ingresos.find(i => i.activo && i.id === obraId && i.monto === monto && i.fecha === fecha)

  const findDuplicateEgreso: PorteDataContextType['findDuplicateEgreso'] = (obraId, monto, fecha) =>
    egresos.find(e => e.activo && e.id === obraId && e.monto === monto && e.fecha === fecha)

  return (
    <PorteDataContext.Provider
      value={{
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
