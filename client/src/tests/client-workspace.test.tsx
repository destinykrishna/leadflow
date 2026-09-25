import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Client } from '@/types/client.types'
import type { DocumentItem } from '@/types/document.types'
import type { Lead } from '@/types/pipeline.types'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'
import * as AuthHook from '@/hooks/useAuth'
import * as ClientsApi from '@/features/clients/api/clients.api'
import * as LeadsApi from '@/features/leads/api/leads.api'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { ClientDetailPage } from '@/features/clients/ClientDetailPage'
import { ClientDetailView } from '@/features/clients/components/ClientDetailView'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}))

describe('Phase 4 — Prompt 1: Clients & Case Workspace', () => {
  let queryClient: QueryClient

  const mockAdvisor: AuthUser = {
    id: 'advisor-1',
    email: 'elena@berlin.de',
    name: 'Elena Schmidt',
    role: 'ADVISOR',
    status: 'ACTIVE',
    brokerageId: 'brokerage-1',
  }

  const mockClientUser: AuthUser = {
    id: 'client-user-1',
    email: 'alex@expat.de',
    name: 'Alex Expat',
    role: 'CLIENT',
    status: 'ACTIVE',
    brokerageId: 'brokerage-1',
  }

  const createMockAuth = (user: AuthUser | null): AuthContextValue => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  })

  const sampleClients: Client[] = [
    {
      _id: 'client-1',
      brokerageId: 'brokerage-1',
      userId: 'user-client-1',
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex.morgan@example.com',
      phone: '+49 170 5551234',
      status: 'ACTIVE',
      type: 'BUYER',
      assignedTo: {
        _id: 'advisor-1',
        name: 'Elena Schmidt',
        email: 'elena@berlin.de',
        role: 'ADVISOR',
      },
      leadId: 'lead-origin-1',
      address: {
        street: 'Friedrichstraße 42',
        city: 'Berlin',
        state: 'Berlin',
        postalCode: '10117',
      },
      createdAt: new Date('2026-03-01T09:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-01T09:00:00Z').toISOString(),
    },
    {
      _id: 'client-2',
      brokerageId: 'brokerage-1',
      userId: null,
      firstName: 'Sophie',
      lastName: 'Dubois',
      email: 'sophie.dubois@example.fr',
      phone: '+49 171 9998888',
      status: 'ACTIVE',
      type: 'SELLER',
      assignedTo: null,
      leadId: null,
      address: {
        city: 'Munich',
      },
      createdAt: new Date('2026-03-05T14:30:00Z').toISOString(),
      updatedAt: new Date('2026-03-05T14:30:00Z').toISOString(),
    },
    {
      _id: 'client-3',
      brokerageId: 'brokerage-1',
      userId: 'user-client-3',
      firstName: 'Klaus',
      lastName: 'Zimmermann',
      email: 'klaus.zimmermann@web.de',
      status: 'INACTIVE',
      type: 'BOTH',
      assignedTo: null,
      leadId: null,
      createdAt: new Date('2026-02-15T10:00:00Z').toISOString(),
      updatedAt: new Date('2026-02-15T10:00:00Z').toISOString(),
    },
  ]

  const sampleLeadOrigin: Lead = {
    _id: 'lead-origin-1',
    brokerageId: 'brokerage-1',
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'alex.morgan@example.com',
    phone: '+49 170 5551234',
    status: 'WON',
    source: 'CAMPAIGN',
    score: 92,
    convertedClientId: 'client-1',
    notes: 'Expat software engineer relocating to Berlin, seeking 80% LTV mortgage financing.',
    customFields: {
      loanAmount: 480000,
      propertyValue: 600000,
      monthlyIncome: 7500,
      downPayment: 120000,
      isConverted: true,
    },
    __v: 2,
    createdAt: new Date('2026-02-20T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T09:00:00Z').toISOString(),
  }

  const sampleDocuments: DocumentItem[] = [
    {
      _id: 'doc-1',
      brokerageId: 'brokerage-1',
      clientId: 'client-1',
      title: 'German Residence Permit (Aufenthaltstitel)',
      type: 'IDENTIFICATION',
      status: 'VERIFIED',
      fileUrl: 'https://ik.imagekit.io/leadflow/passports/alex_permit.pdf',
      fileSize: 204800,
      verifiedAt: new Date('2026-03-02T11:00:00Z').toISOString(),
      createdAt: new Date('2026-03-01T10:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-02T11:00:00Z').toISOString(),
    },
    {
      _id: 'doc-2',
      brokerageId: 'brokerage-1',
      clientId: 'client-1',
      title: 'January 2026 Payslip',
      type: 'PAYSLIP',
      status: 'PROCESSING',
      fileUrl: 'https://ik.imagekit.io/leadflow/payslips/jan_2026.pdf',
      fileSize: 153600,
      createdAt: new Date('2026-03-03T12:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-03T12:00:00Z').toISOString(),
    },
    {
      _id: 'doc-3',
      brokerageId: 'brokerage-1',
      clientId: 'client-1',
      title: 'Bank Statement Q4 2025',
      type: 'BANK_STATEMENT',
      status: 'REJECTED',
      fileUrl: 'https://ik.imagekit.io/leadflow/statements/q4.pdf',
      fileSize: 512000,
      verificationNotes: 'Statement is missing page 3 with closing balance.',
      createdAt: new Date('2026-03-04T08:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-04T09:30:00Z').toISOString(),
    },
  ]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
  })

  // Helper render with query client and router
  const renderWithProviders = (
    ui: React.ReactElement,
    initialEntries = ['/app/clients']
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </QueryClientProvider>
    )
  }

  // 1. Client List Rendering & Summary KPIs
  it('renders clients list with summary KPIs, borrower details, and profile types', async () => {
    vi.spyOn(ClientsApi.clientsApi, 'getClients').mockResolvedValue(sampleClients)

    renderWithProviders(<ClientsPage />)

    // Check header and KPI strip after query resolves
    await waitFor(() => {
      expect(screen.getByText('Clients & Mortgage Cases')).toBeInTheDocument()
      expect(screen.getByText('3 Cases')).toBeInTheDocument()
      expect(screen.getByText('Total Cases')).toBeInTheDocument()
      expect(screen.getByText('Active Files')).toBeInTheDocument()
      expect(screen.getByText('Home Buyers')).toBeInTheDocument()
      expect(screen.getByText('Sellers & Dual')).toBeInTheDocument()
    })

    // Check table content
    expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
    expect(screen.getByText('alex.morgan@example.com')).toBeInTheDocument()
    expect(screen.getByText('Sophie Dubois')).toBeInTheDocument()
    expect(screen.getByText('Klaus Zimmermann')).toBeInTheDocument()

    // Check profile type badges
    expect(screen.getAllByText('Buyer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Seller').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Buyer & Seller').length).toBeGreaterThan(0)

    // Check converted lead badge
    expect(screen.getByText('Converted Lead')).toBeInTheDocument()

    // Check advisor assignment
    expect(screen.getByText('Elena Schmidt')).toBeInTheDocument()
  })

  // 2. Search and Filtering in Client List
  it('filters clients list by search input, status, and profile type', async () => {
    vi.spyOn(ClientsApi.clientsApi, 'getClients').mockResolvedValue(sampleClients)

    renderWithProviders(<ClientsPage />)

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
    })

    // Search by name "Dubois"
    const searchInput = screen.getByPlaceholderText(/search by client name/i)
    fireEvent.change(searchInput, { target: { value: 'Dubois' } })

    expect(screen.getByText('Sophie Dubois')).toBeInTheDocument()
    expect(screen.queryByText('Alex Morgan')).not.toBeInTheDocument()
    expect(screen.queryByText('Klaus Zimmermann')).not.toBeInTheDocument()

    // Search with non-matching query shows empty state
    fireEvent.change(searchInput, { target: { value: 'Nonexistent' } })
    expect(screen.getByText('No Matching Cases')).toBeInTheDocument()

    // Clear filters button resets list
    const clearButton = screen.getByRole('button', { name: /clear filters/i })
    fireEvent.click(clearButton)

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
      expect(screen.getByText('Sophie Dubois')).toBeInTheDocument()
    })
  })

  // 3. Navigation from List to Dedicated Client Workspace
  it('navigates to dedicated client case workspace when a row is clicked', async () => {
    vi.spyOn(ClientsApi.clientsApi, 'getClients').mockResolvedValue(sampleClients)
    vi.spyOn(ClientsApi.clientsApi, 'getClientById').mockResolvedValue(sampleClients[0])
    vi.spyOn(ClientsApi.clientsApi, 'getClientDocuments').mockResolvedValue(sampleDocuments)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLeadOrigin)

    renderWithProviders(
      <Routes>
        <Route path="/app/clients" element={<ClientsPage />} />
        <Route path="/app/clients/:id" element={<ClientDetailPage />} />
      </Routes>,
      ['/app/clients']
    )

    await waitFor(() => {
      expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
    })

    // Click on the Workspace button for Alex Morgan
    const workspaceButtons = screen.getAllByRole('button', { name: /workspace/i })
    fireEvent.click(workspaceButtons[0])

    // Should navigate and display the Client Case breadcrumb & details
    await waitFor(() => {
      expect(screen.getByText('Case Details')).toBeInTheDocument()
      expect(screen.getByText('Back to Cases')).toBeInTheDocument()
    })
  })

  // 4. Dedicated Client Workspace Details, Financials & LTV
  it('renders client identity, originating lead relationship, financial metrics and LTV calculation', async () => {
    vi.spyOn(ClientsApi.clientsApi, 'getClientById').mockResolvedValue(sampleClients[0])
    vi.spyOn(ClientsApi.clientsApi, 'getClientDocuments').mockResolvedValue(sampleDocuments)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLeadOrigin)

    renderWithProviders(<ClientDetailView clientId="client-1" />)

    // Identity
    await waitFor(() => {
      expect(screen.getAllByText('Alex Morgan')[0]).toBeInTheDocument()
      expect(screen.getAllByText('alex.morgan@example.com')[0]).toBeInTheDocument()
      expect(screen.getAllByText('+49 170 5551234')[0]).toBeInTheDocument()
      expect(screen.getByText('Active Case')).toBeInTheDocument()
      expect(screen.getAllByText('Buyer / Borrower')[0]).toBeInTheDocument()
    })

    // Financial KPI Strip (from linked lead)
    // 480,000 / 600,000 = 80.0% LTV
    await waitFor(() => {
      expect(screen.getByText(/80\.0% LTV/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Target Loan')).toBeInTheDocument()
    expect(screen.getByText('Property Value')).toBeInTheDocument()
    expect(screen.getByText('Monthly Income')).toBeInTheDocument()

    // Originating Lead Details
    expect(screen.getByText('Case & Inquiry Relationship')).toBeInTheDocument()
    expect(screen.getByText('92/100 Score')).toBeInTheDocument()
    expect(screen.getByText('CAMPAIGN')).toBeInTheDocument()
    expect(
      screen.getByText(/Expat software engineer relocating to Berlin/i)
    ).toBeInTheDocument()

    // Registered Address
    expect(screen.getByText('Friedrichstraße 42')).toBeInTheDocument()
    expect(screen.getByText('10117 Berlin')).toBeInTheDocument()

    // Assigned Advisor
    expect(screen.getByText('Elena Schmidt')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument() // Elena is the logged-in advisor
  })

  // 5. Document List & Status Badges
  it('renders client documents with processing statuses, notes, and filter tabs', async () => {
    vi.spyOn(ClientsApi.clientsApi, 'getClientById').mockResolvedValue(sampleClients[0])
    vi.spyOn(ClientsApi.clientsApi, 'getClientDocuments').mockResolvedValue(sampleDocuments)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLeadOrigin)

    renderWithProviders(<ClientDetailView clientId="client-1" />)

    await waitFor(() => {
      expect(screen.getByText('German Residence Permit (Aufenthaltstitel)')).toBeInTheDocument()
    })

    // Check documents rendering
    expect(screen.getByText('VERIFIED')).toBeInTheDocument()

    expect(screen.getByText('January 2026 Payslip')).toBeInTheDocument()
    expect(screen.getByText('PROCESSING (BULLMQ)')).toBeInTheDocument()

    expect(screen.getByText('Bank Statement Q4 2025')).toBeInTheDocument()
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
    expect(
      screen.getByText(/Statement is missing page 3 with closing balance/i)
    ).toBeInTheDocument()

    // Test document filter tab: click "Verified (1)"
    const verifiedTab = screen.getByRole('button', { name: /verified \(1\)/i })
    fireEvent.click(verifiedTab)

    expect(screen.getByText('German Residence Permit (Aufenthaltstitel)')).toBeInTheDocument()
    expect(screen.queryByText('January 2026 Payslip')).not.toBeInTheDocument()
    expect(screen.queryByText('Bank Statement Q4 2025')).not.toBeInTheDocument()
  })

  // 6. 404 Not Found & Tenant Boundary Defense
  it('renders anti-IDOR 404 Not Found screen when client belongs to another tenant or does not exist', async () => {
    const error404 = new Error('Client resource not found')
    ;(error404 as any).response = { status: 404 }

    vi.spyOn(ClientsApi.clientsApi, 'getClientById').mockRejectedValue(error404)

    renderWithProviders(<ClientDetailView clientId="guessed-id-from-other-tenant" />)

    await waitFor(() => {
      expect(screen.getByText('Client Case Not Found')).toBeInTheDocument()
      expect(
        screen.getByText(/strict tenant isolation rules/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /return to cases/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry query/i })).toBeInTheDocument()
    })
  })

  // 7. Role Permissions Guard: CLIENT users cannot access advisor workspace
  it('blocks CLIENT users from accessing the advisor client workspace routes via ProtectedRoute', async () => {
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockClientUser))

    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={['BROKERAGE_ADMIN', 'ADVISOR']} />}>
          <Route path="/app/clients" element={<ClientsPage />} />
        </Route>
        <Route path="/portal/case" element={<div>Expat Client Portal</div>} />
      </Routes>,
      ['/app/clients']
    )

    // Should redirect to portal
    await waitFor(() => {
      expect(screen.getByText('Expat Client Portal')).toBeInTheDocument()
      expect(screen.queryByText('Clients & Mortgage Cases')).not.toBeInTheDocument()
    })
  })
})
