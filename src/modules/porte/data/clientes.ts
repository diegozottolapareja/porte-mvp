// ─── Clientes ──────────────────────────────────────────────────────────────
// Maestro independiente — no existía en el esquema original de 8 entidades.
// `ventas`/`presupuestos` siguen usando `cliente` como texto libre, sin FK acá.

export interface Cliente {
  idCli: string              // 'CLI-XXX'
  nombre: string
  contacto: string
  telefono: string
  direccion?: string
  activo: boolean
  observaciones?: string
  createdAt: string
  createdBy: string
  updatedAt: string
}

export const MOCK_CLIENTES: Cliente[] = []
