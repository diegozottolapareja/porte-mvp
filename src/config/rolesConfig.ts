// ─── Roles, permisos y módulos — PORTE ────────────────────────────────────────
// data_entry opera sobre las 8 entidades del Excel sin filtrar (carga, edición,
// borrado lógico). La diferencia con admin no es "a qué entra" sino qué ve
// además: tablero gerencial (dashboard) y configuración de listas maestras (config).

export type Permission =
  | '*'
  | 'dashboard:view'
  | 'presupuestos:read'
  | 'presupuestos:write'
  | 'presupuestos:delete'
  | 'ventas:read'
  | 'ventas:write'
  | 'ingresos:read'
  | 'ingresos:write'
  | 'ingresos:delete'
  | 'egresos:read'
  | 'egresos:write'
  | 'egresos:delete'
  | 'proveedores:read'
  | 'proveedores:write'
  | 'proveedores:delete'
  | 'clientes:read'
  | 'clientes:write'
  | 'clientes:delete'
  | 'gastosfijos:read'
  | 'gastosfijos:write'
  | 'gastosfijos:delete'
  | 'variaciones:read'
  | 'variaciones:write'
  | 'variaciones:delete'
  | 'aprendizajes:read'
  | 'aprendizajes:write'
  | 'aprendizajes:delete'
  | 'config:read'
  | 'config:write'

export interface RoleConfig {
  label: string
  permissions: Permission[]
  modules: string[]
  defaultRoute: string
}

export const rolesConfig: Record<string, RoleConfig> = {
  admin: {
    label: 'Administrador',
    permissions: ['*'],
    modules: ['*'],
    defaultRoute: '/dashboard',
  },

  dataEntry: {
    label: 'Carga de datos',
    permissions: [
      'presupuestos:read', 'presupuestos:write', 'presupuestos:delete',
      'ventas:read', 'ventas:write',
      'ingresos:read', 'ingresos:write', 'ingresos:delete',
      'egresos:read', 'egresos:write', 'egresos:delete',
      'proveedores:read', 'proveedores:write', 'proveedores:delete',
      'clientes:read', 'clientes:write', 'clientes:delete',
      'gastosfijos:read', 'gastosfijos:write', 'gastosfijos:delete',
      'variaciones:read', 'variaciones:write', 'variaciones:delete',
      'aprendizajes:read', 'aprendizajes:write', 'aprendizajes:delete',
    ],
    modules: ['asistente', 'carga', 'ventas', 'ingresos', 'egresos', 'proveedores', 'clientes', 'gastosfijos', 'variaciones', 'aprendizajes', 'profile'],
    defaultRoute: '/carga',
  },
}

export function hasPermission(userPermissions: string[], permission: Permission): boolean {
  return userPermissions.includes('*') || userPermissions.includes(permission)
}

export function hasModule(role: string, moduleId: string): boolean {
  const config = rolesConfig[role]
  if (!config) return false
  return config.modules.includes('*') || config.modules.includes(moduleId)
}
