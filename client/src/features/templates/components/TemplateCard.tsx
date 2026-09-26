import * as React from 'react'
import {
  Mail,
  Eye,
  Edit2,
  Copy,
  Check,
  Zap,
} from 'lucide-react'
import type { IEmailTemplate } from '@/types/template.types'
import type { IPipelineTrigger } from '@/types/trigger.types'
import { Button } from '@/components/ui/Button'

interface TemplateCardProps {
  template: IEmailTemplate
  triggers: IPipelineTrigger[]
  canMutate: boolean
  onPreview: (template: IEmailTemplate) => void
  onEdit?: (template: IEmailTemplate) => void
}

export function TemplateCard({
  template,
  triggers,
  canMutate,
  onPreview,
  onEdit,
}: TemplateCardProps) {
  const [copiedVar, setCopiedVar] = React.useState<string | null>(null)

  // Find all triggers that reference this template
  const linkedTriggers = triggers.filter((tr) => {
    if (tr.actionType !== 'SEND_EMAIL') return false
    const tpl = tr.actionConfig?.templateId
    const tplId = typeof tpl === 'object' ? tpl?._id : tpl
    return tplId === template._id
  })

  const handleCopyVar = (e: React.MouseEvent, varToken: string) => {
    e.stopPropagation()
    const formattedToken = varToken.startsWith('{{') ? varToken : `{{${varToken}}}`
    navigator.clipboard.writeText(formattedToken)
    setCopiedVar(varToken)
    setTimeout(() => setCopiedVar(null), 1500)
  }

  // Render subject with highlighted placeholder badges
  const renderSubjectTokens = (subject: string) => {
    const parts = subject.split(/(\{\{[a-zA-Z0-9_.-]+\}\})/g)
    return parts.map((part, index) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        return (
          <span
            key={index}
            className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded mx-0.5"
          >
            {part}
          </span>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4.5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-snug">{template.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                  {template.slug}
                </span>
                {template.isActive ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-medium">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Subject Line */}
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 text-xs text-slate-800 leading-relaxed">
          <span className="font-semibold text-slate-500 text-[11px] block mb-0.5">Subject:</span>
          <div className="font-medium text-slate-900">{renderSubjectTokens(template.subject)}</div>
        </div>

        {/* Body Preview Excerpt */}
        <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {template.body.replace(/<[^>]+>/g, ' ')}
        </div>

        {/* Linked Stage Automations */}
        {linkedTriggers.length > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <Zap className="h-3 w-3 text-amber-500" />
              <span>Triggered on Stage Transition:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {linkedTriggers.map((tr) => (
                <span
                  key={tr._id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold"
                >
                  <span>→ {tr.toStage}</span>
                  <span className="text-amber-600/70 text-[9px]">({tr.name})</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 italic">
            Not currently linked to any stage triggers
          </div>
        )}

        {/* Variables Used */}
        {template.variables && template.variables.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-slate-100">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Placeholders Used (click to copy):
            </div>
            <div className="flex flex-wrap gap-1">
              {template.variables.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={(e) => handleCopyVar(e, variable)}
                  className="group inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 transition-colors border border-slate-200"
                  title="Click to copy placeholder token"
                >
                  <span>{`{{${variable}}}`}</span>
                  {copiedVar === variable ? (
                    <Check className="h-2.5 w-2.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-2.5 w-2.5 text-slate-400 group-hover:text-slate-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-2 pt-3.5 mt-3 border-t border-border">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPreview(template)}
          className="h-8 text-xs gap-1.5 flex-1"
        >
          <Eye className="h-3.5 w-3.5 text-slate-500" />
          <span>Preview Render</span>
        </Button>

        {canMutate && onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(template)}
            className="h-8 text-xs gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>
        )}
      </div>
    </div>
  )
}
