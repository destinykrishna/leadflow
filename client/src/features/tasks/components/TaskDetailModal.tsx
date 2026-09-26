import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import {
  CheckCircle2,
  Clock,
  PlayCircle,
  XCircle,
  ExternalLink,
  User,
  Briefcase,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { formatDate } from '@/lib/format'
import {
  getTaskLead,
  getTaskClient,
  getTaskAdvisor,
  type Task,
  type TaskStatus,
} from '@/types/task.types'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskDueBadge } from './TaskDueBadge'
import { useUpdateTaskStatus } from '../api/tasks.api'

interface TaskDetailModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
}

export function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  const navigate = useNavigate()
  const updateMutation = useUpdateTaskStatus()
  const [actionError, setActionError] = React.useState<string | null>(null)

  if (!task) return null

  const lead = getTaskLead(task)
  const client = getTaskClient(task)
  const advisor = getTaskAdvisor(task)

  const handleStatusChange = async (newStatus: TaskStatus) => {
    setActionError(null)
    try {
      await updateMutation.mutateAsync({
        taskId: task._id,
        status: newStatus,
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update task status'
      setActionError(msg)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-2 mb-1">
            <TaskPriorityBadge priority={task.priority} />
            <TaskStatusBadge status={task.status} />
            <TaskDueBadge task={task} />
          </div>
          <DialogTitle className="text-base font-bold text-slate-900 leading-snug">
            {task.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Task ID: <span className="font-mono text-slate-700">{task._id}</span>
          </DialogDescription>
        </DialogHeader>

        {actionError && (
          <div className="rounded-md bg-rose-50 border border-rose-200 p-2.5 flex items-start gap-2 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Status Update Failed</p>
              <p className="text-[11px] text-rose-600 mt-0.5">{actionError}</p>
            </div>
          </div>
        )}

        <div className="space-y-4 py-1 text-xs">
          {/* Description */}
          <div>
            <h4 className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider mb-1">
              Description & Notes
            </h4>
            <div className="rounded-md bg-slate-50 border border-slate-200/70 p-3 text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
              {task.description || (
                <span className="text-muted-foreground italic">
                  No additional notes provided for this operational task.
                </span>
              )}
            </div>
          </div>

          {/* Associated Entities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Associated Borrower / Lead */}
            <div className="rounded-md border border-border/80 p-3 bg-white">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Associated Inbound Lead
              </span>
              {lead ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium text-slate-900 truncate">{lead.name}</span>
                    {lead.status && (
                      <Badge variant="neutral" size="sm" className="text-[10px] py-0 px-1.5">
                        {lead.status}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 h-7"
                    onClick={() => {
                      onClose()
                      navigate(`/app/leads/${lead.id}`)
                    }}
                  >
                    <span>View Lead Profile</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-slate-400 italic">No direct lead linkage</p>
              )}
            </div>

            {/* Associated Client Case */}
            <div className="rounded-md border border-border/80 p-3 bg-white">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Associated Client Case
              </span>
              {client ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium text-slate-900 truncate">{client.name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 h-7"
                    onClick={() => {
                      onClose()
                      navigate(`/app/clients/${client.id}`)
                    }}
                  >
                    <span>Open Case Workspace</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-slate-400 italic">No client profile linked</p>
              )}
            </div>
          </div>

          {/* Assigned Advisor & Timestamps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/60">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Assigned Mortgage Advisor
              </span>
              {advisor ? (
                <div className="flex items-center gap-2">
                  <Avatar name={advisor.name} size="sm" />
                  <div className="truncate">
                    <p className="font-medium text-slate-900 leading-tight">{advisor.name}</p>
                    {advisor.email && (
                      <p className="text-[10px] text-muted-foreground truncate">{advisor.email}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 italic">Unassigned</p>
              )}
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Timeline & Schedule
              </span>
              <div className="space-y-0.5 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  <span>Created: {formatDate(task.createdAt)}</span>
                </div>
                {task.dueDate && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>Due: {formatDate(task.dueDate)}</span>
                  </div>
                )}
                {task.completedAt && (
                  <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Completed: {formatDate(task.completedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/70 flex flex-wrap gap-2 justify-between sm:justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Quick Status:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {task.status !== 'COMPLETED' && (
              <Button
                size="sm"
                variant="primary"
                disabled={updateMutation.isPending}
                onClick={() => handleStatusChange('COMPLETED')}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>Mark Completed</span>
              </Button>
            )}

            {task.status !== 'IN_PROGRESS' && (
              <Button
                size="sm"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => handleStatusChange('IN_PROGRESS')}
                className="gap-1.5 text-xs"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="h-3.5 w-3.5 text-primary" />
                )}
                <span>Start Task</span>
              </Button>
            )}

            {task.status !== 'PENDING' && (
              <Button
                size="sm"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => handleStatusChange('PENDING')}
                className="gap-1.5 text-xs"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                )}
                <span>Set to Pending</span>
              </Button>
            )}

            {task.status !== 'CANCELLED' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={updateMutation.isPending}
                onClick={() => handleStatusChange('CANCELLED')}
                className="gap-1 text-xs text-slate-500 hover:text-rose-600"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
