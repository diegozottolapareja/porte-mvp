// ─── Cheques (19_FINANZAS) ──────────────────────────────────────────────────
// Reemplaza el flag ad-hoc egresos.estado='Emitido' + fechaEmision/
// fechaAcreditacion del checkbox "Es un cheque" anterior. Un cheque emitido
// no baja caja — recién cuando se debita (fn_marcar_compromiso_pagado).

export const CHEQUE_ESTADOS = ['EMITIDO', 'ENTREGADO', 'DEBITADO', 'RECHAZADO', 'ANULADO'] as const
export type ChequeEstado = (typeof CHEQUE_ESTADOS)[number]

export interface Cheque {
  id: string
  numero: string | null
  banco: string | null
  monto: number
  fechaEmision: string
  fechaVencimiento: string
  fechaAcreditacion: string | null
  cajaId: string | null
  estado: ChequeEstado
  createdAt: string
  createdBy: string
  updatedAt: string
}
