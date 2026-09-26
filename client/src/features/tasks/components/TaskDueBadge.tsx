import { AlertTriangle, Clock, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { getTaskDueCategory, type Task } from '@/types/task.types'

interface TaskDueBadgeProps {
  task: Task
  referenceDate?: Date
  className?: string
}

export function TaskDueBadge({ task, referenceDate, className }: TaskDueBadgeProps) {
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    if (!task.dueDate) return null
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${className || ''}`}>
        <Calendar className="h-3 w-3 text-slate-400" />
        <span>{formatDate(task.dueDate)}</span>
      </span>
    )
  }

  const category = getTaskDueCategory(task, referenceDate)

  if (category === 'OVERDUE' || task.isOverdue) {
    return (
      <span
        data-testid="badge-overdue"
        className={`inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200/80 px-2 py-0.5 text-[11px] font-semibold text-rose-700 shadow-2xs ${
          className || ''
        }`}
      >
        <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
        <span>Overdue ({task.dueDate ? formatDate(task.dueDate) : 'Expired'})</span>
      </span>
    )
  }

  if (category === 'DUE_TODAY') {
    return (
      <span
        data-testid="badge-due-today"
        className={`inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[11px] font-semibold text-amber-800 shadow-2xs ${
          className || ''
        }`}
      >
        <Clock className="h-3 w-3 text-amber-600 shrink-0" />
        <span>Due Today</span>
      </span>
    )
  }

  if (category === 'UPCOMING' && task.dueDate) {
    return (
      <span
        data-testid="badge-upcoming"
        className={`inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200/70 px-2 py-0.5 text-[11px] font-medium text-slate-700 ${
          className || ''
        }`}
      >
        <Calendar className="h-3 w-3 text-slate-500 shrink-0" />
        <span>Due {formatDate(task.dueDate)}</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${className || ''}`}>
      <span className="text-slate-400">No deadline</span>
    </span>
  )
}
