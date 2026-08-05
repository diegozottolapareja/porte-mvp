import { useNavigate } from 'react-router'
import { Menu, Bell, Settings } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { useAuth } from '@/app/contexts/AuthContext'
import { getDesktopNavItems } from '@/config/navigationConfig'
import { NAV_ICONS } from './iconMap'

// Menú "Más" para mobile — replica exactamente la sidebar de escritorio (todos
// los ítems del rol, sin excluir los que también están en el BottomNav), para
// que mobile y desktop muestren siempre las mismas opciones.
export function AdminMenu() {
  const navigate = useNavigate()
  const { user } = useAuth()
  if (!user) return null

  const items = getDesktopNavItems(user.role).filter(i => i.id !== 'config')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center">
          <Menu className="w-5 h-5 text-white" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Secciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map(item => {
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
