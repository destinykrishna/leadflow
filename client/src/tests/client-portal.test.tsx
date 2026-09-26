import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import * as AuthHook from '@/hooks/useAuth'
import * as ClientsApiHook from '@/features/clients/api/clients.api'
import { ClientCasePage } from '@/features/portal/ClientCasePage'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'
import type { Client } from '@/types/client.types'
import type { DocumentItem } from '@/types/document.types'

const createMockAuth = (overrides?: Partial<AuthContextValue>): AuthContextValue => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  ...overrides,
})

const mockClientUser: AuthUser = {
  id: 'user-client-1',
  email: 'rahul.sharma@example.com',
  name: 'Rahul Sharma',
  role: 'CLIENT',
  status: 'ACTIVE',
  brokerageId: 'brokerage-apex',
}

const mockAdvisorUser: AuthUser = {
  id: 'user-advisor-1',
  email: 'priya.patel@apexmortgage.in',
  name: 'Priya Patel',
  role: 'ADVISOR',
  status: 'ACTIVE',
  brokerageId: 'brokerage-apex',
}

const mockPlatformAdminUser: AuthUser = {
  id: 'user-admin-1',
  email: 'admin@leadflow.in',
  name: 'Super Admin',
  role: 'PLATFORM_ADMIN',
  status: 'ACTIVE',
  brokerageId: null,
}

const mockClientCase: Client = {
  _id: 'client-case-12345678',
  brokerageId: {
    _id: 'brokerage-apex',
    name: 'Apex Home Finance',
    slug: 'apex-home-finance',
  },
  userId: 'user-client-1',
  firstName: 'Rahul',
  lastName: 'Sharma',
  email: 'rahul.sharma@example.com',
  phone: '+91 98765 43210',
  status: 'ACTIVE',
  type: 'BUYER',
  assignedTo: {
    _id: 'user-advisor-1',
    name: 'Priya Patel',
    email: 'priya.patel@apexmortgage.in',
    phone: '+91 98765 11111',
    role: 'ADVISOR',
  },
  leadId: {
    _id: 'lead-origin-1',
    status: 'WON',
    source: 'WEBSITE',
    score: 92,
    createdAt: '2026-09-01T10:00:00.000Z',
    customFields: {
      loanAmount: 7500000,
      propertyValue: 9500000,
      monthlyGrossIncome: 180000,
      downPayment: 2000000,
    },
  },
  address: {
    street: 'Indiranagar 100ft Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
  },
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-26T10:00:00.000Z',
}

const mockDocuments: DocumentItem[] = [
  {
    _id: 'doc-1',
    brokerageId: 'brokerage-apex',
    clientId: 'client-case-12345678',
    title: 'PAN & Aadhaar Card',
    type: 'IDENTIFICATION',
    status: 'VERIFIED',
    fileUrl: 'https://storage.leadflow.in/docs/pan.pdf',
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:05:00.000Z',
  },
  {
    _id: 'doc-2',
    brokerageId: 'brokerage-apex',
    clientId: 'client-case-12345678',
    title: 'August 2026 Payslip',
    type: 'PAYSLIP',
    status: 'PROCESSING',
    fileUrl: 'https://storage.leadflow.in/docs/payslip.pdf',
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-10T10:00:00.000Z',
  },
  {
    _id: 'doc-3',
    brokerageId: 'brokerage-apex',
    clientId: 'client-case-12345678',
    title: 'HDFC Bank Statement',
    type: 'BANK_STATEMENT',
    status: 'REJECTED',
    verificationNotes: 'Statement is missing month of July 2026. Please upload complete 6 months.',
    fileUrl: 'https://storage.leadflow.in/docs/bank.pdf',
    createdAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-09-12T10:02:00.000Z',
  },
]

