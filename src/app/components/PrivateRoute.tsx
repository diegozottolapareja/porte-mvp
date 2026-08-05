import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '@/config/appConfig'
import { getDefaultRoute } from '@/config/navigationConfig'

interface PrivateRouteProps {
  children: ReactNode
  allowedRoles?: Role[]
}

export function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  // Redirigir a la ruta default del rol si intenta acceder a una sección no permitida.
  // La lógica de qué ruta corresponde a cada rol vive en navigationConfig.ts.
  const path = location.pathname
  const defaultRoute = getDefaultRoute(user.role)

  if (path.startsWith('/admin/') && user.role !== 'admin') {
    return <Navigate to={defaultRoute} replace />
  }
  return <>{children}</>
}
