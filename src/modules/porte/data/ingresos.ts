import type { TipoIngreso, Cuenta, TipoCaja } from './config'

// ─── Ingresos (03_INGRESOS) ────────────────────────────────────────────────────

// El estado administrativo del ingreso es independiente del cheque — la
// existencia de un cheque la determina el modelo real de `cheques` (ver
// ChequeAttachDialog / chequeDeIngreso), nunca este campo.
export type EstadoIngreso = 'Confirmado' | 'Pendiente'

export interface Ingreso {
  fecha: string        // YYYY-MM-DD
  tipoIngreso: TipoIngreso
  id: string             // FK a venta (PR-XXXX)
  concepto: string
  monto: number
  cuenta: Cuenta
  caja: TipoCaja
  estado: EstadoIngreso
  ref: string
  cajaId?: string           // FK a `cajas` — reemplaza `cuenta` como fuente real para las RPC financieras
  metodoCobroId?: string    // FK a `metodos_cobro` — deriva cajaId/fechaAcreditacion/comisión
  fechaAcreditacion?: string // cuándo se espera (o ya se acreditó) la plata en caja — distinto de `fecha` (operación)
  chequeId?: string | null  // FK a `cheques` (direccion='COBRO') — solo cuando metodoCobro.tipo==='CHEQUE'; fechaAcreditacion queda null hasta que el cheque se marca ACREDITADO. `null` explícito = desvincular sin tocar el cheque real.
  activo: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
}

const RAW_INGRESOS: Omit<Ingreso, 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>[] = [
  { fecha: '2026-06-08', tipoIngreso: 'ANTICIPO',      id: 'PR - 0546', concepto: 'Anticipo 50%',        monto: 1267000.00, cuenta: 'Efectivo Negro', caja: 'NEGRA',  estado: 'Confirmado', ref: 'IN-0001' },
  { fecha: '2026-06-10', tipoIngreso: 'ANTICIPO',      id: 'PR - 0552', concepto: 'Anticipo obra',        monto: 900000.00,  cuenta: 'Banco Macro',     caja: 'BLANCA', estado: 'Confirmado', ref: 'IN-0002' },
  { fecha: '2026-06-15', tipoIngreso: 'PAGO PARCIAL',  id: 'PR - 0530', concepto: 'Pago parcial materiales', monto: 1000000.00, cuenta: 'MercadoPago',   caja: 'BLANCA', estado: 'Confirmado', ref: 'IN-0003' },
  { fecha: '2026-06-20', tipoIngreso: 'ANTICIPO',      id: 'PR - 0532', concepto: 'Anticipo 40%',         monto: 200000.00,  cuenta: 'Efectivo Blanco', caja: 'BLANCA', estado: 'Confirmado', ref: 'IN-0004' },
  { fecha: '2026-06-25', tipoIngreso: 'SALDO',          id: 'PR - 0484', concepto: 'Saldo final obra',     monto: 1858611.15, cuenta: 'Banco Macro',    caja: 'BLANCA', estado: 'Confirmado', ref: 'IN-0005' },
  { fecha: '2026-07-05', tipoIngreso: 'PAGO PARCIAL',  id: 'PR - 0536', concepto: 'Pago parcial materiales', monto: 1500000.00, cuenta: 'Banco Macro',   caja: 'BLANCA', estado: 'Pendiente',  ref: 'IN-0006' },
  { fecha: '2026-07-12', tipoIngreso: 'ANTICIPO',      id: 'PR - 0560', concepto: 'Anticipo obra chica',   monto: 150000.00,  cuenta: 'Efectivo Blanco', caja: 'BLANCA', estado: 'Confirmado', ref: 'IN-0007' },
]

export const MOCK_INGRESOS: Ingreso[] = RAW_INGRESOS.map(i => ({
  ...i,
  activo: true,
  createdAt: `${i.fecha}T09:00:00.000Z`,
  createdBy: 'demo-admin',
  updatedAt: `${i.fecha}T09:00:00.000Z`,
}))
