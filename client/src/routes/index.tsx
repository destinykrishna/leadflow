import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { RootRedirect } from './RootRedirect'
import { AppLayout } from '@/components/layout/AppLayout'
import { Loader } from '@/components/ui/Loader'
import { LoginPage } from '@/features/auth/LoginPage'

// Lazy-loaded workspace features (Advisors & Brokerage Admins)
const DashboardPage = React.lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const PipelinePage = React.lazy(() =>
  import('@/features/pipeline/PipelinePage').then((m) => ({ default: m.PipelinePage })),
)
const LeadsPage = React.lazy(() =>
  import('@/features/leads/LeadsPage').then((m) => ({ default: m.LeadsPage })),
)
const LeadDetailPage = React.lazy(() =>
  import('@/features/leads/LeadDetailPage').then((m) => ({ default: m.LeadDetailPage })),
)
const ClientsPage = React.lazy(() =>
  import('@/features/clients/ClientsPage').then((m) => ({ default: m.ClientsPage })),
)
const ClientDetailPage = React.lazy(() =>
  import('@/features/clients/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })),
)
const DocumentsPage = React.lazy(() =>
  import('@/features/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
)
const TasksPage = React.lazy(() =>
  import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
)
const TemplatesPage = React.lazy(() =>
  import('@/features/templates/TemplatesPage').then((m) => ({ default: m.TemplatesPage })),
)
const TriggersPage = React.lazy(() =>
  import('@/features/triggers/TriggersPage').then((m) => ({ default: m.TriggersPage })),
)
const TeamPage = React.lazy(() =>
  import('@/features/team/TeamPage').then((m) => ({ default: m.TeamPage })),
)

// Lazy-loaded Client Portal features (Borrowers)
const ClientCasePage = React.lazy(() =>
  import('@/features/portal/ClientCasePage').then((m) => ({ default: m.ClientCasePage })),
)
const ClientDocumentsPage = React.lazy(() =>
  import('@/features/portal/ClientDocumentsPage').then((m) => ({ default: m.ClientDocumentsPage })),
)
const ClientAdvisorPage = React.lazy(() =>
  import('@/features/portal/ClientAdvisorPage').then((m) => ({ default: m.ClientAdvisorPage })),
)

// Lazy-loaded Platform Administration (System Admins)
const BrokeragesPage = React.lazy(() =>
  import('@/features/admin/BrokeragesPage').then((m) => ({ default: m.BrokeragesPage })),
)
const HealthPage = React.lazy(() =>
  import('@/features/admin/HealthPage').then((m) => ({ default: m.HealthPage })),
)
const AuditPage = React.lazy(() =>
  import('@/features/admin/AuditPage').then((m) => ({ default: m.AuditPage })),
)
const NotFoundPage = React.lazy(() =>
  import('@/features/misc/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
import { useLocation } from 'react-router-dom'
import * as React from 'react'

function RouteTitleSync() {
  const location = useLocation()

  React.useEffect(() => {
    const pathname = location.pathname

    if (pathname === '/login') {
      document.title = 'Sign In · LeadFlow'
    } else if (pathname === '/app/dashboard') {
      document.title = 'Dashboard · LeadFlow'
    } else if (pathname === '/app/pipeline') {
      document.title = 'Pipeline · LeadFlow'
    } else if (pathname === '/app/leads') {
      document.title = 'Leads · LeadFlow'
    } else if (pathname.startsWith('/app/leads/')) {
      document.title = 'Lead Details · LeadFlow'
    } else if (pathname === '/app/clients') {
      document.title = 'Clients · LeadFlow'
    } else if (pathname.startsWith('/app/clients/')) {
      document.title = 'Client Details · LeadFlow'
    } else if (pathname === '/app/documents') {
      document.title = 'Documents · LeadFlow'
    } else if (pathname === '/app/tasks') {
      document.title = 'Tasks · LeadFlow'
    } else if (pathname === '/app/templates') {
      document.title = 'Templates · LeadFlow'
    } else if (pathname === '/app/triggers') {
      document.title = 'Triggers · LeadFlow'
    } else if (pathname === '/app/team' || pathname === '/app/advisors') {
      document.title = 'Advisors & Team · LeadFlow'
    } else if (pathname === '/portal/case') {
      document.title = 'My Case · LeadFlow'
    } else if (pathname === '/portal/documents') {
      document.title = 'Documents · LeadFlow'
    } else if (pathname === '/portal/advisor') {
      document.title = 'Advisor · LeadFlow'
    } else if (pathname === '/admin/brokerages') {
      document.title = 'Brokerages · LeadFlow'
    } else if (pathname === '/admin/health') {
      document.title = 'System Health · LeadFlow'
    } else if (pathname === '/admin/audit') {
      document.title = 'Audit Logs · LeadFlow'
    } else {
      document.title = 'LeadFlow — Mortgage OS'
    }
  }, [location.pathname])

  return null
}

export function AppRoutes() {
  return (
    <>
      <RouteTitleSync />
      <React.Suspense fallback={<Loader fullScreen label="Loading workspace..." />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root redirector */}
          <Route path="/" element={<RootRedirect />} />

          {/* Advisor & Brokerage Admin Workspace */}
          <Route element={<ProtectedRoute allowedRoles={['BROKERAGE_ADMIN', 'ADVISOR']} />}>
            <Route element={<AppLayout />}>
              <Route path="/app" element={<Navigate to="/app/pipeline" replace />} />
              <Route path="/app/dashboard" element={<DashboardPage />} />
              <Route path="/app/pipeline" element={<PipelinePage />} />
              <Route path="/app/leads" element={<LeadsPage />} />
              <Route path="/app/leads/:id" element={<LeadDetailPage />} />
              <Route path="/app/clients" element={<ClientsPage />} />
              <Route path="/app/clients/:id" element={<ClientDetailPage />} />
              <Route path="/app/documents" element={<DocumentsPage />} />
              <Route path="/app/tasks" element={<TasksPage />} />
              <Route path="/app/templates" element={<TemplatesPage />} />
              <Route path="/app/triggers" element={<TriggersPage />} />

              {/* Brokerage Admin Only */}
              <Route element={<ProtectedRoute allowedRoles={['BROKERAGE_ADMIN']} />}>
                <Route path="/app/team" element={<TeamPage />} />
                <Route path="/app/advisors" element={<Navigate to="/app/team" replace />} />
              </Route>
            </Route>
          </Route>

          {/* Client Portal */}
          <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
            <Route element={<AppLayout />}>
              <Route path="/portal" element={<Navigate to="/portal/case" replace />} />
              <Route path="/portal/case" element={<ClientCasePage />} />
              <Route path="/portal/documents" element={<ClientDocumentsPage />} />
              <Route path="/portal/advisor" element={<ClientAdvisorPage />} />
            </Route>
          </Route>

          {/* Platform Administration */}
          <Route element={<ProtectedRoute allowedRoles={['PLATFORM_ADMIN']} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<Navigate to="/admin/brokerages" replace />} />
              <Route path="/admin/brokerages" element={<BrokeragesPage />} />
              <Route path="/admin/health" element={<HealthPage />} />
              <Route path="/admin/audit" element={<AuditPage />} />
            </Route>
          </Route>

          {/* Fallback 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </React.Suspense>
    </>
  )
}
