// ─── Navegación por rol — PORTE ───────────────────────────────────────────────
// Los 8 módulos de negocio son un espejo 1:1 de las tabs del Excel: mismo
// nombre, mismo orden, uno por uno. No fusionar (ej. "Movimientos" mezclando
// Ingresos+Egresos) ni reordenar por criterio propio.
//
// 01_PRESUPUESTOS → Presupuestos   05_PROVEEDORES   → Proveedores
// 02_VENTAS       → Ventas         06_GASTOS_FIJOS  → Gastos fijos
// 03_INGRESOS     → Ingresos       07_VARIACIONES   → Variaciones
// 04_EGRESOS      → Egresos        08_APRENDIZAJES  → Aprendizajes
//
// Clientes es un 9no módulo agregado fuera del Excel original (gap encontrado
// contra el diseño: no existía maestro de clientes, solo texto libre en
// ventas/presupuestos) — va junto a Proveedores por ser el mismo tipo de dato
// (maestro), no intercalado en medio de los 8 originales.
//
// Cargar, Registros y Perfil no son módulos de negocio — son accesos, y van
// agrupados aparte (nunca intercalados con los de arriba). Dashboard y
// Config son exclusivos de admin y también en su propio grupo.

import { rolesConfig } from './rolesConfig'

export interface NavItem {
  id: string
  label: string
  icon: string
  path: string
  moduleId: string
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

// Los 8 módulos de negocio — fijos, mismo orden y nombre para todos los roles.
const BUSINESS_MODULES: NavItem[] = [
  { id: 'presupuestos', label: 'Presupuestos',  icon: 'FileText',        path: '/presupuestos',  moduleId: 'presupuestos' },
  { id: 'ventas',       label: 'Ventas',         icon: 'Hammer',          path: '/ventas',        moduleId: 'ventas' },
  { id: 'ingresos',     label: 'Ingresos',       icon: 'ArrowDownCircle', path: '/ingresos',      moduleId: 'ingresos' },
  { id: 'egresos',      label: 'Egresos',        icon: 'ArrowUpCircle',  path: '/egresos',       moduleId: 'egresos' },
  { id: 'proveedores',  label: 'Proveedores',    icon: 'Landmark',       path: '/proveedores',   moduleId: 'proveedores' },
  { id: 'clientes',     label: 'Clientes',       icon: 'Users',          path: '/clientes',      moduleId: 'clientes' },
  { id: 'gastosfijos',  label: 'Gastos fijos',   icon: 'Wrench',         path: '/gastos-fijos',  moduleId: 'gastosfijos' },
  { id: 'variaciones',  label: 'Variaciones',    icon: 'GitBranch',      path: '/variaciones',   moduleId: 'variaciones' },
  { id: 'aprendizajes', label: 'Aprendizajes',   icon: 'Lightbulb',      path: '/aprendizajes',  moduleId: 'aprendizajes' },
]

// Punto de entrada principal — distinto por rol, no es un módulo de negocio.
const MAIN_ITEMS: Record<string, NavItem[]> = {
  admin:     [{ id: 'dashboard', label: 'Inicio',  icon: 'LayoutDashboard', path: '/dashboard', moduleId: 'dashboard' }],
  dataEntry: [{ id: 'carga',     label: 'Cargar',  icon: 'PlusCircle',      path: '/carga',      moduleId: 'carga' }],
}

// Accesos — comunes a ambos roles, tampoco son módulos de negocio.
const ACCESS_ITEMS: NavItem[] = [
  { id: 'asistente',     label: 'Asistente', icon: 'Mic',  path: '/asistente',     moduleId: 'asistente' },
  { id: 'mis-registros', label: 'Registros', icon: 'List', path: '/mis-registros', moduleId: 'carga' },
  { id: 'profile',       label: 'Perfil',    icon: 'User', path: '/profile',       moduleId: 'profile' },
]

// Exclusivo admin — separado, no intercalado con los 8 módulos.
const ADMIN_ITEMS: NavItem[] = [
  { id: 'config', label: 'Configuración', icon: 'Settings', path: '/config', moduleId: 'config' },
]

/** Grupos completos de navegación para un rol — usados por la sidebar de escritorio. */
export function getNavGroups(role: string): NavGroup[] {
  const groups: NavGroup[] = [
    { id: 'main', label: '', items: MAIN_ITEMS[role] ?? [] },
    { id: 'modules', label: 'Módulos', items: BUSINESS_MODULES },
    { id: 'access', label: 'Accesos', items: ACCESS_ITEMS },
  ]
  if (role === 'admin') groups.push({ id: 'admin', label: 'Administración', items: ADMIN_ITEMS })
  return groups
}

// Accesos priorizados por rol para el BottomNav móvil (máx. 5) — el resto
// (incluidos los 8 módulos que no entran) se agrupa detrás de "Más". El
// asistente va siempre último (extremo derecho), es el punto de entrada
// rápido al micrófono.
const MOBILE_PRIORITY: Record<string, string[]> = {
  admin: ['dashboard', 'presupuestos', 'ventas', 'profile', 'asistente'],
  dataEntry: ['carga', 'ventas', 'presupuestos', 'profile', 'asistente'],
}

function allItems(role: string): NavItem[] {
  return getNavGroups(role).flatMap(g => g.items)
}

export function getNavItems(role: string): NavItem[] {
  const priority = MOBILE_PRIORITY[role] ?? []
  const items = allItems(role)
  return priority.map(id => items.find(i => i.id === id)).filter((i): i is NavItem => !!i)
}

/** Todos los módulos del rol, en orden de grupo — para la sidebar de escritorio y el menú "Más". */
export function getDesktopNavItems(role: string): NavItem[] {
  return allItems(role)
}

export function getDefaultRoute(role: string): string {
  return rolesConfig[role]?.defaultRoute ?? '/'
}

export function getNavItem(role: string, id: string): NavItem | undefined {
  return allItems(role).find(item => item.id === id)
}
