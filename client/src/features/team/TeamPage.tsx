import * as React from 'react'
import {
  Users,
  Plus,
  Search,
  Filter,
  RotateCw,
  UserCheck,
  UserX,
  Edit,
  Phone,
  FileSpreadsheet,
  X,
  Briefcase,
  Copy,
  Check,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDate } from '@/lib/format'
import { formatUserEmail } from '@/lib/presentation'
import { useAdvisorsList, useAdvisorWorkload } from './api/team.api'
import { CreateAdvisorModal } from './components/CreateAdvisorModal'
import { AdvisorCreatedSuccessModal } from './components/AdvisorCreatedSuccessModal'
import { EditAdvisorModal } from './components/EditAdvisorModal'
import { DeactivateAdvisorConfirmModal } from './components/DeactivateAdvisorConfirmModal'
import { LeadSourceSetupCard } from './components/LeadSourceSetupCard'
import type { AdvisorItem } from '@/types/advisor.types'

type ActiveTab = 'advisors' | 'lead-source'

export function TeamPage() {
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('advisors')

  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState<string>('ALL')
  const [copiedEmail, setCopiedEmail] = React.useState<string | null>(null)

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [createdAdvisor, setCreatedAdvisor] = React.useState<AdvisorItem | null>(null)
  const [createdPassword, setCreatedPassword] = React.useState<string | undefined>()
  const [isSuccessOpen, setIsSuccessOpen] = React.useState(false)

  const [editingAdvisor, setEditingAdvisor] = React.useState<AdvisorItem | null>(null)
  const [deactivatingAdvisor, setDeactivatingAdvisor] = React.useState<AdvisorItem | null>(null)

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 200)
    return () => clearTimeout(timer)
  }, [search])

  const {
    data: paginatedData,
    isLoading,
    isError,
    error,
    refetch: refetchAdvisors,
    isFetching,
  } = useAdvisorsList({
    status: selectedStatus !== 'ALL' ? (selectedStatus as 'ACTIVE' | 'INACTIVE') : undefined,
    search: debouncedSearch.trim() || undefined,
  })

  const {
    data: workloadData,
    isLoading: isWorkloadLoading,
    refetch: refetchWorkload,
  } = useAdvisorWorkload()

  const refetch = () => {
    refetchAdvisors()
    refetchWorkload()
  }

  const advisors = paginatedData?.advisors || []
  const totalCount = paginatedData?.total || 0

  // Index server-side aggregated workload metrics by advisorId
  const workloadByAdvisorId = React.useMemo(() => {
    const map = new Map<string, any>()
    if (workloadData?.advisors) {
      for (const item of workloadData.advisors) {
        map.set(item.advisorId, item)
      }
    }
    return map
  }, [workloadData])

  // Summary counts from server aggregation
  const activeCount = advisors.filter((a) => a.status === 'ACTIVE').length
  const inactiveCount = advisors.filter((a) => a.status === 'INACTIVE').length
  const totalActiveAssignedLeads = workloadData?.summary.totalActiveAssignedLeads ?? 0
  const totalPendingTasks = workloadData?.summary.totalPendingTasks ?? 0
  const totalOverdueTasks = workloadData?.summary.totalOverdueTasks ?? 0

  const handleCopyEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(email)
    setCopiedEmail(email)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  const handleResetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setSelectedStatus('ALL')
  }

  const handleCreateSuccess = (advisor: AdvisorItem, password?: string) => {
    setIsCreateOpen(false)
    setCreatedAdvisor(advisor)
    setCreatedPassword(password)
    setIsSuccessOpen(true)
    refetch()
  }

  const hasActiveFilters = Boolean(search.trim() || selectedStatus !== 'ALL')

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Advisors & Lead Sources
            </h1>
            <Badge variant="neutral" size="sm">
              {totalCount} Advisors
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your mortgage advisory team, assignment capacity, and inbound Google Forms lead integration.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs text-slate-600"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Onboard Advisor</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('advisors')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'advisors'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-slate-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Advisors Directory</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lead-source')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'lead-source'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Google Forms Lead Source</span>
        </button>
      </div>

      {/* Tab 1: Advisors Directory */}
      {activeTab === 'advisors' && (
        <div className="space-y-4">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-3.5 border-border/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Advisors</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Users className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {isLoading ? <Skeleton className="h-6 w-8 inline-block" /> : totalCount}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Brokerage team
              </span>
            </Card>

            <Card className="p-3.5 border-border/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-800">Active Advisors</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <UserCheck className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {isLoading ? <Skeleton className="h-6 w-8 inline-block" /> : activeCount}
              </div>
              <span className="text-[11px] text-emerald-700/80 mt-0.5 block">
                Available for assignment
              </span>
            </Card>

            <Card className="p-3.5 border-border/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Inactive Accounts</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <UserX className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-700 mt-1">
                {isLoading ? <Skeleton className="h-6 w-8 inline-block" /> : inactiveCount}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Access suspended
              </span>
            </Card>

            <Card className="p-3.5 border-border/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-800">Active Pipeline Leads</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Briefcase className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-xl font-bold text-blue-700 mt-1">
                {isLoading || isWorkloadLoading ? (
                  <Skeleton className="h-6 w-8 inline-block" />
                ) : (
                  totalActiveAssignedLeads
                )}
              </div>
              <span className="text-[11px] text-blue-700/80 mt-0.5 block">
                {totalPendingTasks} pending tasks ({totalOverdueTasks} overdue)
              </span>
            </Card>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-border/80 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search advisor by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-input bg-background pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                <span>Status:</span>
              </div>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs text-slate-500 hover:text-slate-900 h-8 px-2"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Advisors Table */}
          {isLoading ? (
            <div className="rounded-xl border border-border/80 bg-white shadow-xs p-4 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : isError ? (
            <ErrorState
              title="Failed to Load Advisors"
              message={
                error instanceof Error
                  ? error.message
                  : 'An error occurred while fetching advisors for your brokerage.'
              }
              action={
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            />
          ) : advisors.length === 0 ? (
            hasActiveFilters ? (
              <EmptyState
                icon={<Search className="h-8 w-8 text-muted-foreground" />}
                title="No Matching Advisors"
                description="No advisors match your active search or status filter."
                action={
                  <Button variant="outline" size="sm" onClick={handleResetFilters}>
                    Clear Filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users className="h-10 w-10 text-muted-foreground" />}
                title="No Advisors Onboarded Yet"
                description="Your brokerage organization has not added any mortgage advisors yet."
                action={
                  <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                    Onboard First Advisor
                  </Button>
                }
              />
            )
          ) : (
            <div className="rounded-xl border border-border/80 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/80 bg-slate-50/75 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Advisor Name & Email</th>
                      <th className="py-3 px-4">Contact Phone</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Workload & Pipeline</th>
                      <th className="py-3 px-4">Onboarded</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {advisors.map((advisor) => {
                      const advisorId = advisor.id || advisor._id || ''
                      const isInactive = advisor.status === 'INACTIVE'

                      return (
                        <tr
                          key={advisorId}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isInactive ? 'bg-slate-50/40 text-slate-500' : ''
                          }`}
                        >
                          {/* Name & Email */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs uppercase ${
                                  isInactive
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-primary/10 text-primary'
                                }`}
                              >
                                {advisor.name.slice(0, 2)}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-900 block">
                                  {advisor.name}
                                </span>
                                <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                                  <span>{formatUserEmail(advisor.email)}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyEmail(advisor.email, e)}
                                    className="text-slate-400 hover:text-slate-700"
                                    title="Copy Email"
                                  >
                                    {copiedEmail === advisor.email ? (
                                      <Check className="h-3 w-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className="py-3 px-4">
                            {advisor.phone ? (
                              <a
                                href={`tel:${advisor.phone}`}
                                className="text-slate-700 hover:text-primary transition-colors flex items-center gap-1"
                              >
                                <Phone className="h-3 w-3 text-slate-400" />
                                <span>{advisor.phone}</span>
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {advisor.status === 'ACTIVE' ? (
                              <Badge variant="success" size="sm">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="sm" className="bg-slate-100 text-slate-600">
                                Inactive
                              </Badge>
                            )}
                          </td>

                          {/* Workload (Server Aggregated) */}
                          <td className="py-3 px-4">
                            {(() => {
                              const workload = workloadByAdvisorId.get(advisorId)
                              const activeLeads = workload?.activeLeadsCount ?? 0
                              const wonCases = workload?.wonCasesCount ?? 0
                              const pendingTasks = workload?.pendingTasksCount ?? 0
                              const overdueTasks = workload?.overdueTasksCount ?? 0

                              return (
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="font-semibold text-slate-900">
                                      {activeLeads}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                      {activeLeads === 1 ? 'lead' : 'leads'}
                                    </span>
                                    {wonCases > 0 && (
                                      <span className="text-[11px] text-emerald-700 font-medium">
                                        • {wonCases} won
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    <span>{pendingTasks} tasks</span>
                                    {overdueTasks > 0 && (
                                      <span className="text-rose-600 font-semibold ml-1">
                                        ({overdueTasks} overdue)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })()}
                          </td>

                          {/* Created */}
                          <td className="py-3 px-4 text-slate-600">
                            {formatDate(advisor.createdAt)}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingAdvisor(advisor)}
                                className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 gap-1"
                                title="Edit profile and contact details"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeactivatingAdvisor(advisor)}
                                className={`h-7 px-2 text-xs gap-1 ${
                                  advisor.status === 'ACTIVE'
                                    ? 'text-amber-700 hover:text-amber-800 hover:bg-amber-50'
                                    : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
                                }`}
                                title={
                                  advisor.status === 'ACTIVE'
                                    ? 'Deactivate advisor account'
                                    : 'Reactivate advisor account'
                                }
                              >
                                {advisor.status === 'ACTIVE' ? (
                                  <>
                                    <UserX className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Reactivate</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Lead Source & Google Forms Setup */}
      {activeTab === 'lead-source' && <LeadSourceSetupCard />}

      {/* Create Advisor Modal */}
      <CreateAdvisorModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Onboarded Success Modal */}
      <AdvisorCreatedSuccessModal
        isOpen={isSuccessOpen}
        onClose={() => {
          setIsSuccessOpen(false)
          setCreatedAdvisor(null)
          setCreatedPassword(undefined)
        }}
        advisor={createdAdvisor}
        temporaryPassword={createdPassword}
      />

      {/* Edit Advisor Modal */}
      <EditAdvisorModal
        isOpen={Boolean(editingAdvisor)}
        onClose={() => setEditingAdvisor(null)}
        advisor={editingAdvisor}
      />

      {/* Deactivate/Reactivate Confirm Modal */}
      <DeactivateAdvisorConfirmModal
        isOpen={Boolean(deactivatingAdvisor)}
        onClose={() => setDeactivatingAdvisor(null)}
        advisor={deactivatingAdvisor}
      />
    </div>
  )
}
