// ─── Tarjetas de crédito y resúmenes (19_FINANZAS) ─────────────────────────
// Una compra con tarjeta genera deuda, no salida inmediata de caja. Cada
// cuota es un compromiso_pago propio, agrupado por resumen (mismo período de
// cierre) para poder pagar el resumen completo de una vez.

export interface TarjetaCredito {
  id: string
  nombre: string
  banco: string | null
  cajaDebitoId: string | null
  diaCierre: number
  diaVencimiento: number
  activa: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
}

export const RESUMEN_TARJETA_ESTADOS = ['PENDIENTE', 'PAGADO'] as const
export type ResumenTarjetaEstado = (typeof RESUMEN_TARJETA_ESTADOS)[number]

export interface ResumenTarjeta {
  id: string
  tarjetaId: string
  periodo: string
  fechaCierre: string
  fechaVencimiento: string
  monto: number
  estado: ResumenTarjetaEstado
  createdAt: string
  createdBy: string
  updatedAt: string
}
