import {
  LayoutDashboard, FileText, Hammer, ArrowDownCircle, ArrowUpCircle, User, PlusCircle, List,
  Landmark, Users, Wrench, GitBranch, Lightbulb, Settings, Mic,
} from 'lucide-react'

// Mapa único de íconos de navegación (nav items guardan el ícono como string en config).
// Compartido por PorteNav (mobile) y AppShell (sidebar desktop) — no duplicar.
export const NAV_ICONS = {
  LayoutDashboard, FileText, Hammer, ArrowDownCircle, ArrowUpCircle, User, PlusCircle, List,
  Landmark, Users, Wrench, GitBranch, Lightbulb, Settings, Mic,
} as const

export type NavIconName = keyof typeof NAV_ICONS