describe('Phase 6 — Prompt 1: Client Portal Security & Route Protection', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  // 1. Role-Based Access Control & Navigation Boundaries
  describe('1. Role-Based Access Control & Portal Boundary Enforcement', () => {
    it('redirects unauthenticated users attempting to access /portal/case to /login', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: false, user: null }),
      )

      render(
        <MemoryRouter initialEntries={['/portal/case']}>
          <Routes>
            <Route path="/login" element={<div>Public Login Screen</div>} />
            <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
              <Route path="/portal/case" element={<div>Client Portal Workspace</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Public Login Screen')).toBeInTheDocument()
      expect(screen.queryByText('Client Portal Workspace')).not.toBeInTheDocument()
    })

    it('blocks ADVISOR from accessing CLIENT-only portal and redirects to /app/pipeline', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: true, user: mockAdvisorUser }),
      )

      render(
        <MemoryRouter initialEntries={['/portal/case']}>
          <Routes>
            <Route path="/app/pipeline" element={<div>Advisor Pipeline Board</div>} />
            <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
              <Route path="/portal/case" element={<div>Client Portal Workspace</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Advisor Pipeline Board')).toBeInTheDocument()
      expect(screen.queryByText('Client Portal Workspace')).not.toBeInTheDocument()
    })

    it('blocks PLATFORM_ADMIN from accessing CLIENT-only portal and redirects to /admin/brokerages', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: true, user: mockPlatformAdminUser }),
      )

      render(
        <MemoryRouter initialEntries={['/portal/case']}>
          <Routes>
            <Route path="/admin/brokerages" element={<div>Platform Admin Brokerages</div>} />
            <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
              <Route path="/portal/case" element={<div>Client Portal Workspace</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Platform Admin Brokerages')).toBeInTheDocument()
      expect(screen.queryByText('Client Portal Workspace')).not.toBeInTheDocument()
    })

    it('blocks CLIENT users from accessing advisor/admin workspace routes and redirects to /portal/case', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: true, user: mockClientUser }),
      )

      render(
        <MemoryRouter initialEntries={['/app/leads/lead-123']}>
          <Routes>
            <Route path="/portal/case" element={<div>Client Portal Home</div>} />
            <Route
              element={<ProtectedRoute allowedRoles={['PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR']} />}
            >
              <Route path="/app/leads/:id" element={<div>Advisor Lead Workspace</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Client Portal Home')).toBeInTheDocument()
      expect(screen.queryByText('Advisor Lead Workspace')).not.toBeInTheDocument()
    })

    it('allows authenticated CLIENT user to access /portal/case', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: true, user: mockClientUser }),
      )

      render(
        <MemoryRouter initialEntries={['/portal/case']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
              <Route path="/portal/case" element={<div>Client Portal Workspace</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Client Portal Workspace')).toBeInTheDocument()
    })
  })

  // 2. Client Dashboard & Case Overview Rendering
  describe('2. Client Dashboard & Financial Data Presentation', () => {
    it('renders the client dashboard with real case info, INR currency, and assigned advisor', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: true, user: mockClientUser }),
      )
      vi.spyOn(ClientsApiHook, 'useMyCase').mockReturnValue({
        data: mockClientCase,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      } as any)
      vi.spyOn(ClientsApiHook, 'useClientDocuments').mockReturnValue({
        data: mockDocuments,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      } as any)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ClientCasePage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      // 1. Borrower greeting & brokerage firm
      expect(screen.getByText('Welcome back, Rahul')).toBeInTheDocument()
      expect(screen.getAllByText('Apex Home Finance').length).toBeGreaterThan(0)
      expect(screen.getByText('Active Mortgage Case')).toBeInTheDocument()

      // 2. Indian financial formatting (INR ₹)
      // ₹75,00,000 Loan Amount
      expect(screen.getByText('₹75,00,000')).toBeInTheDocument()
      // ₹95,00,000 Property Value
      expect(screen.getByText('₹95,00,000')).toBeInTheDocument()
      // Dynamic LTV %: (7500000 / 9500000) * 100 = 78.9%
      expect(screen.getByText('78.9%')).toBeInTheDocument()
      // Monthly gross income
      expect(screen.getByText('₹1,80,000')).toBeInTheDocument()

      // 3. Document verification summary counts
      expect(screen.getByText('Document Verification Summary')).toBeInTheDocument()
      expect(screen.getByText('1 of 3 documents verified')).toBeInTheDocument()
      expect(screen.getByText('August 2026 Payslip')).toBeInTheDocument()
      expect(screen.getByText('HDFC Bank Statement')).toBeInTheDocument()

      // 4. Inspection note for rejected document
      expect(screen.getByText(/Statement is missing month of July 2026/)).toBeInTheDocument()

      // 5. Assigned advisor card
      expect(screen.getByText('Priya Patel')).toBeInTheDocument()
      expect(screen.getByText('priya.patel@apexmortgage.in')).toBeInTheDocument()
    })

    it('renders empty state when client has no case record yet', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: true, user: mockClientUser }),
      )
      vi.spyOn(ClientsApiHook, 'useMyCase').mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      } as any)
      vi.spyOn(ClientsApiHook, 'useClientDocuments').mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      } as any)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ClientCasePage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      expect(screen.getByText('Application Dossier in Preparation')).toBeInTheDocument()
      expect(screen.getByText(/Your mortgage account has been registered/)).toBeInTheDocument()
    })

    it('renders error state with retry button when case retrieval fails', () => {
      const mockRefetch = vi.fn()
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: true, user: mockClientUser }),
      )
      vi.spyOn(ClientsApiHook, 'useMyCase').mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network timeout contacting server'),
        refetch: mockRefetch,
        isFetching: false,
      } as any)
      vi.spyOn(ClientsApiHook, 'useClientDocuments').mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      } as any)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ClientCasePage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      expect(screen.getByText('Unable to Load Mortgage Case')).toBeInTheDocument()
      expect(screen.getByText('Network timeout contacting server')).toBeInTheDocument()

      // Retry button
      const retryButton = screen.getByRole('button', { name: /try again/i })
      fireEvent.click(retryButton)
      expect(mockRefetch).toHaveBeenCalled()
    })
  })
})
