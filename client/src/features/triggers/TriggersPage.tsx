import * as React from 'react'
import {
  Zap,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import {
  useTriggers,
  useToggleTrigger,
  useDeleteTrigger,
} from './api/triggers.api'
import { useEmailTemplates } from '@/features/templates/api/templates.api'
import { TriggerNavigationTabs } from './components/TriggerNavigationTabs'
import { TriggerMetricsStrip } from './components/TriggerMetricsStrip'
import { TriggerItemCard } from './components/TriggerItemCard'
import { CreateTriggerModal } from './components/CreateTriggerModal'
import { EmailPreviewModal } from '@/features/templates/components/EmailPreviewModal'
import type {
  IPipelineTrigger,
  TriggerFilterValues,
  TriggerActionType,
} from '@/types/trigger.types'

export function TriggersPage() {
  const { user } = useAuth()
  const canMutate = user?.role === 'BROKERAGE_ADMIN' || user?.role === 'PLATFORM_ADMIN'

  const {
    data: triggers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTriggers()

  const { data: templates = [] } = useEmailTemplates()
  const toggleMutation = useToggleTrigger()
  const deleteMutation = useDeleteTrigger()

  const [togglingId, setTogglingId] = React.useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [previewTemplate, setPreviewTemplate] = React.useState<{
    name: string
    slug?: string
    subject: string
    body: string
  } | null>(null)

  // Filters
  const [filters, setFilters] = React.useState<TriggerFilterValues>({
    search: '',
    actionType: 'ALL',
    stage: 'ALL',
    status: 'ALL',
  })

  const handleFilterChange = (updates: Partial<TriggerFilterValues>) => {
    setFilters((prev) => ({ ...prev, ...updates }))
  }

  const handleResetFilters = () => {
    setFilters({
      search: '',
      actionType: 'ALL',
      stage: 'ALL',
      status: 'ALL',
    })
  }

  // Handle status toggle
  const handleToggleStatus = async (trigger: IPipelineTrigger) => {
    if (!canMutate) return
    setTogglingId(trigger._id)
    try {
      await toggleMutation.mutateAsync({
        id: trigger._id,
        isActive: !trigger.isActive,
      })
    } finally {
      setTogglingId(null)
    }
  }

  // Handle delete
  const handleDeleteTrigger = async (id: string) => {
    if (!canMutate) return
    if (window.confirm('Are you sure you want to delete this stage automation rule?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  // Filtered triggers list
  const filteredTriggers = React.useMemo(() => {
    return triggers.filter((trigger) => {
      // 1. Search term
      if (filters.search) {
        const query = filters.search.toLowerCase()
        const matchesName = trigger.name.toLowerCase().includes(query)
        const matchesToStage = trigger.toStage.toLowerCase().includes(query)
        const matchesFromStage = trigger.fromStage?.toLowerCase().includes(query)
        const matchesTaskTitle = trigger.actionConfig?.taskTitle?.toLowerCase().includes(query)
        if (!matchesName && !matchesToStage && !matchesFromStage && !matchesTaskTitle) {
          return false
        }
      }

      // 2. Action Type
      if (filters.actionType !== 'ALL' && trigger.actionType !== filters.actionType) {
        return false
      }

      // 3. Stage
      if (filters.stage !== 'ALL' && trigger.toStage !== filters.stage) {
        return false
      }

      // 4. Status
      if (filters.status === 'ACTIVE' && !trigger.isActive) return false
      if (filters.status === 'PAUSED' && trigger.isActive) return false

      return true
    })
  }, [triggers, filters])

  const hasActiveFilters =
    filters.search !== '' ||
    filters.actionType !== 'ALL' ||
    filters.stage !== 'ALL' ||
    filters.status !== 'ALL'

  return (
    <div className="space-y-4">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Stage Automations
            </h1>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
              {triggers.length} {triggers.length === 1 ? 'Rule' : 'Rules'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Automated mortgage advisor tasks and client emails triggered on pipeline stage transitions
          </p>
        </div>

        {canMutate && (
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 self-start sm:self-auto shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Automation</span>
          </Button>
        )}
      </div>

      {/* Unified Tab Switcher */}
      <TriggerNavigationTabs triggersCount={triggers.length} templatesCount={templates.length} />

      {/* KPI Metrics Strip */}
      <TriggerMetricsStrip
        triggers={triggers}
        templatesCount={templates.length}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              placeholder="Search by rule name, stage, or task..."
              className="w-full rounded-lg border border-border bg-slate-50/60 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Action Type Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={filters.actionType}
              onChange={(e) =>
                handleFilterChange({ actionType: e.target.value as 'ALL' | TriggerActionType })
              }
              aria-label="Filter by action type"
              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-hidden"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE_TASK">Auto-Create Task</option>
              <option value="SEND_EMAIL">Send Email</option>
            </select>
          </div>

          {/* Stage Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <select
              value={filters.stage}
              onChange={(e) => handleFilterChange({ stage: e.target.value })}
              aria-label="Filter by pipeline stage"
              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-hidden"
            >
              <option value="ALL">All Stages</option>
              <option value="NEW">New Lead</option>
              <option value="CONTACTED">Contacted</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="PROPOSAL">Proposal</option>
              <option value="NEGOTIATION">Negotiation</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <select
              value={filters.status}
              onChange={(e) =>
                handleFilterChange({ status: e.target.value as 'ALL' | 'ACTIVE' | 'PAUSED' })
              }
              aria-label="Filter by trigger status"
              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-hidden"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="PAUSED">Paused Only</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-8 text-xs text-slate-500 hover:text-slate-900"
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-24 rounded-xl border border-border bg-card p-4 animate-pulse space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="h-5 w-32 rounded bg-slate-200" />
                <div className="h-5 w-24 rounded-full bg-slate-200" />
              </div>
              <div className="h-4 w-64 rounded bg-slate-200" />
              <div className="h-3 w-48 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
          <h3 className="text-sm font-bold text-rose-900">Failed to Load Stage Automations</h3>
          <p className="text-xs text-rose-600 mt-1">
            {error instanceof Error ? error.message : 'An error occurred while fetching triggers.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-3 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : filteredTriggers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            {hasActiveFilters ? <SlidersHorizontal className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900">
            {hasActiveFilters ? 'No Matching Automation Rules' : 'No Stage Automations Configured'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your search criteria or resetting filters to see other configured rules.'
              : 'Configure automated advisor task reminders and client notification emails for each pipeline stage.'}
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="mt-4 text-xs"
            >
              Clear Filters
            </Button>
          ) : canMutate ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create First Automation</span>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTriggers.map((trigger) => (
            <TriggerItemCard
              key={trigger._id}
              trigger={trigger}
              canMutate={canMutate}
              isToggling={togglingId === trigger._id}
              onToggleStatus={handleToggleStatus}
              onDeleteTrigger={handleDeleteTrigger}
              onPreviewTemplate={setPreviewTemplate}
            />
          ))}
        </div>
      )}

      {/* Create Trigger Modal */}
      {canMutate && (
        <CreateTriggerModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        template={previewTemplate}
      />
    </div>
  )
}
