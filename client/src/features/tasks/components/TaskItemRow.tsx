import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  User,
  Briefcase,
  Loader2,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import {
  getTaskLead,
  getTaskClient,
  getTaskAdvisor,
  type Task,
  type TaskStatus,
} from '@/types/task.types'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskDueBadge } from './TaskDueBadge'
import { useUpdateTaskStatus } from '../api/tasks.api'
import { useAuth } from '@/hooks/useAuth'

interface TaskItemRowProps {
  task: Task
  onSelectTask: (task: Task) => void
}

export function TaskItemRow({ task, onSelectTask }: TaskItemRowProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const updateMutation = useUpdateTaskStatus()

  const lead = getTaskLead(task)
  const client = getTaskClient(task)
  const advisor = getTaskAdvisor(task)

  const isCompleted = task.status === 'COMPLETED'
  const isAssignedToCurrentUser = user?.id && advisor?.id === user.id

  // 1-click toggle complete / reopen
  const handleQuickToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextStatus: TaskStatus = isCompleted ? 'PENDING' : 'COMPLETED'
    updateMutation.mutate({
      taskId: task._id,
      status: nextStatus,
    })
  }

  // Handle status select change
  const handleStatusSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    const newStatus = e.target.value as TaskStatus
    if (newStatus !== task.status) {
      updateMutation.mutate({
        taskId: task._id,
        status: newStatus,
      })
    }
  }

  return (
    <div
      onClick={() => onSelectTask(task)}
      data-testid={`task-row-${task._id}`}
      className={`group flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-border/70 hover:bg-slate-50/80 transition-colors cursor-pointer gap-3 ${
        isCompleted ? 'bg-slate-50/30' : 'bg-white'
      }`}
    >
      {/* Left Column: Quick Checkbox + Task Title & Entity Link */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Quick Complete Button */}
        <button
          type="button"
          onClick={handleQuickToggle}
          disabled={updateMutation.isPending}
          title={isCompleted ? 'Reopen task' : 'Mark as completed'}
          aria-label={isCompleted ? `Reopen task ${task.title}` : `Complete task ${task.title}`}
          className={`h-5 w-5 mt-0.5 rounded flex items-center justify-center transition-all shrink-0 ${
            isCompleted
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-transparent hover:text-emerald-600'
          }`}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : isCompleted ? (
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Title, Snippet, & Entity Links */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-semibold text-slate-900 group-hover:text-primary transition-colors ${
                isCompleted ? 'line-through text-slate-400 font-normal' : ''
              }`}
            >
              {task.title}
            </span>

            <TaskPriorityBadge priority={task.priority} />
            <TaskDueBadge task={task} />
          </div>

          {task.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
              {task.description}
            </p>
          )}

          {/* Associated Entity Links */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {lead && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/app/leads/${lead.id}`)
                }}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 transition-colors"
                title={`Open Lead: ${lead.name}`}
              >
                <User className="h-2.5 w-2.5" />
                <span className="font-medium truncate max-w-[150px]">Lead: {lead.name}</span>
              </button>
            )}

            {client && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/app/clients/${client.id}`)
                }}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200/80 rounded px-1.5 py-0.5 transition-colors"
                title={`Open Case: ${client.name}`}
              >
                <Briefcase className="h-2.5 w-2.5" />
                <span className="font-medium truncate max-w-[150px]">Case: {client.name}</span>
              </button>
            )}

            {!lead && !client && (
              <span className="text-[10px] text-slate-400 italic">Brokerage Operations</span>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Advisor Assignment + Status Selector */}
      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/40">
        {/* Advisor Initials & Name */}
        <div className="flex items-center gap-1.5">
          <Avatar name={advisor?.name || 'Advisor'} size="sm" />
          <div className="text-[11px]">
            <span className="font-medium text-slate-700">{advisor?.name || 'Unassigned'}</span>
            {isAssignedToCurrentUser && (
              <span className="ml-1 text-[9px] bg-primary/10 text-primary px-1 py-0.2 rounded font-bold">
                You
              </span>
            )}
          </div>
        </div>

        {/* Quick Status Select / Dropdown */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <select
            value={task.status}
            onChange={handleStatusSelect}
            disabled={updateMutation.isPending}
            aria-label={`Update status for ${task.title}`}
            className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary hover:border-slate-300 transition-colors disabled:opacity-60"
          >
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {isCompleted && (
            <button
              type="button"
              onClick={handleQuickToggle}
              title="Reopen Task"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}

          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors hidden sm:block" />
        </div>
      </div>
    </div>
  )
}
