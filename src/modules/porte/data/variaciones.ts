import type { TipoVariacion } from './config'

// ─── Variaciones (07_VARIACIONES) ─────────────────────────────────────────────
// Cambios post-venta sobre un presupuesto ya aceptado.

export interface Variacion {
  idVar: string          // 'VAR-XXXX'
  fecha: string
  idPres: string          // FK a presupuesto
  cliente: string
  tipoVar: TipoVariacion
  descripcion: string
  valorAnterior: string
  valorNuevo: string
  impacto: number
  canal: string
  presupNuevo?: string | null
  registradoPor: string
  observaciones?: string
  activo: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
}

const RAW_VARIACIONES: Omit<Variacion, 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>[] = [
  { idVar: 'VAR-0001', fecha: '2026-06-01', idPres: 'PR-0484', cliente: 'TSCHOPP SEBASTIAN', tipoVar: 'Plazo de entrega', descripcion: 'Cliente solicitó extender el plazo 15 días por obra de albañilería pendiente', valorAnterior: '15/06/2026', valorNuevo: '30/06/2026', impacto: 0, canal: 'WhatsApp', presupNuevo: null, registradoPor: 'Gonza', observaciones: 'Confirmado por mensaje' },
  { idVar: 'VAR-0002', fecha: '2026-06-18', idPres: 'PR-0552', cliente: 'CASTRO ARIEL', tipoVar: 'Material especificado', descripcion: 'Cambio de motor tubular por motor de mayor torque', valorAnterior: 'Motor 400N', valorNuevo: 'Motor 600N', impacto: 85000, canal: 'Presencial', presupNuevo: null, registradoPor: 'Gonza' },
  { idVar: 'VAR-0003', fecha: '2026-07-02', idPres: 'PR-0546', cliente: 'VILCA JULIA', tipoVar: 'Forma de pago', descripcion: 'Cliente pide dividir el saldo en dos pagos', valorAnterior: 'Pago único al entregar', valorNuevo: '2 pagos parciales', impacto: 0, canal: 'Teléfono', presupNuevo: null, registradoPor: 'Gonza' },
]

export const MOCK_VARIACIONES: Variacion[] = RAW_VARIACIONES.map(v => ({
  ...v,
  activo: true,
  createdAt: `${v.fecha}T09:00:00.000Z`,
  createdBy: 'demo-admin',
  updatedAt: `${v.fecha}T09:00:00.000Z`,
}))
