import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare,
  Search,
  Filter,
  RotateCw,
  Kanban,
  Briefcase,
  X,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useTasks } from './api/tasks.api'
import {
  getTaskDueCategory,
  getTaskLead,
  getTaskClient,
  getTaskAdvisor,
  type Task,
} from '@/types/task.types'
import { TaskMetricsStrip } from './components/TaskMetricsStrip'
import { TaskItemRow } from './components/TaskItemRow'
import { TaskDetailModal } from './components/TaskDetailModal'
import { useAuth } from '@/hooks/useAuth'
import { validateForm, taskFilterSchema } from '@/lib/validation'

export function TasksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // State for search and filters
  const [search, setSearch] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState<string>('ALL')
  const [selectedDueCategory, setSelectedDueCategory] = React.useState<
    'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'NO_DUE_DATE'
  >('ALL')
  const [selectedPriority, setSelectedPriority] = React.useState<string>('ALL')
  const [selectedScope, setSelectedScope] = React.useState<
    'ALL' | 'MY_TASKS' | 'LEADS_ONLY' | 'CLIENTS_ONLY'
  >('ALL')

  // Selected task for detail modal
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  // Real backend tasks query
  const { data, isLoading, isError, error, refetch, isFetching } = useTasks()
  const tasks = data?.tasks || []

  // Validate filter state with Zod
  React.useEffect(() => {
    validateForm(taskFilterSchema, {
      search,
      status: selectedStatus,
      priority: selectedPriority,
      dueCategory: selectedDueCategory,
      scope: selectedScope,
    })
  }, [search, selectedStatus, selectedPriority, selectedDueCategory, selectedScope])

  // Filter tasks in memory for instantaneous client responsiveness
  const filteredTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      // 1. Status filter
      if (selectedStatus !== 'ALL' && task.status !== selectedStatus) {
        return false
      }

      // 2. Due Date Category filter
      if (selectedDueCategory !== 'ALL') {
        const cat = getTaskDueCategory(task)
        if (selectedDueCategory === 'OVERDUE') {
          if (!task.isOverdue && cat !== 'OVERDUE') return false
        } else if (cat !== selectedDueCategory) {
          return false
        }
      }

      // 3. Priority filter
      if (selectedPriority !== 'ALL' && task.priority !== selectedPriority) {
        return false
      }

      // 4. Scope filter
      if (selectedScope === 'MY_TASKS') {
        const advisor = getTaskAdvisor(task)
        if (!user?.id || advisor?.id !== user.id) {
          return false
        }
      } else if (selectedScope === 'LEADS_ONLY') {
        if (!task.leadId) return false
      } else if (selectedScope === 'CLIENTS_ONLY') {
        if (!task.clientId) return false
      }

      // 5. Search query filter
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const title = (task.title || '').toLowerCase()
        const description = (task.description || '').toLowerCase()
        const lead = getTaskLead(task)
        const client = getTaskClient(task)
        const advisor = getTaskAdvisor(task)

        const leadName = (lead?.name || '').toLowerCase()
        const clientName = (client?.name || '').toLowerCase()
        const advisorName = (advisor?.name || '').toLowerCase()

        if (
          !title.includes(q) &&
          !description.includes(q) &&
          !leadName.includes(q) &&
          !clientName.includes(q) &&
          !advisorName.includes(q)
        ) {
          return false
        }
      }

      return true
    })
  }, [tasks, search, selectedStatus, selectedDueCategory, selectedPriority, selectedScope, user?.id])

  // Sort tasks intelligently: Overdue first, then Due Today, then Upcoming, then Completed/Cancelled
  const sortedTasks = React.useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // Completed and cancelled go to the bottom
      const aDone = a.status === 'COMPLETED' || a.status === 'CANCELLED'
      const bDone = b.status === 'COMPLETED' || b.status === 'CANCELLED'
      if (aDone && !bDone) return 1
      if (!aDone && bDone) return -1

      // Overdue first
      const aOverdue = a.isOverdue || getTaskDueCategory(a) === 'OVERDUE'
      const bOverdue = b.isOverdue || getTaskDueCategory(b) === 'OVERDUE'
      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1

      // Due today second
      const aToday = getTaskDueCategory(a) === 'DUE_TODAY'
      const bToday = getTaskDueCategory(b) === 'DUE_TODAY'
      if (aToday && !bToday) return -1
      if (!aToday && bToday) return 1

      // Next sort by earliest due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      if (a.dueDate && !b.dueDate) return -1
      if (!a.dueDate && b.dueDate) return 1

      // Finally newest created first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [filteredTasks])

  const handleClearFilters = () => {
    setSearch('')
    setSelectedStatus('ALL')
    setSelectedDueCategory('ALL')
    setSelectedPriority('ALL')
    setSelectedScope('ALL')
  }

  const isFilterActive =
    Boolean(search.trim()) ||
    selectedStatus !== 'ALL' ||
    selectedDueCategory !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedScope !== 'ALL'

  const handleRowClick = (task: Task) => {
    setSelectedTask(task)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Advisor Action Items & Tasks
            </h1>
            <Badge variant="neutral" size="sm">
              {`${filteredTasks.length} ${filteredTasks.length === 1 ? 'Task' : 'Tasks'}`}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational follow-ups, borrower document verification milestones, and bank loan sanction deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="gap-1.5 text-xs text-slate-600"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/pipeline')}
            className="gap-1.5 text-xs"
          >
            <Kanban className="h-3.5 w-3.5" />
            <span>Pipeline</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/clients')}
            className="gap-1.5 text-xs"
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Client Cases</span>
          </Button>
        </div>
      </div>

      {/* 2. Automated Pipeline Trigger Callout Banner */}
      <div className="rounded-lg bg-gradient-to-r from-primary/5 via-slate-50 to-primary/5 border border-primary/15 p-3 flex items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-semibold text-slate-900">Automated Pipeline Scheduling: </span>
            <span className="text-muted-foreground">
              Tasks are automatically assigned by LeadFlow workflow triggers when mortgage leads transition stages (e.g., KYC Document Verification, Proposal Follow-Up, Sanction Letter Delivery).
            </span>
          </div>
        </div>
      </div>

      {/* 3. Top Metrics KPI Strip */}
      <TaskMetricsStrip
        tasks={tasks}
        selectedDueCategory={selectedDueCategory}
        selectedStatus={selectedStatus}
        onSelectDueCategory={(cat) => setSelectedDueCategory(cat)}
        onSelectStatus={(status) => setSelectedStatus(status)}
      />

      {/* 4. Search & Multi-Dimensional Filters Bar */}
      <Card className="p-3 border border-border/80 shadow-2xs bg-white space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by task title, description, borrower name, or advisor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-9"
              aria-label="Search tasks"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-slate-900"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                aria-label="Filter by task status"
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary hover:bg-slate-100 transition-colors h-9"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Due Category Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Due:</span>
              <select
                value={selectedDueCategory}
                onChange={(e) => setSelectedDueCategory(e.target.value as any)}
                aria-label="Filter by due timeline"
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary hover:bg-slate-100 transition-colors h-9"
              >
                <option value="ALL">All Due Dates</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="DUE_TODAY">Due Today</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="NO_DUE_DATE">No Deadline</option>
              </select>
            </div>

            {/* Priority Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Priority:</span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                aria-label="Filter by task priority"
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary hover:bg-slate-100 transition-colors h-9"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Scope Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Scope:</span>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value as any)}
                aria-label="Filter by task assignment scope"
                className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary hover:bg-slate-100 transition-colors h-9"
              >
                <option value="ALL">All Assignments</option>
                <option value="MY_TASKS">Assigned to Me</option>
                <option value="LEADS_ONLY">Inbound Leads Only</option>
                <option value="CLIENTS_ONLY">Client Cases Only</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {isFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-9 px-2"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 5. Main Task List Content */}
      {isLoading ? (
        <Card className="border border-border/80 divide-y divide-border/60 bg-white">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </Card>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Tasks"
          message={
            error instanceof Error
              ? error.message
              : 'Unable to retrieve tasks from the brokerage server. Please check your network and retry.'
          }
          onRetry={refetch}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-10 w-10 text-slate-300" />}
          title="No Operational Tasks Scheduled"
          description="Your brokerage currently has no pending or scheduled tasks. As leads advance through pipeline stages, automation triggers will automatically generate advisor action items here."
          action={
            <Button size="sm" onClick={() => navigate('/app/pipeline')} className="gap-1.5">
              <Kanban className="h-3.5 w-3.5" />
              <span>Go to Pipeline Board</span>
            </Button>
          }
        />
      ) : sortedTasks.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-8 w-8 text-slate-300" />}
          title="No Tasks Match Your Filters"
          description="Try adjusting your search criteria, clear status filters, or reset timeline restrictions to view tasks."
          action={
            <Button size="sm" variant="outline" onClick={handleClearFilters} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              <span>Clear Active Filters</span>
            </Button>
          }
        />
      ) : (
        <Card className="border border-border/80 shadow-2xs overflow-hidden bg-white">
          <div className="divide-y divide-border/60">
            {sortedTasks.map((task) => (
              <TaskItemRow
                key={task._id}
                task={task}
                onSelectTask={handleRowClick}
              />
            ))}
          </div>

          <div className="p-3 bg-slate-50/60 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {sortedTasks.length} of {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </span>
            <span className="text-[11px]">Click any row for complete task details & history</span>
          </div>
        </Card>
      )}

      {/* 6. Task Detail Slide-Over Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedTask(null)
        }}
      />
    </div>
  )
}
