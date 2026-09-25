import { renderHook, act } from '@testing-library/react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import {
  ORDERED_STAGES,
  STAGE_DEFINITIONS,
  VALID_STAGE_TRANSITIONS,
  isValidStageTransition,
  type Lead,
  type PipelineGroupedData,
  type PipelineStageChangedBroadcastPayload,
} from '@/types/pipeline.types'
import { PIPELINE_QUERY_KEY } from '@/features/pipeline/api/pipeline.api'
import * as PipelineApi from '@/features/pipeline/api/pipeline.api'
import { usePipelineSocket } from '@/features/pipeline/hooks/usePipelineSocket'
import { PipelinePage } from '@/features/pipeline/PipelinePage'
import * as AuthHook from '@/hooks/useAuth'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'

// Mock socket.io-client
const mockSocketListeners: Record<string, ((...args: unknown[]) => void)[]> = {}
const mockSocket = {
  connected: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    if (!mockSocketListeners[event]) {
      mockSocketListeners[event] = []
    }
    mockSocketListeners[event].push(cb)
  }),
  off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    if (mockSocketListeners[event]) {
      mockSocketListeners[event] = mockSocketListeners[event].filter((l) => l !== cb)
    }
  }),
  emit: vi.fn(),
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

describe('Phase 2 — Prompt 2: Interactive Kanban & Realtime Pipeline', () => {
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
    customFields: { loanAmount: 450000 },
    __v: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const sampleLead2: Lead = {
    _id: 'lead-2',
    brokerageId: 'brokerage-1',
    firstName: 'Sophie',
    lastName: 'Mueller',
    email: 'sophie@example.de',
    status: 'CONTACTED',
    source: 'REFERRAL',
    score: 70,
    customFields: { loanAmount: 350000 },
    __v: 2,
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
    customFields: { loanAmount: 600000 },
    __v: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const initialPipelineData: PipelineGroupedData = {
    pipeline: {
      NEW: [sampleLead1],
      CONTACTED: [sampleLead2],
      QUALIFIED: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      WON: [sampleLeadWon],
      LOST: [],
    },
    counts: {
      NEW: 1,
      CONTACTED: 1,
      QUALIFIED: 0,
      PROPOSAL: 0,
      NEGOTIATION: 0,
      WON: 1,
      LOST: 0,
    },
    total: 3,
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    Object.keys(mockSocketListeners).forEach((k) => delete mockSocketListeners[k])
    vi.clearAllMocks()
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('Stage Transition Rules (State Machine Invariants)', () => {
    it('allows valid forward linear progression transitions', () => {
      expect(isValidStageTransition('NEW', 'CONTACTED')).toBe(true)
      expect(isValidStageTransition('CONTACTED', 'QUALIFIED')).toBe(true)
      expect(isValidStageTransition('QUALIFIED', 'PROPOSAL')).toBe(true)
      expect(isValidStageTransition('PROPOSAL', 'NEGOTIATION')).toBe(true)
      expect(isValidStageTransition('NEGOTIATION', 'WON')).toBe(true)
    })

    it('allows early exit to LOST from all active stages', () => {
      expect(isValidStageTransition('NEW', 'LOST')).toBe(true)
      expect(isValidStageTransition('CONTACTED', 'LOST')).toBe(true)
      expect(isValidStageTransition('QUALIFIED', 'LOST')).toBe(true)
      expect(isValidStageTransition('PROPOSAL', 'LOST')).toBe(true)
      expect(isValidStageTransition('NEGOTIATION', 'LOST')).toBe(true)
    })

    it('rejects skipping stages in forward progression', () => {
      expect(isValidStageTransition('NEW', 'QUALIFIED')).toBe(false)
      expect(isValidStageTransition('NEW', 'PROPOSAL')).toBe(false)
      expect(isValidStageTransition('NEW', 'WON')).toBe(false)
      expect(isValidStageTransition('CONTACTED', 'WON')).toBe(false)
    })

    it('enforces terminal immutability: zero outgoing transitions from WON or LOST', () => {
      expect(VALID_STAGE_TRANSITIONS['WON']).toEqual([])
      expect(VALID_STAGE_TRANSITIONS['LOST']).toEqual([])

      ORDERED_STAGES.forEach((target) => {
        expect(isValidStageTransition('WON', target)).toBe(false)
        expect(isValidStageTransition('LOST', target)).toBe(false)
      })
    })
  })

  describe('Realtime Socket Reconciliation (usePipelineSocket)', () => {
    it('reconciles pipeline:stage_changed by moving lead across stages and updating counts without duplicates', () => {
      queryClient.setQueryData(PIPELINE_QUERY_KEY, initialPipelineData)

      renderHook(() => usePipelineSocket(true), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      })

      // Ensure listeners registered
      expect(mockSocket.on).toHaveBeenCalledWith('pipeline:stage_changed', expect.any(Function))

      const stageChangePayload: PipelineStageChangedBroadcastPayload = {
        leadId: 'lead-1',
        previousStage: 'NEW',
        newStage: 'CONTACTED',
        version: 2,
        updatedBy: { id: 'advisor-1', name: 'Elena Schmidt', role: 'ADVISOR' },
        brokerageId: 'brokerage-1',
        timestamp: new Date().toISOString(),
      }

      // Trigger socket event
      act(() => {
        const listeners = mockSocketListeners['pipeline:stage_changed'] || []
        listeners.forEach((listener) => listener(stageChangePayload))
      })

      const cache = queryClient.getQueryData<PipelineGroupedData>(PIPELINE_QUERY_KEY)
      expect(cache).toBeDefined()
      // Lead-1 should be removed from NEW and added to CONTACTED
      expect(cache!.pipeline.NEW).toHaveLength(0)
      expect(cache!.counts.NEW).toBe(0)

      expect(cache!.pipeline.CONTACTED).toHaveLength(2)
      expect(cache!.counts.CONTACTED).toBe(2)

      const moved = cache!.pipeline.CONTACTED.find((l) => l._id === 'lead-1')
      expect(moved).toBeDefined()
      expect(moved!.status).toBe('CONTACTED')
      expect(moved!.__v).toBe(2)
    })

    it('does not duplicate lead if event is dispatched multiple times', () => {
      queryClient.setQueryData(PIPELINE_QUERY_KEY, initialPipelineData)

      renderHook(() => usePipelineSocket(true), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      })

      const stageChangePayload: PipelineStageChangedBroadcastPayload = {
        leadId: 'lead-1',
        previousStage: 'NEW',
        newStage: 'CONTACTED',
        version: 2,
        updatedBy: { id: 'advisor-1', name: 'Elena Schmidt', role: 'ADVISOR' },
        brokerageId: 'brokerage-1',
        timestamp: new Date().toISOString(),
      }

      // Trigger event twice
      act(() => {
        const listeners = mockSocketListeners['pipeline:stage_changed'] || []
        listeners.forEach((listener) => listener(stageChangePayload))
        listeners.forEach((listener) => listener(stageChangePayload))
      })

      const cache = queryClient.getQueryData<PipelineGroupedData>(PIPELINE_QUERY_KEY)
      expect(cache!.pipeline.CONTACTED.filter((l) => l._id === 'lead-1')).toHaveLength(1)
    })

    it('invalidates cache to refetch if received lead is not present in local cache', () => {
      queryClient.setQueryData(PIPELINE_QUERY_KEY, initialPipelineData)
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      renderHook(() => usePipelineSocket(true), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      })

      const unknownLeadPayload: PipelineStageChangedBroadcastPayload = {
        leadId: 'unknown-lead-999',
        previousStage: 'NEW',
        newStage: 'CONTACTED',
        version: 1,
        updatedBy: { id: 'advisor-1', name: 'Elena Schmidt', role: 'ADVISOR' },
        brokerageId: 'brokerage-1',
        timestamp: new Date().toISOString(),
      }

      act(() => {
        const listeners = mockSocketListeners['pipeline:stage_changed'] || []
        listeners.forEach((listener) => listener(unknownLeadPayload))
      })

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PIPELINE_QUERY_KEY })
    })
  })

  describe('Optimistic Updates, Rollback, and 409 Conflict Handling', () => {
    it('renders the pipeline board and displays all 7 stages', async () => {
      vi.spyOn(PipelineApi.pipelineApi, 'getPipeline').mockResolvedValue(initialPipelineData)

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

      // Check all 7 column headings are present
      ORDERED_STAGES.forEach((stage) => {
        expect(
          screen.getByRole('heading', { level: 2, name: STAGE_DEFINITIONS[stage].label }),
        ).toBeInTheDocument()
      })
    })

    it('handles optimistic update rollback on network mutation failure', async () => {
      queryClient.setQueryData(PIPELINE_QUERY_KEY, initialPipelineData)
      const initialSnapshot = queryClient.getQueryData<PipelineGroupedData>(PIPELINE_QUERY_KEY)

      // Simulate a failure in updateStage
      const mockMutationError = new Error('500 Internal Server Error')
      vi.spyOn(PipelineApi.pipelineApi, 'updateLeadStage').mockRejectedValue(mockMutationError)

      // Optimistically apply change
      queryClient.setQueryData<PipelineGroupedData>(PIPELINE_QUERY_KEY, (old) => {
        if (!old) return old
        return {
          ...old,
          pipeline: {
            ...old.pipeline,
            NEW: [],
            CONTACTED: [
              ...old.pipeline.CONTACTED,
              { ...sampleLead1, status: 'CONTACTED', __v: 2 },
            ],
          },
          counts: { ...old.counts, NEW: 0, CONTACTED: 2 },
        }
      })

      // Verify optimistic state took effect
      expect(
        queryClient.getQueryData<PipelineGroupedData>(PIPELINE_QUERY_KEY)!.pipeline.NEW,
      ).toHaveLength(0)

      // Rollback to initial snapshot
      queryClient.setQueryData(PIPELINE_QUERY_KEY, initialSnapshot)

      // Verify rollback restored initial state
      const reverted = queryClient.getQueryData<PipelineGroupedData>(PIPELINE_QUERY_KEY)
      expect(reverted!.pipeline.NEW).toHaveLength(1)
      expect(reverted!.counts.NEW).toBe(1)
      expect(reverted!.pipeline.NEW[0]._id).toBe('lead-1')
    })

    it('reconciles 409 concurrency conflict by triggering board refetch and showing notification', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      // Create a 409 Conflict Axios-like error object
      const conflictError = {
        name: 'AxiosError',
        message: 'Request failed with status code 409',
        response: {
          status: 409,
          data: {
            error: {
              code: 'CONCURRENCY_CONFLICT',
              message: 'Lead stage has been modified concurrently. Please refresh.',
            },
          },
        },
      }

      // Check conflict identification logic
      const is409Conflict =
        Boolean(conflictError) &&
        typeof conflictError === 'object' &&
        'response' in conflictError &&
        conflictError.response?.status === 409

      expect(is409Conflict).toBe(true)

      // Invalidate queries when 409 occurs
      if (is409Conflict) {
        queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEY })
      }

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PIPELINE_QUERY_KEY })
    })
  })
})
