export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export interface PopulatedUser {
  _id: string
  name: string
  email: string
  role?: string
}

export interface PopulatedLead {
  _id: string
  firstName: string
  lastName: string
  email?: string
  status?: string
}

export interface PopulatedClient {
  _id: string
  firstName?: string
  lastName?: string
  email?: string
  status?: string
}

export interface Task {
  _id: string
  brokerageId: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string | null
  assignedTo?: string | PopulatedUser | null
  leadId?: string | PopulatedLead | null
  clientId?: string | PopulatedClient | null
  triggerId?: string | null
  idempotencyKey?: string | null
  isOverdue?: boolean
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type DueCategory = 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'NO_DUE_DATE'

/**
 * Extracts linked lead details whether leadId is populated object or raw ID string
 */
export function getTaskLead(task: Task): { id: string; name: string; status?: string } | null {
  if (!task.leadId) return null
  if (typeof task.leadId === 'object' && '_id' in task.leadId) {
    const name = `${task.leadId.firstName || ''} ${task.leadId.lastName || ''}`.trim()
    return {
      id: task.leadId._id,
      name: name || 'Lead Record',
      status: task.leadId.status,
    }
  }
  return {
    id: String(task.leadId),
    name: 'Lead Record',
  }
}

/**
 * Extracts linked client details whether clientId is populated object or raw ID string
 */
export function getTaskClient(task: Task): { id: string; name: string } | null {
  if (!task.clientId) return null
  if (typeof task.clientId === 'object' && '_id' in task.clientId) {
    const name = `${task.clientId.firstName || ''} ${task.clientId.lastName || ''}`.trim()
    return {
      id: task.clientId._id,
      name: name || 'Client Case',
    }
  }
  return {
    id: String(task.clientId),
    name: 'Client Case',
  }
}

/**
 * Extracts assigned advisor details whether assignedTo is populated object or raw ID string
 */
export function getTaskAdvisor(task: Task): { id: string; name: string; email?: string } | null {
  if (!task.assignedTo) return null
  if (typeof task.assignedTo === 'object' && '_id' in task.assignedTo) {
    return {
      id: task.assignedTo._id,
      name: task.assignedTo.name || 'Advisor',
      email: task.assignedTo.email,
    }
  }
  return {
    id: String(task.assignedTo),
    name: 'Assigned Advisor',
  }
}

/**
 * Calculates due date category relative to midnight boundaries
 */
export function getTaskDueCategory(task: Task, referenceDate = new Date()): DueCategory {
  if (!task.dueDate) return 'NO_DUE_DATE'

  // If completed or cancelled, it does not count as active overdue/due-today
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    return 'NO_DUE_DATE'
  }

  const due = new Date(task.dueDate)
  if (isNaN(due.getTime())) return 'NO_DUE_DATE'

  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0,
  )
  const endOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    23,
    59,
    59,
    999,
  )

  if (due < startOfToday) {
    return 'OVERDUE'
  }
  if (due >= startOfToday && due <= endOfToday) {
    return 'DUE_TODAY'
  }
  return 'UPCOMING'
}
