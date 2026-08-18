// ─── Compromisos de pago (19_FINANZAS) ──────────────────────────────────────
// El evento financiero real de un egreso — cuándo y cómo esa plata sale de
// una caja. Un egreso puede tener 1..N (ej. compra dividida en transferencia
// + cheque + cuenta corriente). Es la fuente que leen get_caja_actual/
// get_disponible_financiero/get_proyeccion_caja/get_flujo_caja, nunca
// egresos.monto directo.

export const COMPROMISO_ESTADOS = ['PENDIENTE', 'PAGADO', 'CANCELADO'] as const
export type CompromisoEstado = (typeof COMPROMISO_ESTADOS)[number]

export interface CompromisoPago {
  id: string
  egresoId: string | null
  monto: number
  metodoPagoId: string | null
  fechaVencimiento: string
  fechaAcreditacion: string | null
  cajaId: string | null
  estado: CompromisoEstado
  chequeId: string | null
  tarjetaId: string | null
  resumenTarjetaId: string | null
  createdAt: string
  createdBy: string
  updatedAt: string
}
