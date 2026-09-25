import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { RootRedirect } from './RootRedirect'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { NotFoundPage } from '@/features/misc/NotFoundPage'

// Workspace features (Advisors & Brokerage Admins)
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PipelinePage } from '@/features/pipeline/PipelinePage'
import { LeadsPage } from '@/features/leads/LeadsPage'
import { LeadDetailPage } from '@/features/leads/LeadDetailPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { ClientDetailPage } from '@/features/clients/ClientDetailPage'
import { DocumentsPage } from '@/features/documents/DocumentsPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { TemplatesPage } from '@/features/templates/TemplatesPage'
import { TriggersPage } from '@/features/triggers/TriggersPage'

// Expat Portal features (Borrowers)
import { ClientCasePage } from '@/features/portal/ClientCasePage'
import { ClientDocumentsPage } from '@/features/portal/ClientDocumentsPage'
import { ClientAdvisorPage } from '@/features/portal/ClientAdvisorPage'

// Platform Administration (System Admins)
import { BrokeragesPage } from '@/features/admin/BrokeragesPage'
import { HealthPage } from '@/features/admin/HealthPage'
import { AuditPage } from '@/features/admin/AuditPage'

export function AppRoutes() {
  return (
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

          {/* Brokerage Admin Only */}
          <Route element={<ProtectedRoute allowedRoles={['BROKERAGE_ADMIN']} />}>
            <Route path="/app/templates" element={<TemplatesPage />} />
            <Route path="/app/triggers" element={<TriggersPage />} />
          </Route>
        </Route>
      </Route>

      {/* Expat Client Portal */}
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
  )
}
