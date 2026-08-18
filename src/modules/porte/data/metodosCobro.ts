import type { MetodoPagoTipo } from './metodosPago'

// ─── Métodos de cobro (18_FINANZAS) ─────────────────────────────────────────
// Configuración de cómo un ingreso se acredita: días hasta que la plata está
// disponible y comisión descontada — se derivan automáticamente en el form
// de ingreso, en vez de hardcodearse.

export interface MetodoCobro {
  id: string
  nombre: string
  diasAcreditacion: number
  comisionPorcentaje: number
  cajaId: string | null
  // Mismo enum que metodos_pago.tipo (22_FINANZAS) — hoy todo método de cobro
  // existente es INMEDIATO (el ingreso ya está en caja al cargarse); el campo
  // queda listo para el día que haya un método de cobro no inmediato.
  tipo: MetodoPagoTipo
  activo: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
}
