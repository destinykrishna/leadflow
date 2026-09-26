import { Mail, CheckCircle2, Zap, Variable } from 'lucide-react'
import type { IEmailTemplate } from '@/types/template.types'
import type { IPipelineTrigger } from '@/types/trigger.types'
import { AVAILABLE_TEMPLATE_VARIABLES } from '../lib/templatePreview'

interface TemplateMetricsStripProps {
  templates: IEmailTemplate[]
  triggers: IPipelineTrigger[]
}

export function TemplateMetricsStrip({ templates, triggers }: TemplateMetricsStripProps) {
  const total = templates.length
  const activeCount = templates.filter((t) => t.isActive).length

  // Count how many templates are assigned to at least one active trigger
  const templatesInUse = new Set(
    triggers
      .filter((tr) => tr.actionType === 'SEND_EMAIL' && tr.actionConfig?.templateId)
      .map((tr) => {
        const tpl = tr.actionConfig.templateId
        return typeof tpl === 'object' ? tpl?._id : tpl
      })
      .filter(Boolean),
  ).size

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
      {/* 1. Total Templates */}
      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Total Templates</span>
          <Mail className="h-4 w-4 text-slate-500" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{total}</div>
        <span className="text-[10px] text-muted-foreground mt-0.5">Pipeline email library</span>
      </div>

      {/* 2. Active Templates */}
      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-emerald-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Active</span>
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{activeCount}</div>
        <span className="text-[10px] text-emerald-600/80 mt-0.5">Ready for dispatch</span>
      </div>

      {/* 3. In Active Automations */}
      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-blue-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">In Automations</span>
          <Zap className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-blue-700">{templatesInUse}</div>
        <span className="text-[10px] text-blue-600/80 mt-0.5">Linked to stage triggers</span>
      </div>

      {/* 4. Supported Placeholders */}
      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-purple-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Placeholders</span>
          <Variable className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-purple-700">
          {AVAILABLE_TEMPLATE_VARIABLES.length}
        </div>
        <span className="text-[10px] text-purple-600/80 mt-0.5">Indian context variables</span>
      </div>
    </div>
  )
}
