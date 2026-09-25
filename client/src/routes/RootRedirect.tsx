import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Loader } from '@/components/ui/Loader'

export function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <Loader fullScreen label="Checking authorization..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'CLIENT') {
    return <Navigate to="/portal/case" replace />
  }

  if (user.role === 'PLATFORM_ADMIN') {
    return <Navigate to="/admin/brokerages" replace />
  }

  return <Navigate to="/app/pipeline" replace />
}
