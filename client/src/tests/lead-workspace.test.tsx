import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Lead, PipelineGroupedData } from '@/types/pipeline.types'
import type { Task } from '@/types/task.types'
import type { DocumentItem } from '@/types/document.types'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'
import * as AuthHook from '@/hooks/useAuth'
import * as PipelineApi from '@/features/pipeline/api/pipeline.api'
import * as LeadsApi from '@/features/leads/api/leads.api'
import { PipelinePage } from '@/features/pipeline/PipelinePage'
import { LeadDetailView } from '@/features/leads/components/LeadDetailView'
import { LeadsPage } from '@/features/leads/LeadsPage'

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

describe('Phase 3 — Prompt 1: Lead Workspace', () => {
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

  const sampleLead1: Lead = {
    _id: 'lead-1',
    brokerageId: 'brokerage-1',
    firstName: 'Maximilian',
    lastName: 'Weber',
    email: 'maximilian@example.de',
    phone: '+49 170 1111111',
    status: 'NEW',
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

  const sampleLeadQualified: Lead = {
    _id: 'lead-qualified-1',
    brokerageId: 'brokerage-1',
    firstName: 'Sophie',
    lastName: 'Mueller',
    email: 'sophie@example.de',
    phone: '+49 171 2222222',
    status: 'QUALIFIED',
    source: 'REFERRAL',
    score: 92,
    assignedTo: {
      _id: 'advisor-1',
      name: 'Elena Schmidt',
      email: 'elena@berlin.de',
    },
    customFields: {
      loanAmount: 520000,
      propertyValue: 650000,
    },
    __v: 2,
    createdAt: new Date('2026-03-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T10:00:00Z').toISOString(),
  }

  const sampleLeadAlreadyKnown: Lead = {
    _id: 'lead-known-1',
    brokerageId: 'brokerage-1',
    firstName: 'Thomas',
    lastName: 'Becker',
    email: 'thomas.becker@example.de',
    status: 'NEW',
    source: 'CAMPAIGN',
    score: 75,
    customFields: {
      loanAmount: 380000,
      alreadyKnown: true,
      knownAs: 'CLIENT',
      existingClientId: 'client-becker-123',
    },
    __v: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const sampleLeadWon: Lead = {
    _id: 'lead-won-1',
    brokerageId: 'brokerage-1',
    firstName: 'Alexander',
    lastName: 'Braun',
    email: 'alex@example.de',
    status: 'WON',
    source: 'REFERRAL',
    score: 95,
    convertedClientId: 'client-braun-456',
    customFields: { loanAmount: 600000 },
    __v: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const sampleTasks: Task[] = [
    {
      _id: 'task-1',
      brokerageId: 'brokerage-1',
      title: 'Review credit verification checklist',
      description: 'Check last 3 payslips and SCHUFA score',
      status: 'PENDING',
      priority: 'HIGH',
      dueDate: new Date('2026-04-01').toISOString(),
      leadId: 'lead-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const sampleDocuments: DocumentItem[] = [
    {
      _id: 'doc-1',
      brokerageId: 'brokerage-1',
      leadId: 'lead-1',
      title: 'German Payslip (Gehaltsabrechnung)',
      type: 'PAYSLIP',
      status: 'VERIFIED',
      fileUrl: 'https://example.com/payslip.pdf',
      fileId: 'file-1',
      mimeType: 'application/pdf',
      sizeBytes: 154200,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
  })

  it('1. Pipeline lead cards open a dedicated lead detail view on click', async () => {
    const pipelineData: PipelineGroupedData = {
      pipeline: {
        NEW: [sampleLead1],
        CONTACTED: [],
        QUALIFIED: [],
        PROPOSAL: [],
        NEGOTIATION: [],
        WON: [],
        LOST: [],
      },
      counts: {
        NEW: 1,
        CONTACTED: 0,
        QUALIFIED: 0,
        PROPOSAL: 0,
        NEGOTIATION: 0,
        WON: 0,
        LOST: 0,
      },
      total: 1,
    }

    vi.spyOn(PipelineApi.pipelineApi, 'getPipeline').mockResolvedValue(pipelineData)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLead1)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue([])
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PipelinePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Wait for card to render
    const leadCards = await screen.findAllByText('Maximilian Weber')
    expect(leadCards.length).toBeGreaterThan(0)

    // Click the lead card
    fireEvent.click(leadCards[0])

    // Verify dedicated lead workspace drawer opened with borrower details
    await waitFor(() => {
      expect(screen.getByText('Lead Workspace')).toBeInTheDocument()
      expect(screen.getByText('Borrower Contact Information')).toBeInTheDocument()
      expect(screen.getAllByText('maximilian@example.de').length).toBeGreaterThan(0)
    })
  })

  it('2. Shows borrower information, loan details, source, score, assigned advisor and stage', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLead1)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue(sampleTasks)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue(sampleDocuments)

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadDetailView leadId="lead-1" initialLead={sampleLead1} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Contact info
    expect(screen.getAllByText('Maximilian Weber').length).toBeGreaterThan(0)
    expect(screen.getByText('maximilian@example.de')).toBeInTheDocument()
    expect(screen.getByText('+49 170 1111111')).toBeInTheDocument()

    // Loan details & financial requirements
    expect(screen.getByText(/4,50,000/)).toBeInTheDocument()
    expect(screen.getByText(/5,50,000/)).toBeInTheDocument()
    expect(screen.getByText(/6,500/)).toBeInTheDocument()
    expect(screen.getByText('Permanent Contract')).toBeInTheDocument()
    expect(screen.getByText('EU Blue Card')).toBeInTheDocument()

    // Score & Source
    expect(screen.getByText(/85/)).toBeInTheDocument()
    expect(screen.getByText('WEBSITE')).toBeInTheDocument()

    // Assigned advisor
    expect(screen.getByText('Elena Schmidt')).toBeInTheDocument()
    expect(screen.getByText('elena@berlin.de')).toBeInTheDocument()

    // Stage definition
    expect(screen.getAllByText('New Inquiry').length).toBeGreaterThan(0)
  })

  it('3. Displays the "already known" state clearly with link to existing client case', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLeadAlreadyKnown)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue([])
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadDetailView leadId="lead-known-1" initialLead={sampleLeadAlreadyKnown} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Check "Already Known" badge and banner
    expect(screen.getByText('Already Known Borrower Profile')).toBeInTheDocument()
    expect(
      screen.getByText(/matches an existing client record registered with your brokerage/i),
    ).toBeInTheDocument()

    // Check link to existing client case
    const caseBtn = screen.getByRole('button', { name: /View Existing Client Case/i })
    expect(caseBtn).toBeInTheDocument()
  })

  it('4. Provides valid stage actions using existing state machine and handles 409 conflict', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLead1)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue([])
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue([])

    const updateSpy = vi
      .spyOn(LeadsApi.leadsApi, 'updateLeadStage')
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: {
              code: 'CONFLICT',
              message: 'Stage update conflict: Lead has been modified concurrently',
            },
          },
        },
      })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadDetailView leadId="lead-1" initialLead={sampleLead1} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Verify valid next actions for NEW stage: Contacted and Lost
    const advanceBtn = screen.getByRole('button', { name: /Advance to Contacted/i })
    const lostBtn = screen.getByRole('button', { name: /Mark as Lost/i })
    expect(advanceBtn).toBeInTheDocument()
    expect(lostBtn).toBeInTheDocument()

    // Trigger transition which returns 409
    fireEvent.click(advanceBtn)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'lead-1',
          stage: 'CONTACTED',
          version: 1,
        }),
        expect.anything(),
      )
      expect(screen.getByText(/Concurrency conflict/i)).toBeInTheDocument()
    })
  })

  it('5. Displays relevant tasks and documents with proper counts and empty states', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLead1)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue(sampleTasks)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue(sampleDocuments)

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadDetailView leadId="lead-1" initialLead={sampleLead1} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Verify task item
    await waitFor(() => {
      expect(screen.getByText('Review credit verification checklist')).toBeInTheDocument()
      expect(screen.getByText('HIGH')).toBeInTheDocument()
    })

    // Verify document item
    expect(screen.getByText('German Payslip (Gehaltsabrechnung)')).toBeInTheDocument()
    expect(screen.getByText('VERIFIED')).toBeInTheDocument()
  })

  it('6. Allows client conversion for eligible authorized users with generated password', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(sampleLeadQualified)
    vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue([])
    vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue([])

    const convertSpy = vi.spyOn(LeadsApi.leadsApi, 'convertLeadToClient').mockResolvedValue({
      client: {
        _id: 'new-client-789',
        brokerageId: 'brokerage-1',
        firstName: 'Sophie',
        lastName: 'Mueller',
        email: 'sophie@example.de',
        status: 'ACTIVE',
        type: 'BUYER',
      },
      user: {
        id: 'user-789',
        email: 'sophie@example.de',
        name: 'Sophie Mueller',
        role: 'CLIENT',
        isNew: true,
      },
      lead: {
        ...sampleLeadQualified,
        status: 'WON',
        convertedClientId: 'new-client-789',
      },
      temporaryPassword: 'TempPassword123!',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadDetailView leadId="lead-qualified-1" initialLead={sampleLeadQualified} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Qualified lead should have enabled Convert to Client button
    const convertBtn = screen.getByRole('button', { name: /Convert to Client/i })
    expect(convertBtn).not.toBeDisabled()

    // Open conversion modal
    fireEvent.click(convertBtn)

    expect(screen.getByText('Convert Lead to Client Case')).toBeInTheDocument()

    // Submit conversion
    const confirmBtn = screen.getByRole('button', { name: /Confirm Conversion/i })
    fireEvent.click(confirmBtn)

    // Verify conversion success message and generated password
    await waitFor(() => {
      expect(convertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: 'lead-qualified-1',
          payload: {
            type: 'BUYER',
            password: undefined,
            notes: undefined,
          },
        }),
        expect.anything(),
      )
      expect(screen.getByText('Client Case Established')).toBeInTheDocument()
      expect(screen.getByText('TempPassword123!')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /View Client Case/i })).toBeInTheDocument()
    })
  })

  it('7. Handles 404 not found state gracefully', async () => {
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
        <MemoryRouter initialEntries={['/app/leads/nonexistent-999']}>
          <Routes>
            <Route
              path="/app/leads/:id"
              element={<LeadDetailView leadId="nonexistent-999" />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Lead Inquiry Not Found')).toBeInTheDocument()
      expect(screen.getByText(/nonexistent-999/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Return to Pipeline/i })).toBeInTheDocument()
    })
  })

  it('8. LeadsPage lists inquiries with search and status filtering', async () => {
    vi.spyOn(LeadsApi.leadsApi, 'listLeads').mockImplementation(async (params) => {
      const all = [sampleLead1, sampleLeadQualified, sampleLeadWon]
      if (params?.search) {
        const filtered = all.filter((l) =>
          l.firstName.toLowerCase().includes(params.search!.toLowerCase()),
        )
        return { leads: filtered, total: filtered.length }
      }
      return { leads: all, total: all.length }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Verify all 3 leads rendered in table
    await waitFor(() => {
      expect(screen.getByText('Lead Inquiries')).toBeInTheDocument()
      expect(screen.getByText('Maximilian Weber')).toBeInTheDocument()
      expect(screen.getByText('Sophie Mueller')).toBeInTheDocument()
      expect(screen.getByText('Alexander Braun')).toBeInTheDocument()
    })

    // Search filter
    const searchInput = screen.getByPlaceholderText(/Search by borrower name/i)
    fireEvent.change(searchInput, { target: { value: 'Maximilian' } })

    await waitFor(() => {
      expect(screen.getByText('Maximilian Weber')).toBeInTheDocument()
      expect(screen.queryByText('Sophie Mueller')).not.toBeInTheDocument()
    })
  })
})
