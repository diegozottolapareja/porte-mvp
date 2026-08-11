// ─── Módulos de la aplicación — PORTE ─────────────────────────────────────────

export interface ModuleConfig {
  id: string
  label: string
  description: string
  enabled: boolean
  path: string
}

export const modulesConfig: ModuleConfig[] = [
  { id: 'dashboard',    label: 'Dashboard',     description: 'Panel con ventas activas y estado de cobros',         enabled: true, path: '/dashboard' },
  { id: 'asistente',    label: 'Asistente',     description: 'Chat con el asistente para cargar presupuestos por texto o voz', enabled: true, path: '/asistente' },
  { id: 'carga',        label: 'Carga rápida',  description: 'Carga rápida de ingresos, egresos y presupuestos',    enabled: true, path: '/carga' },
  { id: 'presupuestos', label: 'Presupuestos',  description: 'Embudo comercial',                                    enabled: true, path: '/presupuestos' },
  { id: 'ventas',       label: 'Ventas',        description: 'Ventas y ficha de venta',                             enabled: true, path: '/ventas' },
  { id: 'ingresos',     label: 'Ingresos',      description: 'Cobros de clientes',                                  enabled: true, path: '/ingresos' },
  { id: 'egresos',      label: 'Egresos',       description: 'Pagos a proveedores y gastos de venta',               enabled: true, path: '/egresos' },
  { id: 'proveedores',  label: 'Proveedores',   description: 'Registro y cuenta corriente',                         enabled: true, path: '/proveedores' },
  { id: 'clientes',     label: 'Clientes',      description: 'Maestro de clientes',                                 enabled: true, path: '/clientes' },
  { id: 'gastosfijos',  label: 'Gastos fijos',  description: 'Estructura mensual prevista vs real',                 enabled: true, path: '/gastos-fijos' },
  { id: 'variaciones',  label: 'Variaciones',   description: 'Cambios post-venta',                                  enabled: true, path: '/variaciones' },
  { id: 'aprendizajes', label: 'Aprendizajes',  description: 'Retrospectivas de venta',                              enabled: true, path: '/aprendizajes' },
  { id: 'config',       label: 'Configuración', description: 'Listas maestras',                                     enabled: true, path: '/config' },
  { id: 'profile',      label: 'Perfil',        description: 'Perfil del usuario autenticado',                      enabled: true, path: '/profile' },
]

export function getModule(id: string): ModuleConfig | undefined {
  return modulesConfig.find(m => m.id === id)
}

export function isModuleEnabled(id: string): boolean {
  return modulesConfig.some(m => m.id === id && m.enabled)
}
