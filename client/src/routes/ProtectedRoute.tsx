import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Loader } from '@/components/ui/Loader'
import type { UserRole } from '@/types/auth.types'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <Loader fullScreen label="Restoring session..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to the default view matching user's active role
    if (user.role === 'CLIENT') {
      return <Navigate to="/portal/case" replace />
    }
    if (user.role === 'PLATFORM_ADMIN') {
      return <Navigate to="/admin/brokerages" replace />
    }
    return <Navigate to="/app/pipeline" replace />
  }

  return <Outlet />
}
