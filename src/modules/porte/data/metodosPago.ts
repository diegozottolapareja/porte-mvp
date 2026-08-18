// ─── Métodos de pago (18_FINANZAS) ──────────────────────────────────────────
// Cómo se paga un egreso — determina qué compromiso(s) genera: INMEDIATO se
// paga y descuenta caja en el momento, los otros tres generan un compromiso
// PENDIENTE que recién impacta caja cuando se marca pagado.

export const METODO_PAGO_TIPOS = ['INMEDIATO', 'CHEQUE', 'CUENTA_CORRIENTE', 'TARJETA_CREDITO'] as const
export type MetodoPagoTipo = (typeof METODO_PAGO_TIPOS)[number]

export interface MetodoPago {
  id: string
  nombre: string
  tipo: MetodoPagoTipo
  cajaId: string | null
  activo: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
}
