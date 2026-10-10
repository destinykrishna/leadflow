import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/hooks/useAuth'
import { useAdvisorsList } from '@/features/team/api/team.api'
import { useCreateTask } from '../api/tasks.api'
import { useToast } from '@/components/ui/Toast'
import { CheckSquare, Calendar, User, AlertCircle, Loader2 } from 'lucide-react'
import { TextTranslate } from '@/features/leads/components/LeadNoteTranslate'

export interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  initialLeadId?: string
  initialLeadName?: string
  initialClientId?: string
  initialClientName?: string
  defaultAssignedTo?: string
  onSuccess?: () => void
}

export function CreateTaskModal({
  isOpen,
  onClose,
  initialLeadId,
  initialLeadName,
  initialClientId,
  initialClientName,
  defaultAssignedTo,
  onSuccess,
}: CreateTaskModalProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const createTaskMutation = useCreateTask()

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [priority, setPriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [dueDate, setDueDate] = React.useState('')
  const [assignedTo, setAssignedTo] = React.useState('')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Fetch active advisors for the assignment dropdown
  const { data: advisorsData, isLoading: isAdvisorsLoading } = useAdvisorsList({ status: 'ACTIVE' })
  const advisors = advisorsData?.advisors || []

  // Initialize defaults when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTitle('')
      setDescription('')
      setPriority('MEDIUM')
      setErrorMsg(null)

      // Default due date: tomorrow at 17:00
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const yyyy = tomorrow.getFullYear()
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
      const dd = String(tomorrow.getDate()).padStart(2, '0')
      setDueDate(`${yyyy}-${mm}-${dd}`)

      // Default assignee: specified default, or current user if advisor, or first active advisor
      if (defaultAssignedTo) {
        setAssignedTo(defaultAssignedTo)
      } else if (user?.id && advisors.some((a) => a.id === user.id)) {
        setAssignedTo(user.id)
      } else if (advisors.length > 0) {
        setAssignedTo(advisors[0].id)
      }
    }
  }, [isOpen, defaultAssignedTo, user, advisors.length])

  // Update assignedTo once advisors load if not set
  React.useEffect(() => {
    if (!assignedTo && advisors.length > 0) {
      const preferred = defaultAssignedTo || (user?.id && advisors.some((a) => a.id === user.id) ? user.id : advisors[0].id)
      setAssignedTo(preferred)
    }
  }, [advisors, assignedTo, defaultAssignedTo, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg('Task title is required')
      return
    }
    if (!assignedTo) {
      setErrorMsg('Please select an assigned advisor')
      return
    }

    setErrorMsg(null)

    try {
      await createTaskMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        assignedTo,
        leadId: initialLeadId || undefined,
        clientId: initialClientId || undefined,
      })

      showToast({
        type: 'success',
        title: 'Task Created',
        message: `"${title.trim()}" has been scheduled.`,
      })

      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || (err as Error).message || 'Failed to create task'
      setErrorMsg(msg)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Create Follow-Up Task
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Schedule an actionable follow-up item for this mortgage inquiry.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Linked Entity Pill */}
          {(initialLeadName || initialClientName) && (
            <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700">
              <span className="font-medium text-slate-500">Linked to:</span>
              <span className="font-semibold text-slate-900">
                {initialLeadName ? `Lead · ${initialLeadName}` : `Client · ${initialClientName}`}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call borrower to collect 3-month salary slips"
              className="text-xs h-9"
              autoFocus
            />
          </div>

          {/* Priority & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="task-priority" className="text-xs font-semibold text-slate-700">Priority</label>
              <Select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                aria-label="Priority"
                className="w-full text-xs"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium (Standard)</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" />
                <span>Due Date</span>
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Assigned Advisor */}
          <div className="space-y-1.5">
            <label htmlFor="task-assigned-to" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <User className="h-3 w-3 text-slate-400" />
              <span>Assigned Advisor</span> <span className="text-rose-500">*</span>
            </label>
            <Select
              id="task-assigned-to"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={isAdvisorsLoading || advisors.length === 0}
              aria-label="Assigned Advisor"
              className="w-full text-xs"
            >
              {advisors.length === 0 ? (
                <option value="">No active advisors found</option>
              ) : (
                advisors.map((adv) => (
                  <option key={adv.id} value={adv.id}>
                    {adv.name} ({adv.email}){adv.id === user?.id ? ' — You' : ''}
                  </option>
                ))
              )}
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Notes / Instructions <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add specific instructions or borrower context..."
              className="w-full rounded-md border border-input bg-white p-2.5 text-xs text-slate-800 shadow-2xs focus:border-primary focus:outline-hidden"
            />
            {description.trim().length > 0 && (
              <TextTranslate
                text={description}
                context="task_description"
                label="Task Instructions"
                testIdPrefix="create-task-"
                className="mt-1"
              />
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={createTaskMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createTaskMutation.isPending}
              className="gap-1.5"
            >
              {createTaskMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>Create Task</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
