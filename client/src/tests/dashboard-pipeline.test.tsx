import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PipelinePage } from '@/features/pipeline/PipelinePage'
import * as PipelineApi from '@/features/pipeline/api/pipeline.api'
import * as ClientsApi from '@/features/clients/api/clients.api'
import * as TasksApi from '@/features/tasks/api/tasks.api'
import * as AuthHook from '@/hooks/useAuth'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'
import type { PipelineGroupedData } from '@/types/pipeline.types'

describe('Phase 2 — Dashboard & Pipeline Foundation', () => {
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

  const samplePipelineData: PipelineGroupedData = {
    pipeline: {
      NEW: [
        {
          _id: 'lead-1',
          brokerageId: 'brokerage-1',
          firstName: 'Maximilian',
          lastName: 'Weber',
          email: 'maximilian@example.de',
          phone: '+49 170 1111111',
          status: 'NEW',
          source: 'WEBSITE',
          score: 85,
          customFields: { loanAmount: 420000 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      CONTACTED: [
        {
          _id: 'lead-2',
          brokerageId: 'brokerage-1',
          firstName: 'Sophie',
          lastName: 'Mueller',
          email: 'sophie@example.de',
          status: 'CONTACTED',
          source: 'REFERRAL',
          score: 65,
          customFields: { loanAmount: 510000 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      QUALIFIED: [
        {
          _id: 'lead-3',
          brokerageId: 'brokerage-1',
          firstName: 'Alexander',
          lastName: 'Braun',
          email: 'alex.braun@example.de',
          status: 'QUALIFIED',
          source: 'ZILLOW',
          score: 90,
          customFields: { loanAmount: 650000 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      PROPOSAL: [],
      NEGOTIATION: [],
      WON: [
        {
          _id: 'lead-4',
          brokerageId: 'brokerage-1',
          firstName: 'Hannah',
          lastName: 'Fischer',
          email: 'hannah@example.de',
          status: 'WON',
          source: 'CAMPAIGN',
          score: 95,
          customFields: { loanAmount: 380000 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      LOST: [],
    },
    counts: {
      NEW: 1,
      CONTACTED: 1,
      QUALIFIED: 1,
      PROPOSAL: 0,
      NEGOTIATION: 0,
      WON: 1,
      LOST: 0,
    },
    total: 4,
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
  })

  describe('Operations Dashboard', () => {
    it('renders real KPI metrics, stage distribution, and recent activity', async () => {
      vi.spyOn(PipelineApi.pipelineApi, 'getPipeline').mockResolvedValue(samplePipelineData)
      vi.spyOn(ClientsApi.clientsApi, 'getClients').mockResolvedValue([
        {
          _id: 'client-1',
          brokerageId: 'brokerage-1',
          firstName: 'Hannah',
          lastName: 'Fischer',
          email: 'hannah@example.de',
          status: 'ACTIVE',
          type: 'BUYER',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: [
          {
            _id: 'task-1',
            brokerageId: 'brokerage-1',
            title: 'Verify payslips for Maximilian Weber',
            status: 'PENDING',
            priority: 'HIGH',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      // Verify Header
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument()

      // Verify KPIs
      await waitFor(() => {
        expect(screen.getByText('Total Leads')).toBeInTheDocument()
        expect(screen.getByText('4')).toBeInTheDocument() // 4 total leads
        expect(screen.getByText('Active Pipeline')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument() // 3 in active pipeline (1 NEW + 1 CONTACTED + 1 QUALIFIED)
        expect(screen.getByText('Pre-Qualified')).toBeInTheDocument()
        expect(screen.getByText('Won Cases')).toBeInTheDocument()
        expect(screen.getByText('Active Clients')).toBeInTheDocument()
      })

      // Verify Distribution Section
      expect(screen.getByText('Pipeline Stage Distribution')).toBeInTheDocument()
      expect(screen.getByText('Total Pipeline:')).toBeInTheDocument()

      // Verify Recent Activity
      expect(screen.getByText('Recent Inquiries & Leads')).toBeInTheDocument()
      expect(screen.getByText('Maximilian Weber')).toBeInTheDocument()
      expect(screen.getByText('Sophie Mueller')).toBeInTheDocument()

      // Verify Tasks
      expect(screen.getByText('Operational Action Items')).toBeInTheDocument()
      expect(screen.getByText('Verify payslips for Maximilian Weber')).toBeInTheDocument()
    })

    it('renders error state on API failure and supports retry', async () => {
      vi.spyOn(PipelineApi.pipelineApi, 'getPipeline').mockRejectedValue(
        new Error('Network connection timeout'),
      )
      vi.spyOn(ClientsApi.clientsApi, 'getClients').mockResolvedValue([])
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({ tasks: [], total: 0 })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Operations Metrics Unavailable')).toBeInTheDocument()
        expect(screen.getByText('Network connection timeout')).toBeInTheDocument()
      })

      const retryBtn = screen.getByRole('button', { name: /try again/i })
      expect(retryBtn).toBeInTheDocument()
    })
  })

  describe('Pipeline Page & Kanban Foundation', () => {
    it('renders 7 stage columns with real lead counts and loan values', async () => {
      vi.spyOn(PipelineApi.pipelineApi, 'getPipeline').mockResolvedValue(samplePipelineData)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <PipelinePage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      expect(screen.getByText('Pipeline Board')).toBeInTheDocument()

      await waitFor(() => {
        // Verify stage column headings
        expect(screen.getByText('New Inquiry')).toBeInTheDocument()
        expect(screen.getByText('Contacted')).toBeInTheDocument()
        expect(screen.getByText('Qualified')).toBeInTheDocument()
        expect(screen.getByText('Proposal')).toBeInTheDocument()
        expect(screen.getByText('Negotiation')).toBeInTheDocument()
        expect(screen.getByText('Won / Converted')).toBeInTheDocument()
        expect(screen.getByText('Lost')).toBeInTheDocument()

        // Verify lead cards inside columns
        expect(screen.getByText('Maximilian Weber')).toBeInTheDocument()
        expect(screen.getByText('Sophie Mueller')).toBeInTheDocument()
        expect(screen.getByText('Alexander Braun')).toBeInTheDocument()
        expect(screen.getByText('Hannah Fischer')).toBeInTheDocument()
      })
    })

    it('filters lead cards in real-time when search query is entered', async () => {
      vi.spyOn(PipelineApi.pipelineApi, 'getPipeline').mockResolvedValue(samplePipelineData)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <PipelinePage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Maximilian Weber')).toBeInTheDocument()
        expect(screen.getByText('Sophie Mueller')).toBeInTheDocument()
      })

      // Search for "Sophie"
      const searchInput = screen.getByPlaceholderText('Search borrower or email...')
      fireEvent.change(searchInput, { target: { value: 'Sophie' } })

      // Sophie should remain; Maximilian should be filtered out
      expect(screen.getByText('Sophie Mueller')).toBeInTheDocument()
      expect(screen.queryByText('Maximilian Weber')).not.toBeInTheDocument()
    })
  })
})
