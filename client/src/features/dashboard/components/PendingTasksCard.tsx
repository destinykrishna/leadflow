import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Calendar } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'
import type { Task } from '@/types/task.types'

interface PendingTasksCardProps {
  tasks: Task[]
}

export function PendingTasksCard({ tasks }: PendingTasksCardProps) {
  const navigate = useNavigate()
  const pendingTasks = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS').slice(0, 6)

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'danger'
      case 'HIGH':
        return 'warning'
      case 'MEDIUM':
        return 'default'
      default:
        return 'neutral'
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Operational Action Items
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Tasks automatically triggered by lead pipeline progression
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/tasks')}
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-1">
        {pendingTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-80" />
            <p className="text-xs font-medium text-slate-700">All tasks completed</p>
            <p className="text-[11px] text-muted-foreground">
              New tasks will generate automatically when leads transition stages.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {pendingTasks.map((task) => (
              <div
                key={task._id}
                onClick={() => navigate('/app/tasks')}
                className="flex items-center justify-between py-3 cursor-pointer group transition-colors hover:bg-slate-50/70 px-2 rounded-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {task.isOverdue ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    ) : (
                      <Calendar className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-primary transition-colors truncate">
                      {task.title}
                    </span>
                    {task.description && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-xs">
                        {task.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Badge variant={getPriorityVariant(task.priority)} size="sm">
                    {task.priority}
                  </Badge>

                  {task.dueDate && (
                    <span
                      className={`text-[11px] font-medium ${
                        task.isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
