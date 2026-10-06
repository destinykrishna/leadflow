import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { Kanban, AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import {
  ORDERED_STAGES,
  STAGE_DEFINITIONS,
  VALID_STAGE_TRANSITIONS,
  isValidStageTransition,
  type Lead,
  type LeadStatus,
  type PipelineGroupedData,
} from '@/types/pipeline.types'
import {
  usePipeline,
  useUpdateLeadStage,
  PIPELINE_QUERY_KEY,
} from './api/pipeline.api'
import { leadsApi } from '@/features/leads/api/leads.api'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '@/lib/motion'
import { usePipelineSocket } from './hooks/usePipelineSocket'
import { PipelineHeader } from './components/PipelineHeader'
import { DroppableColumn } from './components/DroppableColumn'
import { LeadCard } from './components/LeadCard'
import { LeadDetailDrawer } from '@/features/leads/components/LeadDetailDrawer'

export interface FeedbackNotice {
  type: 'info' | 'error' | 'warning' | 'success'
  text: string
}

export function PipelinePage() {
  const [search, setSearch] = React.useState('')
  const [sourceFilter, setSourceFilter] = React.useState('')
  const [minLoanFilter, setMinLoanFilter] = React.useState(0)
  const [sortBy, setSortBy] = React.useState('default')
  const [activeLead, setActiveLead] = React.useState<Lead | null>(null)
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<FeedbackNotice | null>(null)
  const [loadingStage, setLoadingStage] = React.useState<LeadStatus | null>(null)

  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, refetch } = usePipeline()
  const updateStageMutation = useUpdateLeadStage()

  // Connect Socket.IO for real-time remote stage updates
  const { highlightedLeadId } = usePipelineSocket(true)

  // Configure drag sensors with activation threshold so clicks don't conflict with dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor),
  )

  // Auto-dismiss feedback message after 4.5s
  React.useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4500)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  const isFiltered = Boolean(
    search.trim() || sourceFilter || minLoanFilter > 0 || sortBy !== 'default',
  )

  const handleClearFilters = React.useCallback(() => {
    setSearch('')
    setSourceFilter('')
    setMinLoanFilter(0)
    setSortBy('default')
  }, [])

  const handleJumpToStage = React.useCallback((stage: LeadStatus) => {
    const el = document.getElementById(`stage-column-${stage}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [])

  const handleLoadMore = React.useCallback(
    async (stage: LeadStatus) => {
      if (loadingStage) return
      setLoadingStage(stage)
      try {
        const currentStageLeads = data?.pipeline?.[stage] || []
        const currentCount = currentStageLeads.length
        const page = Math.floor(currentCount / 25) + 1
        const res = await leadsApi.listLeads({
          stage,
          page,
          limit: 25,
          search: search.trim() || undefined,
        })

        queryClient.setQueriesData<PipelineGroupedData>(
          { queryKey: PIPELINE_QUERY_KEY },
          (old) => {
            if (!old) return old
            const existing = old.pipeline[stage] || []
            const newLeads = res.leads.filter(
              (nl) => !existing.some((el) => el._id === nl._id),
            )
            const combined = [...existing, ...newLeads]
            const totalStageCount = old.counts[stage] ?? combined.length
            return {
              ...old,
              pipeline: {
                ...old.pipeline,
                [stage]: combined,
              },
              hasMore: {
                ...old.hasMore,
                [stage]: combined.length < totalStageCount,
              },
            }
          },
        )
      } catch {
        setFeedback({
          type: 'error',
          text: `Failed to load more leads for stage ${STAGE_DEFINITIONS[stage]?.label || stage}.`,
        })
      } finally {
        setLoadingStage(null)
      }
    },
    [data, loadingStage, queryClient, search],
  )

  // Filter and sort leads across all 7 stages
  const filteredPipeline = React.useMemo(() => {
    if (!data?.pipeline) return null
    const q = search.trim().toLowerCase()

    const result: Record<LeadStatus, Lead[]> = {
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      WON: [],
      LOST: [],
    }

    ORDERED_STAGES.forEach((stage) => {
      let list = (data.pipeline[stage] || []).filter((lead: Lead) => {
        // Search filter
        if (q) {
          const matchesSearch =
            lead.firstName.toLowerCase().includes(q) ||
            (lead.lastName || '').toLowerCase().includes(q) ||
            lead.email.toLowerCase().includes(q) ||
            (lead.phone && lead.phone.includes(q)) ||
            (lead.source && lead.source.toLowerCase().includes(q))
          if (!matchesSearch) return false
        }

        // Source filter
        if (sourceFilter && lead.source !== sourceFilter) {
          return false
        }

        // Min loan volume filter
        if (minLoanFilter > 0) {
          const loan = Number(lead.customFields?.loanAmount) || 0
          if (loan < minLoanFilter) return false
        }

        return true
      })

      // Sorting
      if (sortBy === 'loan-desc') {
        list = [...list].sort(
          (a, b) =>
            (Number(b.customFields?.loanAmount) || 0) - (Number(a.customFields?.loanAmount) || 0),
        )
      } else if (sortBy === 'score-desc') {
        list = [...list].sort((a, b) => b.score - a.score)
      } else if (sortBy === 'oldest') {
        list = [...list].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
      }

      result[stage] = list
    })

    return result
  }, [data, search, sourceFilter, minLoanFilter, sortBy])

  // Calculate total volume across filtered leads
  const totalVolume = React.useMemo(() => {
    if (!filteredPipeline) return 0
    let sum = 0
    Object.values(filteredPipeline).forEach((stageLeads) => {
      stageLeads.forEach((lead) => {
        sum += Number(lead.customFields?.loanAmount) || 0
      })
    })
    return sum
  }, [filteredPipeline])

  // Calculate current stage counts for quick-jump strip
  const stageCounts = React.useMemo(() => {
    const counts: Record<LeadStatus, number> = {
      NEW: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      PROPOSAL: 0,
      NEGOTIATION: 0,
      WON: 0,
      LOST: 0,
    }
    if (filteredPipeline) {
      ORDERED_STAGES.forEach((stage) => {
        counts[stage] = filteredPipeline[stage]?.length ?? 0
      })
    }
    return counts
  }, [filteredPipeline])

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const lead = event.active.data.current?.lead as Lead | undefined
    if (lead) {
      setActiveLead(lead)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveLead(null)

    if (!over) return

    const targetStage = over.id as LeadStatus
    const lead = active.data.current?.lead as Lead | undefined

    if (!lead || lead.status === targetStage) return

    // 1. Client-Side Transition Validation
    if (!isValidStageTransition(lead.status, targetStage)) {
      const allowed = VALID_STAGE_TRANSITIONS[lead.status]
      const allowedLabels =
        allowed.length > 0
          ? allowed.map((s) => STAGE_DEFINITIONS[s].label).join(' or ')
          : 'None (terminal stage)'

      setFeedback({
        type: 'warning',
        text: `Cannot move lead from ${STAGE_DEFINITIONS[lead.status].label} to ${STAGE_DEFINITIONS[targetStage].label}. Allowed next stages: ${allowedLabels}.`,
      })
      return
    }

    // 2. Optimistic Movement with Rollback Snapshot
    const previousSnapshot = queryClient.getQueryData<PipelineGroupedData>(PIPELINE_QUERY_KEY)
    const sourceStage = lead.status

    // Optimistically update TanStack Query cache
    queryClient.setQueriesData<PipelineGroupedData>(
      { queryKey: PIPELINE_QUERY_KEY },
      (old) => {
        if (!old || !old.pipeline) return old

        const updatedPipeline = { ...old.pipeline }
        const updatedCounts = { ...old.counts }

        // Remove from source stage
        updatedPipeline[sourceStage] = (updatedPipeline[sourceStage] || []).filter(
          (l) => l._id !== lead._id,
        )
        if (updatedCounts[sourceStage] !== undefined && updatedCounts[sourceStage] > 0) {
          updatedCounts[sourceStage]--
        }

        // Add to target stage with incremented version
        const movedLead: Lead = {
          ...lead,
          status: targetStage,
          __v: (lead.__v ?? 0) + 1,
          updatedAt: new Date().toISOString(),
        }

        updatedPipeline[targetStage] = [
          ...(updatedPipeline[targetStage] || []).filter((l) => l._id !== lead._id),
          movedLead,
        ]
        updatedCounts[targetStage] = (updatedCounts[targetStage] || 0) + 1

        return {
          ...old,
          pipeline: updatedPipeline,
          counts: updatedCounts,
        }
      },
    )

    // 3. Call stage mutation API
    try {
      await updateStageMutation.mutateAsync({
        id: lead._id,
        stage: targetStage,
        version: lead.__v,
      })

      setFeedback({
        type: 'success',
        text: `Successfully moved ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')} to ${STAGE_DEFINITIONS[targetStage].label}.`,
      })
    } catch (err: unknown) {
      // 4. Rollback to snapshot on failure
      if (previousSnapshot) {
        queryClient.setQueryData(PIPELINE_QUERY_KEY, previousSnapshot)
      }

      // Concurrency conflict (HTTP 409) handling
      const is409Conflict =
        err !== null &&
        typeof err === 'object' &&
        'response' in err &&
        Boolean((err as { response?: { status?: number } }).response?.status === 409)

      if (is409Conflict) {
        setFeedback({
          type: 'error',
          text: `Stage update conflict: ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')} was modified concurrently by another advisor. Refreshing board...`,
        })
        queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEY })
      } else {
        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Stage update failed. Reverting to previous stage.'

        setFeedback({
          type: 'error',
          text: errorMsg,
        })
      }
    }
  }

  if (isError) {
    return (
      <div className="py-8">
        <ErrorState
          title="Pipeline Board Unavailable"
          message={
            error instanceof Error
              ? error.message
              : 'Failed to retrieve live mortgage pipeline. Please verify network connectivity.'
          }
          onRetry={refetch}
        />
      </div>
    )
  }

  const totalFilteredLeads = filteredPipeline
    ? Object.values(filteredPipeline).reduce((acc, list) => acc + list.length, 0)
    : data?.total || 0

  const reducedMotion = usePrefersReducedMotion()
  const isDrawerOpen = Boolean(selectedLeadId)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative">
        <motion.div
          animate={{
            scale: !reducedMotion && isDrawerOpen ? 0.985 : 1,
            opacity: !reducedMotion && isDrawerOpen ? 0.94 : 1,
            filter: !reducedMotion && isDrawerOpen ? 'brightness(0.97)' : 'brightness(1)',
          }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: 'left center' }}
          className="flex h-[calc(100dvh-7.5rem)] flex-col space-y-3 transition-[filter]"
        >
          {/* Top Header */}
          <PipelineHeader
            totalLeads={totalFilteredLeads}
            totalVolume={totalVolume}
            search={search}
            onSearchChange={setSearch}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            minLoanFilter={minLoanFilter}
            onMinLoanFilterChange={setMinLoanFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            onClearFilters={handleClearFilters}
            isFiltered={isFiltered}
            stageCounts={stageCounts}
            onJumpToStage={handleJumpToStage}
            onRefresh={refetch}
            isLoading={isLoading}
          />

          {/* Feedback Alert Notice */}
          {feedback && (
            <div
              className={`flex items-center justify-between rounded-lg px-3.5 py-2 text-xs font-medium animate-in fade-in-50 duration-150 ${
                feedback.type === 'error'
                  ? 'border border-rose-200 bg-rose-50 text-rose-800'
                  : feedback.type === 'warning'
                  ? 'border border-amber-200 bg-amber-50 text-amber-800'
                  : feedback.type === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border border-blue-200 bg-blue-50 text-blue-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                ) : feedback.type === 'warning' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                ) : feedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-blue-600" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Main Kanban Columns */}
          {isLoading ? (
            <div className="flex flex-1 gap-3.5 overflow-x-auto pb-4 pt-1">
              {ORDERED_STAGES.map((stage) => {
                const stageDef = STAGE_DEFINITIONS[stage]
                return (
                  <div
                    key={stage}
                    className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border/80 bg-slate-100/70 p-2.5 space-y-2.5 shadow-2xs"
                  >
                    {/* Skeleton Column Header */}
                    <div className="flex items-center justify-between px-1.5 py-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-300 animate-pulse" />
                        <span className="text-xs font-bold text-slate-500">
                          {stageDef?.label || stage}
                        </span>
                        <Skeleton className="h-4.5 w-5 rounded-full" />
                      </div>
                      <Skeleton className="h-3.5 w-12 rounded" />
                    </div>

                    {/* Skeleton Cards */}
                    <div className="flex-1 space-y-2.5 overflow-hidden">
                      <div className="rounded-lg border border-border/70 bg-card p-3 space-y-2.5 shadow-2xs">
                        <div className="flex items-start justify-between">
                          <Skeleton className="h-4 w-28 rounded" />
                          <Skeleton className="h-4 w-12 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-20 rounded" />
                        <div className="space-y-1.5 pt-1">
                          <Skeleton className="h-2.5 w-full rounded" />
                          <Skeleton className="h-2.5 w-24 rounded" />
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-card p-3 space-y-2.5 shadow-2xs">
                        <div className="flex items-start justify-between">
                          <Skeleton className="h-4 w-24 rounded" />
                          <Skeleton className="h-4 w-12 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-16 rounded" />
                        <div className="space-y-1.5 pt-1">
                          <Skeleton className="h-2.5 w-full rounded" />
                          <Skeleton className="h-2.5 w-20 rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : data?.total === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={<Kanban className="h-8 w-8 text-slate-400" />}
                title="Pipeline Is Empty"
                description="No borrower inquiries have entered the qualification pipeline yet. Ingest leads via webhooks or create leads in the Leads section to begin."
              />
            </div>
          ) : isFiltered && totalFilteredLeads === 0 ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <EmptyState
                icon={<Kanban className="h-8 w-8 text-slate-400" />}
                title="No Matching Leads"
                description="No borrower inquiries match your active search or filter criteria. Try adjusting or resetting your filters."
                action={
                  <Button variant="outline" size="sm" onClick={handleClearFilters} className="text-xs">
                    Reset Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="flex flex-1 gap-3.5 overflow-x-auto pb-4 pt-1">
              {ORDERED_STAGES.map((stage) => (
                <DroppableColumn
                  key={stage}
                  stage={stage}
                  leads={filteredPipeline?.[stage] || []}
                  totalCount={data?.counts?.[stage]}
                  hasMore={Boolean(data?.hasMore?.[stage])}
                  isLoadingMore={loadingStage === stage}
                  onLoadMore={() => handleLoadMore(stage)}
                  activeLead={activeLead}
                  highlightedLeadId={highlightedLeadId}
                  onLeadClick={(lead) => setSelectedLeadId(lead._id)}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Drag Overlay rendered outside the scaled/transformed motion container */}
        <DragOverlay dropAnimation={null} zIndex={100}>
          {activeLead ? (
            <div className="w-68 rotate-1 scale-[1.02] shadow-xl border-primary/50 opacity-95 pointer-events-none">
              <LeadCard lead={activeLead} />
            </div>
          ) : null}
        </DragOverlay>

        {/* Slide-over Dedicated Lead Workspace Drawer outside the receding container */}
        <LeadDetailDrawer
          leadId={selectedLeadId}
          isOpen={isDrawerOpen}
          onClose={() => setSelectedLeadId(null)}
        />
      </div>
    </DndContext>
  )
}
