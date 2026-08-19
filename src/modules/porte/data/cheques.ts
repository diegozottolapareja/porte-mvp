// ─── Cheques (19/23_FINANZAS) ───────────────────────────────────────────────
// Entidad única reutilizada por Egresos (cheque emitido, `direccion='PAGO'`,
// enlazado indirecto vía compromisos_pago.cheque_id), Ingresos (cheque
// recibido, `direccion='COBRO'`, enlazado directo vía ingresos.cheque_id) y
// Gastos Fijos (cheque emitido, enlazado directo vía gastos_fijos.cheque_id).
// No hay ChequeIngreso/ChequeEgreso/ChequeGastoFijo — un solo modelo, estados
// y transiciones centralizados acá.

export const CHEQUE_DIRECCIONES = ['PAGO', 'COBRO'] as const
export type ChequeDireccion = (typeof CHEQUE_DIRECCIONES)[number]

// PAGO (lo emitimos nosotros): EMITIDO → ENTREGADO → DEBITADO | RECHAZADO,
// con ANULADO posible antes de entregarlo. COBRO (lo recibimos de un
// cliente): EN_CARTERA → DEPOSITADO → ACREDITADO | RECHAZADO — sin endoso ni
// cesión por ahora (fuera de alcance).
export const CHEQUE_ESTADOS = ['EMITIDO', 'ENTREGADO', 'DEBITADO', 'EN_CARTERA', 'DEPOSITADO', 'ACREDITADO', 'RECHAZADO', 'ANULADO'] as const
export type ChequeEstado = (typeof CHEQUE_ESTADOS)[number]

export interface Cheque {
  id: string
  direccion: ChequeDireccion
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

/** Estado con el que nace un cheque nuevo, según para qué lado se está cargando. */
export function estadoInicialCheque(direccion: ChequeDireccion): ChequeEstado {
  return direccion === 'PAGO' ? 'EMITIDO' : 'EN_CARTERA'
}

// Única fuente de verdad de qué transición es válida — la usan por igual el
// diálogo de cheque de Egresos, Ingresos y Gastos Fijos, así ninguna pantalla
// inventa su propio subconjunto de estados siguientes.
const TRANSICIONES: Record<ChequeDireccion, Partial<Record<ChequeEstado, ChequeEstado[]>>> = {
  PAGO: {
    EMITIDO: ['ENTREGADO', 'ANULADO'],
    ENTREGADO: ['DEBITADO', 'RECHAZADO'],
  },
  COBRO: {
    EN_CARTERA: ['DEPOSITADO', 'ANULADO'],
    DEPOSITADO: ['ACREDITADO', 'RECHAZADO'],
  },
}

export function siguientesEstadosCheque(direccion: ChequeDireccion, estado: ChequeEstado): ChequeEstado[] {
  return TRANSICIONES[direccion][estado] ?? []
}

/** Estados terminales que efectivamente mueven caja líquida — DEBITADO (pagamos) o ACREDITADO (cobramos). */
export function chequeImpactaCaja(estado: ChequeEstado): boolean {
  return estado === 'DEBITADO' || estado === 'ACREDITADO'
}

export const CHEQUE_ESTADO_STYLE: Record<ChequeEstado, { label: string; color: string; bgColor: string }> = {
  EMITIDO: { label: 'Emitido', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  ENTREGADO: { label: 'Entregado', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  DEBITADO: { label: 'Debitado', color: 'text-green-700', bgColor: 'bg-green-100' },
  EN_CARTERA: { label: 'En cartera', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  DEPOSITADO: { label: 'Depositado', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  ACREDITADO: { label: 'Acreditado', color: 'text-green-700', bgColor: 'bg-green-100' },
  RECHAZADO: { label: 'Rechazado', color: 'text-red-700', bgColor: 'bg-red-100' },
  ANULADO: { label: 'Anulado', color: 'text-gray-600', bgColor: 'bg-gray-100' },
}
