import type { CategGastoFijo, Cuenta, TipoCaja } from './config'

// ─── Gastos fijos (06_GASTOS_FIJOS) ───────────────────────────────────────────
// DIFERENCIA da #ERROR! en el Excel cuando falta montoReal — acá devuelve null,
// la UI muestra un guion, nunca un error.

export type Periodicidad = 'Mensual' | 'Bimestral' | 'Trimestral' | 'Anual' | 'Único'
export type EstadoGastoFijo = 'PREVISTO' | 'PAGADO' | 'VENCIDO'

export interface GastoFijo {
  id: string
  fecha: string
  concepto: string
  categoria: CategGastoFijo
  montoPrevisto: number
  montoReal: number | null
  periodicidad: Periodicidad
  cuenta: Cuenta
  tipoCaja: TipoCaja
  cajaId?: string          // FK a `cajas` — reemplaza `cuenta` como fuente real para las RPC financieras
  metodoPagoId?: string    // FK a `metodos_pago` (22_FINANZAS), opcional — habilita la regla caja Negra/Blanca vs instrumento
  chequeId?: string | null // FK a `cheques` (direccion='PAGO') — solo cuando metodoPago.tipo==='CHEQUE'. `null` explícito = desvincular sin tocar el cheque real.
  fechaPagoEfectivo?: string | null // fecha real de salida de caja — distinta de `fecha` (vencimiento de la obligación), nunca se asume que son la misma cuando se paga con cheque
  proveedorId: string | null
  estado: EstadoGastoFijo
  observaciones?: string
  activo: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
}

export function calcDiferencia(g: Pick<GastoFijo, 'montoPrevisto' | 'montoReal'>): number | null {
  return g.montoReal === null ? null : g.montoReal - g.montoPrevisto
}

const RAW_GASTOS_FIJOS: Omit<GastoFijo, 'id' | 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>[] = [
  { fecha: '2026-06-01', concepto: 'Alquiler taller',     categoria: 'Alquiler',    montoPrevisto: 500000.00, montoReal: 500000.00, periodicidad: 'Mensual', cuenta: 'Efectivo Blanco', tipoCaja: 'BLANCA', proveedorId: null, estado: 'PAGADO',   observaciones: 'Vence el día 1 de cada mes' },
  { fecha: '2026-06-05', concepto: 'Sueldos taller',       categoria: 'Sueldos',      montoPrevisto: 1800000.00, montoReal: 1800000.00, periodicidad: 'Mensual', cuenta: 'Banco Macro',     tipoCaja: 'BLANCA', proveedorId: null, estado: 'PAGADO' },
  { fecha: '2026-06-10', concepto: 'Luz',                    categoria: 'Servicios',    montoPrevisto: 85000.00,  montoReal: 92000.00,  periodicidad: 'Mensual', cuenta: 'Banco Macro',     tipoCaja: 'BLANCA', proveedorId: null, estado: 'PAGADO' },
  { fecha: '2026-06-10', concepto: 'Internet',                categoria: 'Servicios',    montoPrevisto: 25000.00,  montoReal: 25000.00,  periodicidad: 'Mensual', cuenta: 'Banco Macro',     tipoCaja: 'BLANCA', proveedorId: null, estado: 'PAGADO' },
  { fecha: '2026-07-01', concepto: 'Alquiler taller',        categoria: 'Alquiler',     montoPrevisto: 500000.00, montoReal: null,       periodicidad: 'Mensual', cuenta: 'Efectivo Blanco', tipoCaja: 'BLANCA', proveedorId: null, estado: 'PREVISTO', observaciones: 'Vence el día 1 de cada mes' },
  { fecha: '2026-07-05', concepto: 'Sueldos taller',          categoria: 'Sueldos',       montoPrevisto: 1850000.00, montoReal: null,      periodicidad: 'Mensual', cuenta: 'Banco Macro',     tipoCaja: 'BLANCA', proveedorId: null, estado: 'PREVISTO' },
]

export const MOCK_GASTOS_FIJOS: GastoFijo[] = RAW_GASTOS_FIJOS.map((g, i) => ({
  ...g,
  id: `mock-gf-${i}`,
  activo: true,
  createdAt: `${g.fecha}T09:00:00.000Z`,
  createdBy: 'demo-admin',
  updatedAt: `${g.fecha}T09:00:00.000Z`,
}))
