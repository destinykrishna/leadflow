import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PipelinePage } from '@/features/pipeline/PipelinePage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import * as PipelineApi from '@/features/pipeline/api/pipeline.api'
import * as ClientsApi from '@/features/clients/api/clients.api'
import * as TasksApi from '@/features/tasks/api/tasks.api'
import * as AuthHook from '@/hooks/useAuth'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'
import type { PipelineGroupedData } from '@/types/pipeline.types'

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

describe('Phase 2 — Prompt 3: Dashboard & Pipeline Final Polish', () => {
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
          customFields: { loanAmount: 600000 },
          createdAt: '2026-09-20T10:00:00.000Z',
          updatedAt: '2026-09-20T10:00:00.000Z',
        },
        {
          _id: 'lead-1b',
          brokerageId: 'brokerage-1',
          firstName: 'Jonas',
          lastName: 'Wagner',
          email: 'jonas@example.de',
          status: 'NEW',
          source: 'REFERRAL',
          score: 45,
          customFields: { loanAmount: 200000 },
          createdAt: '2026-09-22T10:00:00.000Z',
          updatedAt: '2026-09-22T10:00:00.000Z',
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
          customFields: { loanAmount: 350000 },
          createdAt: '2026-09-21T10:00:00.000Z',
          updatedAt: '2026-09-21T10:00:00.000Z',
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
          score: 95,
          customFields: { loanAmount: 750000 },
          createdAt: '2026-09-19T10:00:00.000Z',
          updatedAt: '2026-09-19T10:00:00.000Z',
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
          score: 90,
          customFields: { loanAmount: 500000 },
          createdAt: '2026-09-18T10:00:00.000Z',
          updatedAt: '2026-09-18T10:00:00.000Z',
        },
      ],
      LOST: [],
    },
    counts: {
      NEW: 2,
      CONTACTED: 1,
      QUALIFIED: 1,
      PROPOSAL: 0,
      NEGOTIATION: 0,
      WON: 1,
      LOST: 0,
    },
    total: 5,
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
  })

  describe('Polished Pipeline Filtering & Sorting', () => {
    it('filters pipeline leads by lead source', async () => {
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
        expect(screen.getByText('Jonas Wagner')).toBeInTheDocument()
      })

      // Select "Referral" filter
      const sourceSelect = screen.getByDisplayValue('All Sources')
      fireEvent.change(sourceSelect, { target: { value: 'REFERRAL' } })

      // Jonas Wagner and Sophie Mueller (REFERRAL) remain; Maximilian Weber (WEBSITE) is filtered out
      expect(screen.getByText('Jonas Wagner')).toBeInTheDocument()
      expect(screen.getByText('Sophie Mueller')).toBeInTheDocument()
      expect(screen.queryByText('Maximilian Weber')).not.toBeInTheDocument()
    })

    it('filters pipeline leads by minimum loan volume threshold (e.g. >= ₹5,00,000 Jumbo loans)', async () => {
      vi.spyOn(PipelineApi.pipelineApi, 'getPipeline').mockResolvedValue(samplePipelineData)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <PipelinePage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Jonas Wagner')).toBeInTheDocument() // 200k
        expect(screen.getByText('Maximilian Weber')).toBeInTheDocument() // 600k
      })

      // Select ">= ₹5,00,000"
      const loanSelect = screen.getByDisplayValue('All Loan Sizes')
      fireEvent.change(loanSelect, { target: { value: '500000' } })

      // Maximilian (600k) and Alexander (750k) remain; Jonas (200k) and Sophie (350k) are filtered out
      expect(screen.getByText('Maximilian Weber')).toBeInTheDocument()
      expect(screen.queryByText('Jonas Wagner')).not.toBeInTheDocument()
      expect(screen.queryByText('Sophie Mueller')).not.toBeInTheDocument()
    })

    it('resets all active filters when Reset button is clicked', async () => {
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
      })

      // Apply source filter
      const sourceSelect = screen.getByDisplayValue('All Sources')
      fireEvent.change(sourceSelect, { target: { value: 'WEBSITE' } })

      expect(screen.queryByText('Sophie Mueller')).not.toBeInTheDocument()

      // Click Reset button
      const resetBtn = screen.getByRole('button', { name: /reset/i })
      fireEvent.click(resetBtn)

      // All leads should be visible again
      expect(screen.getByText('Sophie Mueller')).toBeInTheDocument()
      expect(screen.getByText('Maximilian Weber')).toBeInTheDocument()
    })

    it('scrolls to column when stage quick-jump button is clicked', async () => {
      vi.spyOn(PipelineApi.pipelineApi, 'getPipeline').mockResolvedValue(samplePipelineData)
      const scrollIntoViewMock = vi.fn()
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
      window.Element.prototype.scrollIntoView = scrollIntoViewMock

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <PipelinePage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Maximilian Weber')).toBeInTheDocument()
      })

      // Target the Qualified quick jump button specifically
      const qualifiedButtons = screen.getAllByRole('button').filter(
        (btn) => btn.tagName.toLowerCase() === 'button' && btn.textContent?.includes('Qualified'),
      )
      expect(qualifiedButtons.length).toBeGreaterThanOrEqual(1)

      const targetCol = document.getElementById('stage-column-QUALIFIED')
      expect(targetCol).not.toBeNull()
      targetCol!.scrollIntoView = scrollIntoViewMock

      fireEvent.click(qualifiedButtons[0])
      expect(scrollIntoViewMock).toHaveBeenCalled()
    })
  })

  describe('Polished Operations Dashboard Metrics & Visuals', () => {
    it('displays active pipeline volume alongside lead counts', async () => {
      vi.spyOn(PipelineApi.pipelineApi, 'getPipeline').mockResolvedValue(samplePipelineData)
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
        expect(screen.getByText('Operations Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Total Leads')).toBeInTheDocument()
        expect(screen.getByText('Active Pipeline')).toBeInTheDocument()
      })

      // Active volume across NEW (800k) + CONTACTED (350k) + QUALIFIED (750k) = ₹19,00,000
      expect(screen.getAllByText(/19,00,000/i).length).toBeGreaterThanOrEqual(1)

      // Total pipeline volume across all leads = ₹24,00,000
      expect(screen.getAllByText(/24,00,000/i).length).toBeGreaterThanOrEqual(1)
    })
  })
})
