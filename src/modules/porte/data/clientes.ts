// ─── Clientes ──────────────────────────────────────────────────────────────
// Maestro independiente — no existía en el esquema original de 8 entidades.
// `ventas`/`presupuestos` siguen usando `cliente` como texto libre, sin FK acá.

export interface Cliente {
  idCli: string              // 'CLI-XXX'
  nombre: string
  /** @deprecated sin reemplazo directo — se mantiene solo por compatibilidad con datos existentes, no usar en código nuevo. */
  contacto?: string
  /** @deprecated reemplazado por telefonoPrincipal. */
  telefono?: string
  // Regla de negocio (DB: trg_validar_contacto_cliente): debe existir emailPrincipal
  // y/o telefonoPrincipal. Los campos secundarios nunca satisfacen esta regla por sí solos.
  emailPrincipal?: string
  emailSecundario?: string
  telefonoPrincipal?: string
  telefonoSecundario?: string
  direccion?: string
  activo: boolean
  observaciones?: string
  createdAt: string
  createdBy: string
  updatedAt: string
}

// Para editar un cliente existente, los 4 campos de contacto aceptan `null`
// además de `string | undefined` — permite distinguir "el usuario borró el
// campo" (null, se persiste como NULL) de "el campo no se tocó" (undefined,
// clienteToRow lo ignora y no pisa el valor ya guardado).
export type ClienteUpdate = Omit<Partial<Cliente>, 'emailPrincipal' | 'emailSecundario' | 'telefonoPrincipal' | 'telefonoSecundario'> & {
  emailPrincipal?: string | null
  emailSecundario?: string | null
  telefonoPrincipal?: string | null
  telefonoSecundario?: string | null
}

export const MOCK_CLIENTES: Cliente[] = []
