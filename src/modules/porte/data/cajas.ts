// ─── Cajas (18_FINANZAS) ────────────────────────────────────────────────────
// Cuenta real con saldo — antes `cuenta`/`caja` en ingresos/egresos/gastos_fijos
// eran solo etiquetas de texto, sin una entidad propia. Una fila por cada
// cuenta operativa (Banco Macro, MercadoPago, Efectivo Blanco, Efectivo Negro).

export interface Caja {
  id: string
  nombre: string
  tipoCaja: string
  saldoInicial: number
  fechaSaldoInicial: string | null
  activo: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
}
