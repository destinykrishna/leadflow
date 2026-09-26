import { Badge } from '@/components/ui/Badge'
import { CheckCircle2, Clock, PlayCircle, XCircle } from 'lucide-react'
import type { TaskStatus } from '@/types/task.types'

interface TaskStatusBadgeProps {
  status: TaskStatus
  className?: string
  showIcon?: boolean
}

export function TaskStatusBadge({ status, className, showIcon = true }: TaskStatusBadgeProps) {
  switch (status) {
    case 'COMPLETED':
      return (
        <Badge variant="success" size="sm" className={className}>
          {showIcon && <CheckCircle2 className="h-3 w-3 mr-1" />}
          Completed
        </Badge>
      )
    case 'IN_PROGRESS':
      return (
        <Badge variant="default" size="sm" className={className}>
          {showIcon && <PlayCircle className="h-3 w-3 mr-1" />}
          In Progress
        </Badge>
      )
    case 'CANCELLED':
      return (
        <Badge variant="neutral" size="sm" className={className}>
          {showIcon && <XCircle className="h-3 w-3 mr-1" />}
          Cancelled
        </Badge>
      )
    case 'PENDING':
    default:
      return (
        <Badge variant="warning" size="sm" className={className}>
          {showIcon && <Clock className="h-3 w-3 mr-1" />}
          Pending
        </Badge>
      )
  }
}
