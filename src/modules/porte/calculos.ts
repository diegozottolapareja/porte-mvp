import { MOCK_INGRESOS, type Ingreso } from './data/ingresos'
import { MOCK_EGRESOS, type Egreso } from './data/egresos'
import type { Venta } from './data/ventas'
import type { Presupuesto } from './data/presupuestos'

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

// ─── Transición Presupuesto → Venta (mismo momento en que estadoComercial pasa a 'Aceptado') ──
// Función pura para que sea trivial de mover al backend: no toca estado de React,
// solo recibe datos y devuelve el resultado de la transición.

export type NuevaVenta = Omit<Venta, 'createdAt' | 'createdBy' | 'updatedAt'>

export interface ResultadoAceptacion {
  venta?: NuevaVenta
  errorValidacion?: string
  duplicado?: boolean
}

export function validarPresupuestoParaVenta(p: Pick<Presupuesto, 'cliente' | 'montoTotal'>): string | undefined {
  const montoValido = typeof p.montoTotal === 'number' && Number.isFinite(p.montoTotal) && p.montoTotal > 0
  if (!p.cliente?.trim() || !montoValido) {
    return 'No se puede aceptar un presupuesto sin cliente o sin monto cargado'
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

/** Idempotente: si ya existe una venta con ese id no crea un duplicado (equivalente a WARNING_DUPLICADO). */
export function procesarAceptacionPresupuesto(
  p: Presupuesto,
  ventasExistentes: Venta[],
  ahora: string,
): ResultadoAceptacion {
  const errorValidacion = validarPresupuestoParaVenta(p)
  if (errorValidacion) return { errorValidacion }

  if (ventasExistentes.some(v => v.id === p.id)) {
    // eslint-disable-next-line no-console
    console.warn(`WARNING_DUPLICADO: ya existe una venta para ${p.id}, se omite la creación`)
    return { duplicado: true }
  }

  return { venta: construirVentaDesdePresupuesto(p, ahora) }
}

export function presupuestoTieneVentaAsociada(id: string, ventas: Venta[]): boolean {
  return ventas.some(v => v.id === id)
}
