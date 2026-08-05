import type { CondicionPago, TipoCaja, EstadoOperativo } from './config'

// ─── Ventas (02_VENTAS) ────────────────────────────────────────────────────────
// Se crea al pasar un presupuesto a 'Aceptado', copiando id y los 6 costos.

export interface Venta {
  id: string                // mismo PR-XXXX
  cliente: string
  montoTotal: number         // copiado del presupuesto
  mater: number
  mo: number
  indVend: number
  imp: number
  comerc: number
  benef: number
  fechaCierre: string         // ISO datetime
  condPago?: CondicionPago
  dias?: number
  vencCobro?: string           // YYYY-MM-DD
  cajaIntenc?: TipoCaja
  ventaFinal: number            // editable, default = montoTotal
  motivoDif?: string
  entregaCompr?: string          // YYYY-MM-DD
  entregaReal?: string
  estadoOp: EstadoOperativo
  respOp: string
  createdAt: string
  createdBy: string
  updatedAt: string
}

const RAW_VENTAS: Omit<Venta, 'createdAt' | 'createdBy' | 'updatedAt'>[] = [
  { id: 'PR - 0484', cliente: 'TSCHOPP SEBASTIAN',  montoTotal: 3358611.15, mater: 1350000, mo: 950000, indVend: 475000, imp: 122000, comerc: 300000, benef: 161611.15, fechaCierre: '2026-04-12T10:00:00', ventaFinal: 3358611.15, entregaCompr: '2026-05-15', entregaReal: '2026-05-20', estadoOp: 'Cerrado', respOp: 'Gonza' },
  { id: 'PR - 0552', cliente: 'CASTRO ARIEL',        montoTotal: 2038763.18, mater: 692297.99, mo: 567288.40, indVend: 255863.82, imp: 68975.92, comerc: 288639.84, benef: 165697.21, fechaCierre: '2026-06-08T14:30:00', condPago: 'Efectivo', dias: 30, vencCobro: '2026-07-08', cajaIntenc: 'NEGRA', ventaFinal: 2038763.18, entregaCompr: '2026-07-20', estadoOp: 'Pendiente', respOp: 'Gonza' },
  { id: 'PR - 0530', cliente: 'MARTEARENA BENITO',   montoTotal: 3200912.95, mater: 1400000, mo: 980000, indVend: 480000, imp: 125000, comerc: 195000, benef: 20912.95, fechaCierre: '2026-05-22T11:00:00', ventaFinal: 3200912.95, entregaCompr: '2026-07-01', estadoOp: 'Pendiente', respOp: 'Gonza' },
  { id: 'PR - 0532', cliente: 'CHECA ESTELA',         montoTotal: 507732.08, mater: 220000, mo: 150000, indVend: 75000, imp: 19000, comerc: 42000, benef: 1732.08, fechaCierre: '2026-05-24T09:15:00', condPago: 'Transferencia', cajaIntenc: 'NEGRA', ventaFinal: 507732.08, entregaCompr: '2026-06-20', estadoOp: 'Pendiente', respOp: 'Gonza' },
  { id: 'PR - 0536', cliente: 'MEDRANO EDUARDO',      montoTotal: 3800366.26, mater: 1650000, mo: 1150000, indVend: 570000, imp: 145000, comerc: 260000, benef: 25366.26, fechaCierre: '2026-05-27T16:00:00', ventaFinal: 3800366.26, entregaCompr: '2026-07-10', estadoOp: 'Pendiente', respOp: 'Gonza' },
  { id: 'PR - 0546', cliente: 'VILCA JULIA',           montoTotal: 2535266.37, mater: 1100000, mo: 780000, indVend: 390000, imp: 98000, comerc: 165000, benef: 2266.37, fechaCierre: '2026-06-03T10:30:00', ventaFinal: 2535266.37, entregaCompr: '2026-07-05', estadoOp: 'En fabricación', respOp: 'Gonza' },
  { id: 'PR - 0560', cliente: 'GERALA ANTONIO',        montoTotal: 376667.18, mater: 160000, mo: 110000, indVend: 55000, imp: 14000, comerc: 34000, benef: 3667.18, fechaCierre: '2026-06-14T12:00:00', ventaFinal: 376667.18, entregaCompr: '2026-07-15', estadoOp: 'Planificado', respOp: 'Gonza' },
]

export const MOCK_VENTAS: Venta[] = RAW_VENTAS.map(v => ({
  ...v,
  createdAt: v.fechaCierre,
  createdBy: 'demo-admin',
  updatedAt: v.fechaCierre,
}))
