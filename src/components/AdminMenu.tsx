import { useNavigate } from 'react-router'
import { Menu, Bell, Settings } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { useAuth } from '@/app/contexts/AuthContext'
import { getNavItems, getDesktopNavItems } from '@/config/navigationConfig'
import { NAV_ICONS } from './iconMap'

// Menú "Más" para mobile — agrupa los módulos del rol que no entran en el
// BottomNav (limitado a 5 items). Los items salen de navigationConfig, así que
// sirve para cualquier rol: cada uno ve sus propios extras.
export function AdminMenu() {
  const navigate = useNavigate()
  const { user } = useAuth()
  if (!user) return null

  const mainIds = new Set(getNavItems(user.role).map(i => i.id))
  const extraItems = getDesktopNavItems(user.role).filter(i => !mainIds.has(i.id) && i.id !== 'config')

  if (extraItems.length === 0 && user.role !== 'admin') return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center">
          <Menu className="w-5 h-5 text-white" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Más secciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {extraItems.map(item => {
          const Icon = NAV_ICONS[item.icon as keyof typeof NAV_ICONS] ?? Menu
          return (
            <DropdownMenuItem key={item.id} onClick={() => navigate(item.path)}>
              <Icon className="w-4 h-4 mr-2" />
              {item.label}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/notifications')}>
          <Bell className="w-4 h-4 mr-2" />
          Notificaciones
        </DropdownMenuItem>
        {user.role === 'admin' && (
          <DropdownMenuItem onClick={() => navigate('/config')}>
            <Settings className="w-4 h-4 mr-2" />
            Configuración
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
