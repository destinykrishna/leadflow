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
import { usePipelineSocket } from './hooks/usePipelineSocket'
import { PipelineHeader } from './components/PipelineHeader'
import { DroppableColumn } from './components/DroppableColumn'
import { LeadCard } from './components/LeadCard'

export interface FeedbackNotice {
  type: 'info' | 'error' | 'warning' | 'success'
  text: string
}

export function PipelinePage() {
  const [search, setSearch] = React.useState('')
  const [activeLead, setActiveLead] = React.useState<Lead | null>(null)
  const [feedback, setFeedback] = React.useState<FeedbackNotice | null>(null)

  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, refetch } = usePipeline()
  const updateStageMutation = useUpdateLeadStage()

  // Connect Socket.IO for real-time remote stage updates
  usePipelineSocket(true)

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

  // Calculate total volume across all leads
  const totalVolume = React.useMemo(() => {
    if (!data?.pipeline) return 0
    let sum = 0
    Object.values(data.pipeline).forEach((stageLeads) => {
      stageLeads.forEach((lead) => {
        sum += Number(lead.customFields?.loanAmount) || 0
      })
    })
    return sum
  }, [data])

  // Filter leads based on search query
  const filteredPipeline = React.useMemo(() => {
    if (!data?.pipeline) return null
    const q = search.trim().toLowerCase()
    if (!q) return data.pipeline

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
      result[stage] = (data.pipeline[stage] || []).filter(
        (lead: Lead) =>
          lead.firstName.toLowerCase().includes(q) ||
          lead.lastName.toLowerCase().includes(q) ||
          lead.email.toLowerCase().includes(q) ||
          (lead.phone && lead.phone.includes(q)) ||
          (lead.source && lead.source.toLowerCase().includes(q)),
      )
    })

    return result
  }, [data, search])

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
        text: `Successfully moved ${lead.firstName} ${lead.lastName} to ${STAGE_DEFINITIONS[targetStage].label}.`,
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
          text: `Stage update conflict: ${lead.firstName} ${lead.lastName} was modified concurrently by another advisor. Refreshing board...`,
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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[calc(100dvh-7.5rem)] flex-col space-y-3">
        {/* Top Header */}
        <PipelineHeader
          totalLeads={totalFilteredLeads}
          totalVolume={totalVolume}
          search={search}
          onSearchChange={setSearch}
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
            {ORDERED_STAGES.map((stage) => (
              <div
                key={stage}
                className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border/70 bg-slate-100/40 p-3 space-y-3"
              >
                <div className="flex items-center justify-between pb-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-6 rounded-full" />
                </div>
                <Skeleton className="h-28 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : data?.total === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<Kanban className="h-8 w-8 text-slate-400" />}
              title="Pipeline Is Empty"
              description="No borrower inquiries have entered the qualification pipeline yet. Ingest leads via webhooks or create leads in the Leads section to begin."
            />
          </div>
        ) : (
          <div className="flex flex-1 gap-3.5 overflow-x-auto pb-4 pt-1">
            {ORDERED_STAGES.map((stage) => (
              <DroppableColumn
                key={stage}
                stage={stage}
                leads={filteredPipeline?.[stage] || []}
                activeLead={activeLead}
              />
            ))}
          </div>
        )}

        {/* Restrained Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-68 rotate-1 scale-[1.02] shadow-xl border-primary/50 opacity-95">
              <LeadCard lead={activeLead} />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
