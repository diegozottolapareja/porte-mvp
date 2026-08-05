import type { Cuenta, TipoCaja } from './config'

// ─── Proveedores (05_PROVEEDORES) ─────────────────────────────────────────────

export interface Proveedor {
  idProv: string              // 'PROV-XXX'
  nombre: string
  rubro: string
  contacto: string
  telefono: string
  condicionHabitual?: string
  plazoDias?: number
  cuentaBanco?: Cuenta
  tipoCaja: TipoCaja
  saldoCc: number
  fechaSaldoInicial: string     // YYYY-MM-DD
  activo: boolean
  observaciones?: string
  createdAt: string
  createdBy: string
  updatedAt: string
}

const RAW_PROVEEDORES: Omit<Proveedor, 'createdAt' | 'createdBy' | 'updatedAt'>[] = [
  { idProv: 'PROV-001', nombre: 'Herrajes Assef',           rubro: 'Materiales', contacto: 'Matias Assef',  telefono: '388-4000000', condicionHabitual: 'Cuenta corriente', plazoDias: 30, cuentaBanco: 'Banco Macro', tipoCaja: 'BLANCA', saldoCc: 126547.91, fechaSaldoInicial: '2026-06-01', activo: true },
  { idProv: 'PROV-002', nombre: 'IMPLEMENTOS INDUSTRIALES', rubro: 'Materiales', contacto: 'Lucas Marciano', telefono: '',            tipoCaja: 'BLANCA', saldoCc: 268863.74, fechaSaldoInicial: '2026-06-01', activo: true },
  { idProv: 'PROV-003', nombre: 'FULL COLOR',                rubro: 'Materiales', contacto: 'Bruno',          telefono: '',            tipoCaja: 'BLANCA', saldoCc: 233416.63, fechaSaldoInicial: '2026-06-01', activo: true },
]

export const MOCK_PROVEEDORES: Proveedor[] = RAW_PROVEEDORES.map(p => ({
  ...p,
  createdAt: `${p.fechaSaldoInicial}T09:00:00.000Z`,
  createdBy: 'demo-admin',
  updatedAt: `${p.fechaSaldoInicial}T09:00:00.000Z`,
}))
