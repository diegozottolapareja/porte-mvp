import { useNavigate, useLocation } from 'react-router'
import { LayoutDashboard } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { NAV_ICONS } from './iconMap'
import { useAuth } from '@/app/contexts/AuthContext'
import { getNavItems } from '@/config/navigationConfig'

interface PorteNavProps {
  /** Si se omite, se detecta por el path actual (item más específico que matchea). */
  activeId?: string
}

export function PorteNav({ activeId }: PorteNavProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  if (!user) return null

  const navItems = getNavItems(user.role)

  const resolvedActiveId = activeId ?? navItems
    .filter(item => location.pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0]?.id

  const items = navItems.map(item => ({
    id: item.id,
    label: item.label,
    Icon: NAV_ICONS[item.icon as keyof typeof NAV_ICONS] ?? LayoutDashboard,
    onClick: () => navigate(item.path),
  }))

  return <BottomNav items={items} activeId={resolvedActiveId ?? ''} />
}
