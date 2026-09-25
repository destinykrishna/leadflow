import { useDroppable } from '@dnd-kit/core'
import { Ban, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import {
  STAGE_DEFINITIONS,
  isValidStageTransition,
  type Lead,
  type LeadStatus,
} from '@/types/pipeline.types'
import { DraggableLeadCard } from './DraggableLeadCard'

interface DroppableColumnProps {
  stage: LeadStatus
  leads: Lead[]
  activeLead: Lead | null
  onLeadClick?: (lead: Lead) => void
}

const STAGE_DOT_COLORS: Record<LeadStatus, string> = {
  NEW: 'bg-slate-400',
  CONTACTED: 'bg-blue-400',
  QUALIFIED: 'bg-blue-600',
  PROPOSAL: 'bg-amber-400',
  NEGOTIATION: 'bg-indigo-500',
  WON: 'bg-emerald-500',
  LOST: 'bg-rose-400',
}

export function DroppableColumn({
  stage,
  leads,
  activeLead,
  onLeadClick,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: { stage },
  })

  const stageDef = STAGE_DEFINITIONS[stage]
  const totalVolume = leads.reduce(
    (sum, l) => sum + (Number(l.customFields?.loanAmount) || 0),
    0,
  )

  // Transition validation when a card is actively dragged
  const isDragging = Boolean(activeLead)
  const isSameStage = activeLead?.status === stage
  const isValidDrop = isDragging && !isSameStage && isValidStageTransition(activeLead!.status, stage)
  const isInvalidDrop = isDragging && !isSameStage && !isValidStageTransition(activeLead!.status, stage)

  // Styling based on drag state
  let columnStyle = 'border-border/70 bg-slate-100/60'
  if (isDragging) {
    if (isValidDrop) {
      columnStyle = isOver
        ? 'ring-2 ring-primary/40 border-primary bg-primary/5 shadow-xs'
        : 'border-dashed border-primary/40 bg-blue-50/20'
    } else if (isInvalidDrop && isOver) {
      columnStyle = 'ring-2 ring-rose-400 border-rose-400 bg-rose-50/40 cursor-not-allowed'
    } else if (!isSameStage) {
      columnStyle = 'border-border/50 bg-slate-100/30 opacity-75'
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-72 shrink-0 flex-col rounded-xl border p-2.5 transition-all duration-150 ${columnStyle}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-1.5 py-1 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              STAGE_DOT_COLORS[stage] || 'bg-slate-400'
            }`}
          />
          <h2 className="text-xs font-bold text-slate-900 truncate tracking-tight">
            {stageDef?.label || stage}
          </h2>
          <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-slate-200/80 px-1.5 text-[10px] font-semibold text-slate-700">
            {leads.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Target indicator while dragging */}
          {isOver && isDragging && !isSameStage && (
            isValidDrop ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 animate-in fade-in-50 duration-100" />
            ) : (
              <Ban className="h-3.5 w-3.5 text-rose-500 animate-in fade-in-50 duration-100" />
            )
          )}

          {totalVolume > 0 && (
            <span className="text-[11px] font-medium text-slate-500 truncate" title="Stage Total Volume">
              {formatCurrency(totalVolume)}
            </span>
          )}
        </div>
      </div>

      {/* Leads List / Droppable Container */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
        {leads.length === 0 ? (
          <div
            className={`flex h-28 items-center justify-center rounded-lg border border-dashed p-4 text-center transition-colors ${
              isOver && isValidDrop
                ? 'border-primary/60 bg-primary/10'
                : 'border-slate-200 bg-white/40'
            }`}
          >
            <span className="text-[11px] text-muted-foreground">
              {isOver && isValidDrop ? 'Drop lead here' : 'No leads in stage'}
            </span>
          </div>
        ) : (
          leads.map((lead) => (
            <DraggableLeadCard
              key={lead._id}
              lead={lead}
              onClick={() => onLeadClick?.(lead)}
            />
          ))
        )}
      </div>
    </div>
  )
}
