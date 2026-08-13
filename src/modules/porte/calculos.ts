import { MOCK_INGRESOS, type Ingreso } from './data/ingresos'
import { MOCK_EGRESOS, type Egreso } from './data/egresos'
import type { Venta } from './data/ventas'
import type { Presupuesto } from './data/presupuestos'
import type { EstadoCobro, RentabilidadRating, CondicionPago, TipoCaja } from './data/config'

// ─── Derivados de una venta — no se guardan, se calculan en runtime ──────────
// Aceptan `ingresos`/`egresos` opcionales para leer del store en runtime;
// sin argumento caen al MOCK_* estático (usos fuera de la app / tests).

export function getTotalCobrado(ventaId: string, ingresos: Ingreso[] = MOCK_INGRESOS): number {
  return ingresos
    .filter(i => i.activo && i.id === ventaId && i.estado === 'Confirmado')
    .reduce((sum, i) => sum + i.monto, 0)
}

export function getTotalEgresado(ventaId: string, egresos: Egreso[] = MOCK_EGRESOS): number {
  return egresos
    .filter(e => e.activo && e.id === ventaId && e.estado !== 'Pendiente')
    .reduce((sum, e) => sum + e.monto, 0)
}

export function getSaldoPendiente(venta: Venta, ingresos: Ingreso[] = MOCK_INGRESOS): number {
  return venta.ventaFinal - getTotalCobrado(venta.id, ingresos)
}

export function getCostoEstimado(venta: Venta): number {
  return venta.mater + venta.mo + venta.indVend + venta.imp + venta.comerc
}

export function getDesvioCosto(venta: Venta, egresos: Egreso[] = MOCK_EGRESOS): number {
  return getTotalEgresado(venta.id, egresos) - getCostoEstimado(venta)
}

export interface CosteRealCategoria {
  categoria: string
  total: number
}

/**
 * Coste real de la venta, agrupado por categoría de egreso — excluye la
 * categoría IMPUESTOS y los egresos en estado Pendiente (no representan
 * salida efectiva todavía). No incluye lógica de compra-vs-pago ni de caja:
 * es una lectura directa de los egresos asociados (id_obra = venta.id).
 */
export function getCosteRealPorCategoria(ventaId: string, egresos: Egreso[] = MOCK_EGRESOS): CosteRealCategoria[] {
  const relevantes = egresos.filter(e => e.activo && e.id === ventaId && e.estado !== 'Pendiente' && e.categoria !== 'IMPUESTOS')
  const porCategoria = new Map<string, number>()
  for (const e of relevantes) {
    porCategoria.set(e.categoria, (porCategoria.get(e.categoria) ?? 0) + e.monto)
  }
  return [...porCategoria.entries()].map(([categoria, total]) => ({ categoria, total }))
}

export function getCosteRealTotal(ventaId: string, egresos: Egreso[] = MOCK_EGRESOS): number {
  return getCosteRealPorCategoria(ventaId, egresos).reduce((sum, c) => sum + c.total, 0)
}

/** Estado financiero de la obra según lo cobrado — eje independiente del estado de taller (estadoOp). */
export function getEstadoCobro(venta: Venta, ingresos: Ingreso[] = MOCK_INGRESOS): EstadoCobro {
  const cobrado = getTotalCobrado(venta.id, ingresos)
  if (cobrado <= 0) return 'Pendiente de anticipo'
  if (cobrado >= venta.ventaFinal) return 'Cobrado'
  return 'Cobro parcial'
}

// Umbrales sobre el desvío de costeo (egresado real vs. estimado), como % del
// costo estimado. Sin egresos registrados no hay base para calificar la obra.
const UMBRAL_RENTABILIDAD_BUENA = 0.05
const UMBRAL_RENTABILIDAD_REGULAR = 0.15

/** Nota de rentabilidad por obra a partir del desvío de costeo — undefined si todavía no hay egresos cargados. */
export function getRentabilidadRating(venta: Venta, egresos: Egreso[] = MOCK_EGRESOS): RentabilidadRating | undefined {
  if (getTotalEgresado(venta.id, egresos) <= 0) return undefined
  const costoEstimado = getCostoEstimado(venta)
  if (costoEstimado <= 0) return undefined
  const desvioPct = getDesvioCosto(venta, egresos) / costoEstimado
  if (desvioPct <= UMBRAL_RENTABILIDAD_BUENA) return 'Buena'
  if (desvioPct <= UMBRAL_RENTABILIDAD_REGULAR) return 'Regular'
  return 'Mala'
}

// ─── Transición Presupuesto → Venta ────────────────────────────────────────
// Flujo en dos pasos: Aceptar (solo cambia estadoComercial) → completar
// Condiciones comerciales → Convertir en venta (recién ahí se crea la Venta,
// congelando los costos del presupuesto). Funciones puras: no tocan estado de
// React, solo reciben datos y devuelven el resultado — trivial de mover al backend.

export type NuevaVenta = Omit<Venta, 'createdAt' | 'createdBy' | 'updatedAt'>

export function validarPresupuestoParaVenta(p: Pick<Presupuesto, 'cliente' | 'montoTotal'>): string | undefined {
  const montoValido = typeof p.montoTotal === 'number' && Number.isFinite(p.montoTotal) && p.montoTotal > 0
  if (!p.cliente?.trim() || !montoValido) {
    return 'No se puede convertir un presupuesto sin cliente o sin monto cargado'
  }
  return undefined
}

export function construirVentaDesdePresupuesto(p: Presupuesto, ahora: string): NuevaVenta {
  return {
    id: p.id,
    cliente: p.cliente,
    montoTotal: p.montoTotal ?? 0,
    mater: p.costoMat ?? 0,
    mo: p.costoMo ?? 0,
    indVend: p.indVendidos ?? 0,
    imp: p.impuestos ?? 0,
    comerc: p.comercial ?? 0,
    benef: p.beneficio ?? 0,
    fechaCierre: ahora,
    ventaFinal: p.montoTotal ?? 0,
    estadoOp: 'Pendiente',
    respOp: '',
  }
}

// Condiciones comerciales obligatorias para convertir un presupuesto Aceptado
// en Venta — entregaReal queda afuera a propósito: se completa después desde
// el detalle de la venta. Espejo en JS de trg_validar_condiciones_comerciales
// (Supabase), que es la barrera real, no bypasseable desde el frontend.
export interface CondicionesComerciales {
  condPago: CondicionPago
  vencCobro: string
  cajaIntenc: TipoCaja
  entregaCompr: string
  respOp: string
  dias?: number
}

export function validarCondicionesComerciales(c: Partial<CondicionesComerciales>): string | undefined {
  if (!c.condPago || !c.vencCobro || !c.cajaIntenc || !c.entregaCompr || !c.respOp?.trim()) {
    return 'Completá condición de pago, vencimiento de cobro, caja intención, entrega comprometida y responsable'
  }
  return undefined
}

export function presupuestoTieneVentaAsociada(id: string, ventas: Venta[]): boolean {
  return ventas.some(v => v.id === id)
}
