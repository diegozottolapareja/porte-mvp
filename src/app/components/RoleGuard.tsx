import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '@/config/appConfig'

interface RoleGuardProps {
  roles: Role[]
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Renders children only if the current user has one of the allowed roles.
 * Use this to show/hide UI sections within a page (not for route protection — use PrivateRoute for that).
 *
 * @example
 * <RoleGuard roles={['admin']}>
 *   <DeleteButton />
 * </RoleGuard>
 */
export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) return <>{fallback}</>
  return <>{children}</>
}
