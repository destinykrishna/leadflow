import {
  Zap,
  Mail,
  CheckSquare,
  ArrowRight,
  Eye,
  Loader2,
  Trash2,
  Lock,
} from 'lucide-react'
import type { IPipelineTrigger, IPopulatedEmailTemplate } from '@/types/trigger.types'
import { Button } from '@/components/ui/Button'

interface TriggerItemCardProps {
  trigger: IPipelineTrigger
  canMutate: boolean
  isToggling?: boolean
  isDeleting?: boolean
  onToggleStatus: (trigger: IPipelineTrigger) => void
  onDeleteTrigger?: (id: string) => void
  onPreviewTemplate?: (template: { name: string; slug?: string; subject: string; body: string }) => void
}

const STAGE_LABELS: Record<string, string> = {
  NEW: 'New Ingestion',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal Sent',
  NEGOTIATION: 'Negotiation',
  WON: 'Won (Client)',
  LOST: 'Closed / Lost',
}

export function TriggerItemCard({
  trigger,
  canMutate,
  isToggling = false,
  isDeleting = false,
  onToggleStatus,
  onDeleteTrigger,
  onPreviewTemplate,
}: TriggerItemCardProps) {
  const isTask = trigger.actionType === 'CREATE_TASK'
  const isEmail = trigger.actionType === 'SEND_EMAIL'

  const populatedTemplate =
    trigger.actionConfig?.templateId && typeof trigger.actionConfig.templateId === 'object'
      ? (trigger.actionConfig.templateId as IPopulatedEmailTemplate)
      : null

  const fromStageLabel = trigger.fromStage ? STAGE_LABELS[trigger.fromStage] || trigger.fromStage : 'Any Stage'
  const toStageLabel = STAGE_LABELS[trigger.toStage] || trigger.toStage

  const handlePreviewClick = () => {
    if (populatedTemplate && onPreviewTemplate) {
      onPreviewTemplate({
        name: populatedTemplate.name,
        slug: populatedTemplate.slug,
        subject: populatedTemplate.subject || 'Automated Mortgage Notification',
        body: 'Automated email dispatch for stage transition: ' + toStageLabel,
      })
    }
  }

  return (
    <div
      className={`rounded-xl border p-4.5 transition-all bg-card shadow-xs hover:border-slate-300 ${
        trigger.isActive ? 'border-border' : 'border-dashed border-slate-200 bg-slate-50/40 opacity-80'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Stage Transition and Action Description */}
        <div className="space-y-2 flex-1">
          {/* Transition Header */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800">
              <span className="text-slate-500 font-normal">{fromStageLabel}</span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span className="text-slate-900 font-bold">{toStageLabel}</span>
            </div>

            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                isTask
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : isEmail
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {isTask ? (
                <CheckSquare className="h-3 w-3" />
              ) : isEmail ? (
                <Mail className="h-3 w-3" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              <span>{isTask ? 'Auto-Create Task' : isEmail ? 'Send Email' : trigger.actionType}</span>
            </div>

            {trigger.isActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Paused
              </span>
            )}
          </div>

          {/* Rule Name */}
          <h3 className="text-sm font-bold text-slate-900 leading-snug">{trigger.name}</h3>

          {/* Action Execution Details */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
            {isTask && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Task Title:</span>
                  <span className="text-slate-900 font-medium">
                    {trigger.actionConfig?.taskTitle || 'Advisor follow-up task'}
                  </span>
                </div>
                {trigger.actionConfig?.taskPriority && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Priority:</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                      {trigger.actionConfig.taskPriority}
                    </span>
                  </div>
                )}
                {typeof trigger.actionConfig?.dueDaysOffset === 'number' && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Due Timeline:</span>
                    <span className="text-slate-800">
                      {trigger.actionConfig.dueDaysOffset === 0
                        ? 'Same day'
                        : `Within ${trigger.actionConfig.dueDaysOffset} day${
                            trigger.actionConfig.dueDaysOffset > 1 ? 's' : ''
                          }`}
                    </span>
                  </div>
                )}
              </>
            )}

            {isEmail && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Template:</span>
                  <span className="text-slate-900 font-medium">
                    {populatedTemplate?.name || 'Assigned Template'}
                  </span>
                </div>
                {trigger.actionConfig?.recipientType && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Recipient:</span>
                    <span className="text-slate-800 capitalize">
                      {trigger.actionConfig.recipientType.toLowerCase()}
                    </span>
                  </div>
                )}
                {populatedTemplate && onPreviewTemplate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePreviewClick}
                    className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/5"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Preview Email</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Status Switch / Actions */}
        <div className="flex items-center gap-2.5 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
          {canMutate ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={trigger.isActive}
                disabled={isToggling}
                onClick={() => onToggleStatus(trigger)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  trigger.isActive ? 'bg-emerald-600' : 'bg-slate-300'
                } ${isToggling ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <span className="sr-only">Toggle trigger active state</span>
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    trigger.isActive ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>

              {isToggling && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}

              {onDeleteTrigger && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => onDeleteTrigger(trigger._id)}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  title="Delete Trigger Rule"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3 text-slate-400" />
              <span>Brokerage Admin configured</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
