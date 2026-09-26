import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Zap, CheckSquare, Mail, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCreateTrigger } from '../api/triggers.api'
import { useEmailTemplates } from '@/features/templates/api/templates.api'
import type { TriggerActionType, TriggerRecipientType } from '@/types/trigger.types'
import { validateForm, createTriggerFormSchema } from '@/lib/validation'

interface CreateTriggerModalProps {
  isOpen: boolean
  onClose: () => void
}

const STAGES = [
  { value: 'NEW', label: 'New Lead' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL', label: 'Proposal Sent' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'WON', label: 'Won (Client Case)' },
  { value: 'LOST', label: 'Closed / Lost' },
]

export function CreateTriggerModal({ isOpen, onClose }: CreateTriggerModalProps) {
  const createMutation = useCreateTrigger()
  const { data: templates = [] } = useEmailTemplates()

  const [name, setName] = React.useState('')
  const [toStage, setToStage] = React.useState('QUALIFIED')
  const [fromStage, setFromStage] = React.useState('')
  const [actionType, setActionType] = React.useState<TriggerActionType>('CREATE_TASK')

  // Task config
  const [taskTitle, setTaskTitle] = React.useState('')
  const [taskDescription, setTaskDescription] = React.useState('')
  const [taskPriority, setTaskPriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [dueDaysOffset, setDueDaysOffset] = React.useState(1)

  // Email config
  const [templateId, setTemplateId] = React.useState('')
  const [recipientType, setRecipientType] = React.useState<TriggerRecipientType>('LEAD')

  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [serverError, setServerError] = React.useState<string | null>(null)

  // Auto-set templateId when templates load
  React.useEffect(() => {
    if (templates.length > 0 && !templateId) {
      setTemplateId(templates[0]._id)
    }
  }, [templates, templateId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    const payload = {
      name,
      toStage,
      fromStage: fromStage || null,
      actionType,
      actionConfig:
        actionType === 'CREATE_TASK'
          ? {
              taskTitle: taskTitle || `Follow up on ${toStage} lead`,
              taskDescription: taskDescription || undefined,
              taskPriority,
              dueDaysOffset: Number(dueDaysOffset) || 1,
            }
          : {
              templateId: templateId || undefined,
              recipientType,
            },
      isActive: true,
    }

    const validation = validateForm(createTriggerFormSchema, payload)
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }

    setErrors({})

    try {
      await createMutation.mutateAsync(payload)
      onClose()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create automation rule'
      setServerError(errorMsg)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in-0" />
        <Dialog.Content
          aria-describedby="create-trigger-desc"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-hidden max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-900 leading-tight">
                  New Stage Automation Rule
                </Dialog.Title>
                <p id="create-trigger-desc" className="text-xs text-muted-foreground mt-0.5">
                  Trigger an automated advisor task or email dispatch on pipeline transitions
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {serverError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Rule Name */}
            <div>
              <label htmlFor="trigger-name" className="block text-xs font-semibold text-slate-700">
                Rule Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="trigger-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Schedule loan proposal call on Qualified"
                className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden"
              />
              {errors.name && <p className="text-[11px] text-rose-600 mt-1">{errors.name}</p>}
            </div>

            {/* Stages Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="from-stage" className="block text-xs font-semibold text-slate-700">
                  From Stage (Optional)
                </label>
                <select
                  id="from-stage"
                  value={fromStage}
                  onChange={(e) => setFromStage(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                >
                  <option value="">Any Stage (Wildcard)</option>
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="to-stage" className="block text-xs font-semibold text-slate-700">
                  To Stage (Target) <span className="text-rose-500">*</span>
                </label>
                <select
                  id="to-stage"
                  value={toStage}
                  onChange={(e) => setToStage(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                >
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {errors.toStage && <p className="text-[11px] text-rose-600 mt-1">{errors.toStage}</p>}
              </div>
            </div>

            {/* Action Type Tabs */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Automated Action <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActionType('CREATE_TASK')}
                  className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all ${
                    actionType === 'CREATE_TASK'
                      ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600 text-blue-900'
                      : 'border-border bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-xs font-semibold">Auto-Create Task</div>
                    <div className="text-[10px] text-slate-500">Assign task to lead advisor</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActionType('SEND_EMAIL')}
                  className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all ${
                    actionType === 'SEND_EMAIL'
                      ? 'border-purple-600 bg-purple-50/60 ring-1 ring-purple-600 text-purple-900'
                      : 'border-border bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Mail className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-xs font-semibold">Dispatch Email</div>
                    <div className="text-[10px] text-slate-500">Send automated template</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Task-Specific Configuration */}
            {actionType === 'CREATE_TASK' && (
              <div className="space-y-3 rounded-lg border border-border bg-slate-50/60 p-3.5">
                <div className="text-xs font-bold text-slate-800">Task Settings</div>
                <div>
                  <label htmlFor="task-title" className="block text-xs font-medium text-slate-700">
                    Task Title
                  </label>
                  <input
                    id="task-title"
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Call borrower to discuss loan options"
                    className="mt-1 block w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="task-priority" className="block text-xs font-medium text-slate-700">
                      Priority
                    </label>
                    <select
                      id="task-priority"
                      value={taskPriority}
                      onChange={(e) =>
                        setTaskPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')
                      }
                      className="mt-1 block w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="task-offset" className="block text-xs font-medium text-slate-700">
                      Due In (Days)
                    </label>
                    <input
                      id="task-offset"
                      type="number"
                      min={0}
                      value={dueDaysOffset}
                      onChange={(e) => setDueDaysOffset(Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="task-desc" className="block text-xs font-medium text-slate-700">
                    Description / Instructions (Optional)
                  </label>
                  <textarea
                    id="task-desc"
                    rows={2}
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Instructions for the assigned mortgage advisor..."
                    className="mt-1 block w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden resize-none"
                  />
                </div>
              </div>
            )}

            {/* Email-Specific Configuration */}
            {actionType === 'SEND_EMAIL' && (
              <div className="space-y-3 rounded-lg border border-border bg-slate-50/60 p-3.5">
                <div className="text-xs font-bold text-slate-800">Email Dispatch Settings</div>
                <div>
                  <label htmlFor="email-template" className="block text-xs font-medium text-slate-700">
                    Email Template
                  </label>
                  <select
                    id="email-template"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                  >
                    {templates.length === 0 ? (
                      <option value="">No templates available</option>
                    ) : (
                      templates.map((tpl) => (
                        <option key={tpl._id} value={tpl._id}>
                          {tpl.name} ({tpl.slug})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="recipient-type" className="block text-xs font-medium text-slate-700">
                    Send Email To
                  </label>
                  <select
                    id="recipient-type"
                    value={recipientType}
                    onChange={(e) => setRecipientType(e.target.value as TriggerRecipientType)}
                    className="mt-1 block w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                  >
                    <option value="LEAD">Borrower / Lead (Email on record)</option>
                    <option value="AGENT">Assigned Mortgage Advisor</option>
                  </select>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending} className="gap-1.5">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Creating Rule...</span>
                  </>
                ) : (
                  <span>Create Automation</span>
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
