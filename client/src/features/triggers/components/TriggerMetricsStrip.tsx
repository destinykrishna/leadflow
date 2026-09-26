import { Zap, CheckCircle2, CheckSquare, Mail, Layers } from 'lucide-react'
import type { IPipelineTrigger, TriggerFilterValues } from '@/types/trigger.types'

interface TriggerMetricsStripProps {
  triggers: IPipelineTrigger[]
  templatesCount: number
  filters: TriggerFilterValues
  onFilterChange: (filters: Partial<TriggerFilterValues>) => void
}

export function TriggerMetricsStrip({
  triggers,
  templatesCount,
  filters,
  onFilterChange,
}: TriggerMetricsStripProps) {
  const total = triggers.length
  const activeCount = triggers.filter((t) => t.isActive).length
  const taskCount = triggers.filter((t) => t.actionType === 'CREATE_TASK').length
  const emailCount = triggers.filter((t) => t.actionType === 'SEND_EMAIL').length

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 mb-6">
      {/* 1. Total Rules */}
      <button
        type="button"
        onClick={() => onFilterChange({ actionType: 'ALL', status: 'ALL', stage: 'ALL' })}
        className={`flex flex-col rounded-xl border p-3.5 text-left transition-all hover:shadow-xs cursor-pointer ${
          filters.actionType === 'ALL' && filters.status === 'ALL'
            ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
            : 'border-border bg-card hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Total Rules</span>
          <Zap className="h-4 w-4 text-slate-500" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{total}</div>
        <span className="text-[10px] text-muted-foreground mt-0.5">Automated workflows</span>
      </button>

      {/* 2. Active Rules */}
      <button
        type="button"
        onClick={() =>
          onFilterChange({
            status: filters.status === 'ACTIVE' ? 'ALL' : 'ACTIVE',
          })
        }
        className={`flex flex-col rounded-xl border p-3.5 text-left transition-all hover:shadow-xs cursor-pointer ${
          filters.status === 'ACTIVE'
            ? 'border-emerald-500 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500/20'
            : 'border-border bg-card hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between text-emerald-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Active</span>
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{activeCount}</div>
        <span className="text-[10px] text-emerald-600/80 mt-0.5">Live execution ready</span>
      </button>

      {/* 3. Task Triggers */}
      <button
        type="button"
        onClick={() =>
          onFilterChange({
            actionType: filters.actionType === 'CREATE_TASK' ? 'ALL' : 'CREATE_TASK',
          })
        }
        className={`flex flex-col rounded-xl border p-3.5 text-left transition-all hover:shadow-xs cursor-pointer ${
          filters.actionType === 'CREATE_TASK'
            ? 'border-blue-500 bg-blue-50/60 shadow-xs ring-1 ring-blue-500/20'
            : 'border-border bg-card hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between text-blue-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Task Triggers</span>
          <CheckSquare className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-blue-700">{taskCount}</div>
        <span className="text-[10px] text-blue-600/80 mt-0.5">Auto-schedule tasks</span>
      </button>

      {/* 4. Email Dispatches */}
      <button
        type="button"
        onClick={() =>
          onFilterChange({
            actionType: filters.actionType === 'SEND_EMAIL' ? 'ALL' : 'SEND_EMAIL',
          })
        }
        className={`flex flex-col rounded-xl border p-3.5 text-left transition-all hover:shadow-xs cursor-pointer ${
          filters.actionType === 'SEND_EMAIL'
            ? 'border-purple-500 bg-purple-50/60 shadow-xs ring-1 ring-purple-500/20'
            : 'border-border bg-card hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between text-purple-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Email Dispatches</span>
          <Mail className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-purple-700">{emailCount}</div>
        <span className="text-[10px] text-purple-600/80 mt-0.5">Automated emails</span>
      </button>

      {/* 5. Linked Templates */}
      <div className="col-span-2 sm:col-span-1 flex flex-col rounded-xl border border-border bg-card p-3.5 text-left">
        <div className="flex items-center justify-between text-amber-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Email Templates</span>
          <Layers className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-amber-700">
          {templatesCount}
        </div>
        <span className="text-[10px] text-muted-foreground mt-0.5">Library templates</span>
      </div>
    </div>
  )
}
