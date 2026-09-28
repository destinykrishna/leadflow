import * as React from 'react'
import {
  Building2,
  Plus,
  Search,
  Filter,
  RotateCw,
  Copy,
  Check,
  Edit,
  Key,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { formatBrokerageName } from '@/lib/presentation'
import { useBrokeragesList } from './api/brokerages.api'
import { CreateBrokerageModal } from './components/CreateBrokerageModal'
import { OnboardingSuccessModal } from './components/OnboardingSuccessModal'
import { EditBrokerageModal } from './components/EditBrokerageModal'
import { RotateSecretModal } from './components/RotateSecretModal'
import { BrokerageDetailDrawer } from './components/BrokerageDetailDrawer'
import type {
  BrokerageItem,
  BrokeragePlan,
  BrokerageStatus,
  OnboardingResult,
} from '@/types/brokerage.types'

export function BrokeragesPage() {
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState<string>('ALL')
  const [selectedPlan, setSelectedPlan] = React.useState<string>('ALL')
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [onboardingData, setOnboardingData] = React.useState<OnboardingResult | null>(null)
  const [isOnboardingSuccessOpen, setIsOnboardingSuccessOpen] = React.useState(false)

  const [editingBrokerage, setEditingBrokerage] = React.useState<BrokerageItem | null>(null)
  const [rotatingBrokerage, setRotatingBrokerage] = React.useState<BrokerageItem | null>(null)
  const [inspectingBrokerageId, setInspectingBrokerageId] = React.useState<string | null>(null)

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 200)
    return () => clearTimeout(timer)
  }, [search])

  const { data: brokerages = [], isLoading, isError, error, refetch, isFetching } = useBrokeragesList()

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filter brokerages in memory (existing API returns all for platform admin)
  const filteredBrokerages = React.useMemo(() => {
    return brokerages.filter((b) => {
      // Status filter
      if (selectedStatus !== 'ALL' && b.status !== selectedStatus) {
        return false
      }
      // Plan filter
      if (selectedPlan !== 'ALL' && b.plan !== selectedPlan) {
        return false
      }
      // Search term filter
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase().trim()
        const matchesName = b.name.toLowerCase().includes(query)
        const matchesSlug = b.slug?.toLowerCase().includes(query)
        const matchesId = b._id.toLowerCase().includes(query)
        if (!matchesName && !matchesSlug && !matchesId) {
          return false
        }
      }
      return true
    })
  }, [brokerages, selectedStatus, selectedPlan, debouncedSearch])

  // Aggregate metrics
  const totalCount = brokerages.length
  const activeCount = brokerages.filter((b) => b.status === 'ACTIVE').length
  const trialCount = brokerages.filter((b) => b.status === 'TRIAL').length
  const suspendedCount = brokerages.filter((b) => b.status === 'SUSPENDED').length

  const hasActiveFilters = Boolean(
    search.trim() || selectedStatus !== 'ALL' || selectedPlan !== 'ALL'
  )

  const handleResetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setSelectedStatus('ALL')
    setSelectedPlan('ALL')
  }

  const handleCreateSuccess = (result: OnboardingResult) => {
    setIsCreateOpen(false)
    setOnboardingData(result)
    setIsOnboardingSuccessOpen(true)
    refetch()
  }

  const renderStatusBadge = (status: BrokerageStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>
      case 'TRIAL':
        return <Badge variant="warning">Trial</Badge>
      case 'SUSPENDED':
        return <Badge variant="danger">Suspended</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  const renderPlanBadge = (plan: BrokeragePlan) => {
    switch (plan) {
      case 'ENTERPRISE':
        return (
          <Badge
            variant="default"
            className="bg-purple-50 text-purple-700 border-purple-200 text-[11px]"
          >
            Enterprise
          </Badge>
        )
      case 'GROWTH':
        return (
          <Badge
            variant="default"
            className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]"
          >
            Growth
          </Badge>
        )
      case 'STARTER':
        return (
          <Badge variant="neutral" className="text-[11px]">
            Starter
          </Badge>
        )
      case 'FREE':
        return (
          <Badge variant="neutral" className="bg-slate-100 text-slate-600 text-[11px]">
            Free
          </Badge>
        )
      default:
        return <Badge variant="neutral">{plan}</Badge>
    }
  }

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Brokerage Directory
            </h1>
            <Badge variant="neutral" size="sm">
              {totalCount} Total
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage partner brokerage organizations, subscription plans, tenant isolation, and webhook credentials.
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
            <span>Create Brokerage</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5 border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Brokerages</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Building2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {isLoading ? <Skeleton className="h-6 w-10 inline-block" /> : totalCount}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Across platform
          </span>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800">Active Tenants</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            {isLoading ? <Skeleton className="h-6 w-10 inline-block" /> : activeCount}
          </div>
          <span className="text-[11px] text-emerald-700/80 mt-0.5 block">
            Full operational access
          </span>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Trial Accounts</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1">
            {isLoading ? <Skeleton className="h-6 w-10 inline-block" /> : trialCount}
          </div>
          <span className="text-[11px] text-amber-700/80 mt-0.5 block">
            Evaluation tier
          </span>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800">Suspended</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-700 mt-1">
            {isLoading ? <Skeleton className="h-6 w-10 inline-block" /> : suspendedCount}
          </div>
          <span className="text-[11px] text-rose-700/80 mt-0.5 block">
            Access revoked
          </span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-border/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by brokerage name, slug, or ID..."
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

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters:</span>
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="TRIAL">Trial Only</option>
            <option value="SUSPENDED">Suspended Only</option>
          </select>

          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Plans</option>
            <option value="ENTERPRISE">Enterprise</option>
            <option value="GROWTH">Growth</option>
            <option value="STARTER">Starter</option>
            <option value="FREE">Free</option>
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

      {/* Directory Table / Content */}
      {isLoading ? (
        <div className="rounded-xl border border-border/80 bg-white shadow-xs p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Brokerages"
          message={error instanceof Error ? error.message : 'An error occurred while fetching brokerages.'}
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : brokerages.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10 text-muted-foreground" />}
          title="No Brokerages Found"
          description="There are currently no partner brokerages onboarded to the platform."
          action={
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              Create First Brokerage
            </Button>
          }
        />
      ) : filteredBrokerages.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8 text-muted-foreground" />}
          title="No Matching Brokerages"
          description="No brokerage organizations match your active search or filter criteria."
          action={
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              Clear Filters
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border/80 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-slate-50/75 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Organization & Slug</th>
                  <th className="py-3 px-4">Subscription</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tenant ID</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBrokerages.map((b) => {
                  const displayName = formatBrokerageName(b.name)
                  const isSuspended = b.status === 'SUSPENDED'

                  return (
                    <tr
                      key={b._id}
                      onClick={() => setInspectingBrokerageId(b._id)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isSuspended ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Name & Slug */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs uppercase">
                            {displayName.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors block">
                              {displayName}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {b.slug ? `slug: ${b.slug}` : 'no slug set'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="py-3 px-4">
                        {renderPlanBadge(b.plan)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {renderStatusBadge(b.status)}
                      </td>

                      {/* Tenant ID */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                          <span>{b._id.slice(0, 8)}...</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(b._id, b._id, e)}
                            className="text-slate-400 hover:text-slate-700"
                            title="Copy full Brokerage ID"
                          >
                            {copiedId === b._id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Created */}
                      <td className="py-3 px-4 text-slate-600">
                        {formatDate(b.createdAt)}
                      </td>

                      {/* Updated Activity */}
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatRelativeTime(b.updatedAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectingBrokerageId(b._id)}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-primary gap-1"
                            title="View full credentials and profile"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">View</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingBrokerage(b)}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 gap-1"
                            title="Edit lifecycle or subscription plan"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Edit</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRotatingBrokerage(b)}
                            className="h-7 px-2 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1"
                            title="Rotate webhook secret"
                          >
                            <Key className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Secret</span>
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

      {/* Create Brokerage Modal */}
      <CreateBrokerageModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Onboarding Success Modal (surfacing returned credentials and webhook secret) */}
      <OnboardingSuccessModal
        isOpen={isOnboardingSuccessOpen}
        onClose={() => {
          setIsOnboardingSuccessOpen(false)
          setOnboardingData(null)
        }}
        data={onboardingData}
      />

      {/* Edit Brokerage Modal (status, plan, name, slug) */}
      <EditBrokerageModal
        isOpen={Boolean(editingBrokerage)}
        onClose={() => setEditingBrokerage(null)}
        brokerage={editingBrokerage}
      />

      {/* Rotate Secret Modal */}
      <RotateSecretModal
        isOpen={Boolean(rotatingBrokerage)}
        onClose={() => setRotatingBrokerage(null)}
        brokerage={rotatingBrokerage}
      />

      {/* Detail Slide-over Drawer */}
      <BrokerageDetailDrawer
        brokerageId={inspectingBrokerageId}
        isOpen={Boolean(inspectingBrokerageId)}
        onClose={() => setInspectingBrokerageId(null)}
        onEdit={(b) => {
          setInspectingBrokerageId(null)
          setEditingBrokerage(b)
        }}
        onRotateSecret={(b) => {
          setInspectingBrokerageId(null)
          setRotatingBrokerage(b)
        }}
      />
    </div>
  )
}
