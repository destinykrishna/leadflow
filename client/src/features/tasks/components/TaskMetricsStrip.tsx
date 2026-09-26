import * as React from 'react'
import { AlertTriangle, Clock, CheckCircle2, PlayCircle, ListTodo } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { getTaskDueCategory, type Task } from '@/types/task.types'

interface TaskMetricsStripProps {
  tasks: Task[]
  selectedDueCategory: string
  selectedStatus: string
  onSelectDueCategory: (category: 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING') => void
  onSelectStatus: (status: string) => void
}

export function TaskMetricsStrip({
  tasks,
  selectedDueCategory,
  selectedStatus,
  onSelectDueCategory,
  onSelectStatus,
}: TaskMetricsStripProps) {
  const totalCount = tasks.length

  const overdueCount = React.useMemo(() => {
    return tasks.filter((t) => t.isOverdue || getTaskDueCategory(t) === 'OVERDUE').length
  }, [tasks])

  const dueTodayCount = React.useMemo(() => {
    return tasks.filter((t) => !t.isOverdue && getTaskDueCategory(t) === 'DUE_TODAY').length
  }, [tasks])

  const inProgressCount = React.useMemo(() => {
    return tasks.filter((t) => t.status === 'IN_PROGRESS').length
  }, [tasks])

  const completedCount = React.useMemo(() => {
    return tasks.filter((t) => t.status === 'COMPLETED').length
  }, [tasks])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {/* 1. Total */}
      <Card
        onClick={() => {
          onSelectDueCategory('ALL')
          onSelectStatus('ALL')
        }}
        className={`p-3.5 border transition-all cursor-pointer shadow-2xs hover:border-primary/40 ${
          selectedDueCategory === 'ALL' && selectedStatus === 'ALL'
            ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
            : 'border-border/80 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Tasks
          </span>
          <ListTodo className="h-4 w-4 text-slate-400" />
        </div>
        <span className="text-xl font-bold text-slate-900 mt-1 block">{totalCount}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5 block">Brokerage workspace</span>
      </Card>

      {/* 2. Overdue */}
      <Card
        onClick={() => {
          onSelectDueCategory(selectedDueCategory === 'OVERDUE' ? 'ALL' : 'OVERDUE')
        }}
        className={`p-3.5 border transition-all cursor-pointer shadow-2xs hover:border-rose-300 ${
          selectedDueCategory === 'OVERDUE'
            ? 'border-rose-400 ring-1 ring-rose-300 bg-rose-50/50'
            : 'border-border/80 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
            Overdue
          </span>
          <AlertTriangle className={`h-4 w-4 ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
        </div>
        <span className={`text-xl font-bold mt-1 block ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
          {overdueCount}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5 block">Requires attention</span>
      </Card>

      {/* 3. Due Today */}
      <Card
        onClick={() => {
          onSelectDueCategory(selectedDueCategory === 'DUE_TODAY' ? 'ALL' : 'DUE_TODAY')
        }}
        className={`p-3.5 border transition-all cursor-pointer shadow-2xs hover:border-amber-300 ${
          selectedDueCategory === 'DUE_TODAY'
            ? 'border-amber-400 ring-1 ring-amber-300 bg-amber-50/50'
            : 'border-border/80 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            Due Today
          </span>
          <Clock className={`h-4 w-4 ${dueTodayCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
        </div>
        <span className={`text-xl font-bold mt-1 block ${dueTodayCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
          {dueTodayCount}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5 block">Scheduled for today</span>
      </Card>

      {/* 4. In Progress */}
      <Card
        onClick={() => {
          onSelectStatus(selectedStatus === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')
        }}
        className={`p-3.5 border transition-all cursor-pointer shadow-2xs hover:border-primary/40 ${
          selectedStatus === 'IN_PROGRESS'
            ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
            : 'border-border/80 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
            In Progress
          </span>
          <PlayCircle className="h-4 w-4 text-primary" />
        </div>
        <span className="text-xl font-bold text-primary mt-1 block">{inProgressCount}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5 block">Active follow-ups</span>
      </Card>

      {/* 5. Completed */}
      <Card
        onClick={() => {
          onSelectStatus(selectedStatus === 'COMPLETED' ? 'ALL' : 'COMPLETED')
        }}
        className={`p-3.5 border transition-all cursor-pointer shadow-2xs hover:border-emerald-300 ${
          selectedStatus === 'COMPLETED'
            ? 'border-emerald-400 ring-1 ring-emerald-300 bg-emerald-50/50'
            : 'border-border/80 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
            Completed
          </span>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        </div>
        <span className="text-xl font-bold text-emerald-600 mt-1 block">{completedCount}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5 block">Resolved milestones</span>
      </Card>
    </div>
  )
}
