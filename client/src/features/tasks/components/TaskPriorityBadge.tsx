import { Badge } from '@/components/ui/Badge'
import type { TaskPriority } from '@/types/task.types'

interface TaskPriorityBadgeProps {
  priority: TaskPriority
  className?: string
}

export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  switch (priority) {
    case 'URGENT':
      return (
        <Badge variant="danger" size="sm" className={className}>
          Urgent
        </Badge>
      )
    case 'HIGH':
      return (
        <Badge variant="warning" size="sm" className={className}>
          High
        </Badge>
      )
    case 'MEDIUM':
      return (
        <Badge variant="default" size="sm" className={className}>
          Medium
        </Badge>
      )
    case 'LOW':
    default:
      return (
        <Badge variant="neutral" size="sm" className={className}>
          Low
        </Badge>
      )
  }
}
