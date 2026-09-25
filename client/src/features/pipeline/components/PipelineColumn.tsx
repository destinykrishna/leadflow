import { formatCurrency } from '@/lib/format'
import { STAGE_DEFINITIONS, type Lead, type LeadStatus } from '@/types/pipeline.types'
import { LeadCard } from './LeadCard'

interface PipelineColumnProps {
  stage: LeadStatus
  leads: Lead[]
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

export function PipelineColumn({ stage, leads, onLeadClick }: PipelineColumnProps) {
  const stageDef = STAGE_DEFINITIONS[stage]
  const totalVolume = leads.reduce(
    (sum, l) => sum + (Number(l.customFields?.loanAmount) || 0),
    0,
  )

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border/70 bg-slate-100/60 p-2.5">
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

        {totalVolume > 0 && (
          <span className="text-[11px] font-medium text-slate-500 truncate" title="Stage Total Volume">
            {formatCurrency(totalVolume)}
          </span>
        )}
      </div>

      {/* Leads List / Droppable Container */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
        {leads.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/40 p-4 text-center">
            <span className="text-[11px] text-muted-foreground">No leads in stage</span>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
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
