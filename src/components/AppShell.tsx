import { type ReactNode, useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Search, LayoutDashboard, LogOut, ArrowLeft } from 'lucide-react'
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarInset,
} from '@/app/components/ui/sidebar'
import { AppHeader } from './AppHeader'
import { AdminMenu } from './AdminMenu'
import { UserAvatar } from './UserAvatar'
import { PorteNav } from './PorteNav'
import { AssistantFab } from './AssistantFab'
import { NAV_ICONS } from './iconMap'
import { useAuth } from '@/app/contexts/AuthContext'
import { getNavGroups } from '@/config/navigationConfig'
import { appConfig } from '@/config/appConfig'
import { usePresupuestos, useVentas, useProveedores } from '@/modules/porte/store'

interface AppShellProps {
  title: string
  actions?: ReactNode
  detailPanel?: ReactNode
  /** Botón de volver — para pantallas secundarias que no viven en el nav principal (ej. detalle, forms). */
  onBack?: () => void
  /** Mantiene el contenido en una sola columna angosta incluso en desktop (ej. carga rápida). */
  narrow?: boolean
  children: ReactNode
}

// ─── Shell único para toda la app ──────────────────────────────────────────────
// El contenido (`children`) se monta UNA sola vez — mobile y desktop comparten el
// mismo <main>. Solo el chrome alrededor (sidebar, topbar vs. header, bottom nav)
// cambia según el viewport, resuelto 100% con clases de Tailwind (hidden / lg:*),
// sin JS ni parpadeo de hidratación. Duplicar `children` en dos árboles montaría
// la página dos veces (estado y efectos por separado) — evitarlo a propósito.

export function AppShell({ title, actions, detailPanel, onBack, narrow, children }: AppShellProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const presupuestos = usePresupuestos()
  const ventas = useVentas()
  const proveedores = useProveedores()
  const [query, setQuery] = useState('')

  if (!user) return <>{children}</>

  const navGroups = getNavGroups(user.role)
  const navItems = navGroups.flatMap(g => g.items)
  const activeId = navItems
    .filter(item => location.pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0]?.id

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    if (!q) return

    const venta = ventas.find(v => v.id.toLowerCase().includes(q) || v.cliente.toLowerCase().includes(q))
    if (venta) return navigate(`/ventas/${encodeURIComponent(venta.id)}`)

    const presupuesto = presupuestos.find(p => p.activo && (p.id.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q)))
    if (presupuesto) return navigate(`/presupuestos/${encodeURIComponent(presupuesto.id)}`)

    const proveedor = proveedores.find(p => p.activo && p.nombre.toLowerCase().includes(q))
    if (proveedor) return navigate(`/proveedores/${encodeURIComponent(proveedor.idProv)}`)
  }

  return (
    <SidebarProvider className="lg:h-screen lg:overflow-hidden">
      {/* Sidebar — solo ocupa espacio y se muestra a partir de lg */}
      <div className="hidden lg:block">
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm truncate group-data-[collapsible=icon]:hidden">{appConfig.APP_NAME}</span>
            </div>
          </SidebarHeader>

          <SidebarContent>
            {navGroups.filter(g => g.items.length > 0).map(group => (
              <SidebarGroup key={group.id}>
                {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(item => {
                      const Icon = NAV_ICONS[item.icon as keyof typeof NAV_ICONS] ?? LayoutDashboard
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            isActive={item.id === activeId}
                            tooltip={item.label}
                            onClick={() => navigate(item.path)}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigate('/profile')} tooltip={user.name}>
                  <UserAvatar src={user.avatarUrl} name={user.name} className="w-4 h-4 rounded-full shrink-0" iconClassName="w-2.5 h-2.5" />
                  <span className="truncate">{user.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} tooltip="Cerrar sesión">
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar sesión</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      </div>

      {/* Contenido — compartido por mobile y desktop, se monta una sola vez */}
      <SidebarInset>
        {/* Header mobile (< lg) */}
        <div className="lg:hidden">
          <AppHeader
            variant="brand"
            left={
              <div className="flex items-center gap-3">
                {onBack && (
                  <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                )}
                <h1 className="text-xl text-white truncate">{title}</h1>
              </div>
            }
            right={
              <div className="flex items-center gap-2">
                {actions}
                <AdminMenu />
              </div>
            }
          />
        </div>

        {/* Topbar desktop (≥ lg) */}
        <header className="hidden lg:flex items-center gap-4 h-16 shrink-0 border-b border-border px-6">
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center shrink-0">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-dark-graphite shrink-0">{title}</h1>

          <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar venta, cliente o proveedor..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </form>

          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>

        <div className="flex flex-1 overflow-hidden">
          <main className={`flex-1 overflow-y-auto p-4 pb-24 max-w-2xl mx-auto w-full lg:mx-0 lg:py-6 lg:pb-6 lg:px-6 ${narrow ? 'lg:max-w-2xl' : 'lg:max-w-none'}`}>
            {children}
          </main>

          {detailPanel && (
            <aside className="hidden lg:block w-[300px] shrink-0 border-l border-border overflow-y-auto p-4">
              {detailPanel}
            </aside>
          )}
        </div>

        {/* Bottom nav mobile (< lg) */}
        <div className="lg:hidden">
          <PorteNav />
        </div>
      </SidebarInset>

      <AssistantFab />
    </SidebarProvider>
  )
}
