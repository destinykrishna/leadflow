import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Lead } from '@/types/pipeline.types'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'
import * as AuthHook from '@/hooks/useAuth'
import * as LeadsApi from '@/features/leads/api/leads.api'
import { LeadDetailView } from '@/features/leads/components/LeadDetailView'
import { ConvertLeadModal } from '@/features/leads/components/ConvertLeadModal'

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

describe('Phase 3 — Prompt 2: Lead Workspace Polish', () => {
  let queryClient: QueryClient

  const mockAdvisor: AuthUser = {
    id: 'advisor-1',
    email: 'elena@berlin.de',
    name: 'Elena Schmidt',
    role: 'ADVISOR',
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

  const sampleLeadWithLTV: Lead = {
    _id: 'lead-ltv-1',
    brokerageId: 'brokerage-1',
    firstName: 'Maximilian',
    lastName: 'Weber',
    email: 'maximilian@example.de',
    phone: '+49 170 1111111',
    status: 'QUALIFIED',
    source: 'WEBSITE',
    score: 85,
    assignedTo: {
      _id: 'advisor-1',
      name: 'Elena Schmidt',
      email: 'elena@berlin.de',
    },
    customFields: {
      loanAmount: 450000,
      propertyValue: 550000,
      monthlyIncome: 6500,
      employmentStatus: 'Permanent Contract',
      residenceStatus: 'EU Blue Card',
    },
    __v: 1,
    createdAt: new Date('2026-03-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T10:00:00Z').toISOString(),
  }

  const sampleLeadLost: Lead = {
    _id: 'lead-lost-1',
    brokerageId: 'brokerage-1',
    firstName: 'Jonas',
    lastName: 'Fischer',
    email: 'jonas@example.de',
    status: 'LOST',
    source: 'WEBSITE',
    score: 25,
    customFields: {},
    __v: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
  })

  it('1. Computes and displays the Loan-to-Value (LTV) percentage and financial KPI strip', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLeadWithLTV)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue([])
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadDetailView leadId="lead-ltv-1" initialLead={sampleLeadWithLTV} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // 450,000 / 550,000 = 81.8% LTV
    expect(screen.getByText('81.8% LTV')).toBeInTheDocument()
    expect(screen.getByText('81.8% Loan-to-Value Ratio')).toBeInTheDocument()
    expect(screen.getByText('Target Loan Amount')).toBeInTheDocument()
    expect(screen.getByText('Estimated Property Value')).toBeInTheDocument()
    expect(screen.getByText('Monthly Gross Income')).toBeInTheDocument()
  })

  it('2. Renders linear pipeline stage progression tracker and handles terminal LOST state', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLeadLost)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue([])
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadDetailView leadId="lead-lost-1" initialLead={sampleLeadLost} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByText('Pipeline Stage Progression')).toBeInTheDocument()
    expect(screen.getByText(/Terminal State: Closed Lost/i)).toBeInTheDocument()
    expect(
      screen.getByText(/This lead has been archived as lost/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Terminal Stage: No outgoing transitions permitted.'),
    ).toBeInTheDocument()
  })

  it('3. Clearly separates primary stage advance action from secondary mark-as-lost action', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLeadWithLTV)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue([])
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadDetailView leadId="lead-ltv-1" initialLead={sampleLeadWithLTV} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // QUALIFIED valid transitions: PROPOSAL (advance) and LOST (exit)
    const advanceBtn = screen.getByRole('button', { name: /Advance to Proposal/i })
    const lostBtn = screen.getByRole('button', { name: /Mark as Lost/i })

    expect(advanceBtn).toBeInTheDocument()
    expect(lostBtn).toBeInTheDocument()
    expect(advanceBtn.className).toContain('bg-primary')
    expect(lostBtn.className).toContain('text-rose-700')
  })

  it('4. Concurrency conflict (409) displays polished notice with Reload and Dismiss controls', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLeadWithLTV)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue([])
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue([])

    vi.spyOn(LeadsApi.leadsApi, 'updateLeadStage').mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          error: {
            code: 'CONFLICT',
            message: 'Conflict',
          },
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadDetailView leadId="lead-ltv-1" initialLead={sampleLeadWithLTV} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const advanceBtn = screen.getByRole('button', { name: /Advance to Proposal/i })
    fireEvent.click(advanceBtn)

    await waitFor(() => {
      expect(screen.getByText('Concurrency Notice')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reload/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument()
    })

    // Click Dismiss
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }))
    expect(screen.queryByText('Concurrency Notice')).not.toBeInTheDocument()
  })

  it('5. 404 not found state provides pipeline and leads navigation actions', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockRejectedValue({
      response: {
        status: 404,
        data: {
          error: {
            code: 'NOT_FOUND',
            message: 'Lead resource not found',
          },
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/leads/nonexistent-123']}>
          <Routes>
            <Route
              path="/app/leads/:id"
              element={<LeadDetailView leadId="nonexistent-123" />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Lead Inquiry Not Found')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Return to Pipeline/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /View All Leads/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Retry Query/i })).toBeInTheDocument()
    })
  })

  it('6. ConvertLeadModal provides polished client profile type selector and copy feedback', async () => {
    const handleClose = vi.fn()
    const handleSuccess = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ConvertLeadModal
            lead={sampleLeadWithLTV}
            isOpen={true}
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByText('Convert Lead to Client Case')).toBeInTheDocument()
    expect(screen.getByText('Client Profile Type')).toBeInTheDocument()
    expect(screen.getByText('Purchasing property with mortgage financing')).toBeInTheDocument()
    expect(screen.getByText('Divesting property or real estate assets')).toBeInTheDocument()

    // Switch client type to Seller
    const sellerOption = screen.getByRole('button', { name: /Seller Divesting property/i })
    fireEvent.click(sellerOption)

    expect(screen.getByRole('button', { name: /Confirm Conversion/i })).toBeInTheDocument()
  })
})
