import type { TipoEgreso, Cuenta, TipoCaja } from './config'

// ─── Egresos (04_EGRESOS) ──────────────────────────────────────────────────────
// La tab está vacía en el Excel original — datos inventados coherentes con obras y proveedores.

export type EstadoEgreso = 'Confirmado' | 'Pendiente' | 'Emitido' | 'Incompleto'

export interface Egreso {
  fecha: string
  tipoEgreso: TipoEgreso
  id?: string                // FK a obra (PR-XXXX), opcional si es gasto fijo
  proveedor?: string          // FK a proveedor
  categoria: string            // CATEG_DIRECTOS | CATEG_INDIRECTOS
  monto: number
  cuenta: Cuenta
  caja: TipoCaja
  estado: EstadoEgreso
  ref: string
  fechaEmision?: string         // solo cheques
  fechaAcreditacion?: string
  activo: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
}

const RAW_EGRESOS: Omit<Egreso, 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>[] = [
  { fecha: '2026-06-09', tipoEgreso: 'MATERIALES',    id: 'PR - 0546', proveedor: 'PROV-001', categoria: 'MATERIALES',   monto: 620000.00, cuenta: 'Banco Macro',     caja: 'BLANCA', estado: 'Confirmado', ref: 'EG-0001' },
  { fecha: '2026-06-11', tipoEgreso: 'MATERIALES',    id: 'PR - 0552', proveedor: 'PROV-002', categoria: 'MATERIALES',   monto: 380000.00, cuenta: 'Efectivo Negro',  caja: 'NEGRA',  estado: 'Confirmado', ref: 'EG-0002' },
  { fecha: '2026-06-13', tipoEgreso: 'MANO DE OBRA',  id: 'PR - 0530', categoria: 'MANO DE OBRA', monto: 450000.00, cuenta: 'Efectivo Blanco', caja: 'BLANCA', estado: 'Confirmado', ref: 'EG-0003' },
  { fecha: '2026-06-16', tipoEgreso: 'FLETE',          id: 'PR - 0532', proveedor: 'PROV-003', categoria: 'FLETE',        monto: 45000.00,  cuenta: 'Efectivo Blanco', caja: 'BLANCA', estado: 'Confirmado', ref: 'EG-0004' },
  { fecha: '2026-06-22', tipoEgreso: 'HERRAMIENTAS',  categoria: 'HERRAMIENTAS', monto: 120000.00, cuenta: 'Banco Macro', caja: 'BLANCA', estado: 'Confirmado', ref: 'EG-0005' },
  { fecha: '2026-06-28', tipoEgreso: 'MATERIALES',    id: 'PR - 0536', proveedor: 'PROV-001', categoria: 'MATERIALES',   monto: 900000.00, cuenta: 'Banco Macro', caja: 'BLANCA', estado: 'Emitido', ref: 'EG-0006', fechaEmision: '2026-06-28', fechaAcreditacion: '2026-08-15' },
  { fecha: '2026-07-01', tipoEgreso: 'COMBUSTIBLE',   categoria: 'COMBUSTIBLE',   monto: 35000.00,  cuenta: 'Efectivo Blanco', caja: 'BLANCA', estado: 'Confirmado', ref: 'EG-0007' },
  { fecha: '2026-07-06', tipoEgreso: 'SERVICIOS',      id: 'PR - 0546', proveedor: 'PROV-003', categoria: 'SERVICIOS',    monto: 60000.00,  cuenta: 'MercadoPago', caja: 'BLANCA', estado: 'Pendiente', ref: 'EG-0008' },
  { fecha: '2026-07-10', tipoEgreso: 'IMPUESTOS',      categoria: 'IMPUESTOS',       monto: 210000.00, cuenta: 'Banco Macro', caja: 'BLANCA', estado: 'Confirmado', ref: 'EG-0009' },
  { fecha: '2026-07-14', tipoEgreso: 'MANO DE OBRA',  id: 'PR - 0560', categoria: 'MANO DE OBRA', monto: 90000.00,  cuenta: 'Efectivo Blanco', caja: 'BLANCA', estado: 'Confirmado', ref: 'EG-0010' },
]

export const MOCK_EGRESOS: Egreso[] = RAW_EGRESOS.map(e => ({
  ...e,
  activo: true,
  createdAt: `${e.fecha}T09:00:00.000Z`,
  createdBy: 'demo-admin',
  updatedAt: `${e.fecha}T09:00:00.000Z`,
}))
