import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Search,
  Filter,
  User,
  ArrowRight,
  ExternalLink,
  RotateCw,
  Archive,
  RotateCcw,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatCurrency, formatRelativeTime } from '@/lib/format'
import {
  ORDERED_STAGES,
  STAGE_DEFINITIONS,
  type Lead,
  type LeadStatus,
} from '@/types/pipeline.types'
import { useLeadsList, useArchiveLead, useUnarchiveLead } from './api/leads.api'

export function LeadsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState<string>('ALL')
  const [viewScope, setViewScope] = React.useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const [page, setPage] = React.useState(1)
  const limit = 25

  // Debounce search input to avoid spamming server queries
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const isArchivedView = viewScope === 'ARCHIVED'

  const { data, isLoading, isError, error, refetch, isFetching } = useLeadsList({
    status: selectedStatus !== 'ALL' ? (selectedStatus as LeadStatus) : undefined,
    search: debouncedSearch.trim() || undefined,
    page,
    limit,
    includeArchived: isArchivedView ? true : undefined,
    isArchived: isArchivedView ? true : undefined,
  })

  const archiveMutation = useArchiveLead()
  const unarchiveMutation = useUnarchiveLead()

  const leads = data?.leads || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || Math.ceil(total / limit) || 1

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Lead Inquiries
            </h1>
            <Badge variant="neutral" size="sm">
              {total} Total
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review inbound prospective borrowers, mortgage qualification states, and advisor assignments.
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
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/pipeline')}
            className="gap-1.5 text-xs"
          >
            View Kanban Pipeline
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* View Scope Tabs, Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Toggle between Active and Archived */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-border/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setViewScope('ACTIVE')
              setPage(1)
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              !isArchivedView
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Inquiries
          </button>
          <button
            type="button"
            onClick={() => {
              setViewScope('ARCHIVED')
              setPage(1)
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
              isArchivedView
                ? 'bg-white text-amber-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="h-3.5 w-3.5 text-amber-600" />
            <span>Archived</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 sm:justify-end">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by borrower name, email, phone, or source..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-9 bg-white"
            />
          </div>

          {/* Status Dropdown Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setPage(1)
              }}
              className="rounded-md border border-border bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary h-9"
            >
              <option value="ALL">All Stages</option>
              {ORDERED_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_DEFINITIONS[s]?.label || s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isArchivedView && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              <strong>Archived Storage:</strong> These inquiries have been soft-deleted or archived and excluded from the active pipeline board. You can restore any lead inquiry to active status at any time.
            </span>
          </div>
        </div>
      )}

      {/* Main Leads Table / List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Leads"
          message={error instanceof Error ? error.message : 'Error fetching inquiries from server.'}
          onRetry={refetch}
        />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={isArchivedView ? <Archive className="h-8 w-8 text-amber-500" /> : <Users className="h-8 w-8 text-slate-400" />}
          title={
            isArchivedView
              ? (search ? 'No Matching Archived Inquiries' : 'No Archived Inquiries')
              : (search ? 'No Matching Inquiries' : 'No Inbound Leads')
          }
          description={
            isArchivedView
              ? (search
                  ? `No archived inquiries found matching "${search}".`
                  : 'Inquiries that you archive or soft-delete from the pipeline will be safely stored here.')
              : (search
                  ? `No inquiries found matching "${search}". Try clearing your search filters.`
                  : 'Prospects who submit financing inquiries through webhook forms will appear here.')
          }
          className="py-12"
        />
      ) : (
        <Card className="border border-border/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Borrower</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">Target Loan</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Assigned Advisor</th>
                  <th className="py-3 px-4 text-right">Inquiry Date</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {leads.map((lead: Lead) => {
                  const stageDef = STAGE_DEFINITIONS[lead.status]
                  const loanAmount = Number(lead.customFields?.loanAmount) || 0
                  const isConverted = Boolean(lead.convertedClientId)
                  const isAlreadyKnown = Boolean(
                    lead.customFields?.alreadyKnown ||
                      lead.customFields?.isAlreadyKnown ||
                      lead.customFields?.knownAs === 'CLIENT',
                  )
                  const assignedAdvisor =
                    typeof lead.assignedTo === 'object' && lead.assignedTo !== null
                      ? lead.assignedTo
                      : null

                  return (
                    <tr
                      key={lead._id}
                      onClick={() => navigate(`/app/leads/${lead._id}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Borrower Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900 group-hover:text-primary transition-colors">
                              <span>
                                {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
                              </span>
                              {isConverted && (
                                <Badge variant="success" size="sm" className="text-[9px] py-0 px-1">
                                  Case
                                </Badge>
                              )}
                              {isAlreadyKnown && (
                                <Badge variant="warning" size="sm" className="text-[9px] py-0 px-1">
                                  Known
                                </Badge>
                              )}
                              {lead.isArchived && (
                                <Badge variant="neutral" size="sm" className="text-[9px] py-0 px-1 border-amber-300 bg-amber-50 text-amber-800">
                                  Archived
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground block truncate max-w-[180px]">
                              {lead.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Stage Badge */}
                      <td className="py-3 px-4">
                        <Badge variant={stageDef?.badgeVariant || 'neutral'} size="sm">
                          {stageDef?.label || lead.status}
                        </Badge>
                      </td>

                      {/* Target Loan */}
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {loanAmount > 0 ? formatCurrency(loanAmount) : '—'}
                      </td>

                      {/* Score */}
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            lead.score >= 70
                              ? 'text-emerald-600'
                              : lead.score >= 40
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {lead.score}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4">
                        <Badge variant="neutral" size="sm" className="text-[10px]">
                          {lead.source}
                        </Badge>
                      </td>

                      {/* Advisor */}
                      <td className="py-3 px-4 text-slate-700">
                        {assignedAdvisor ? (
                          <span className="truncate block max-w-[140px] font-medium">
                            {assignedAdvisor.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {formatRelativeTime(lead.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/app/leads/${lead._id}`)
                            }}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-primary transition-colors"
                            title="Open Lead Workspace"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          {lead.isArchived ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                unarchiveMutation.mutate(lead._id)
                              }}
                              disabled={unarchiveMutation.isPending}
                              className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100/60 transition-colors"
                              title="Restore Lead to Pipeline"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (window.confirm(`Archive inquiry for ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')}?`)) {
                                  archiveMutation.mutate(lead._id)
                                }
                              }}
                              disabled={archiveMutation.isPending}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600 transition-colors"
                              title="Archive Lead"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Subtle Server-Side Pagination Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/80 px-4 py-3 bg-slate-50/50">
            <div className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-slate-800">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-semibold text-slate-800">{total}</span> inquiries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1 || isFetching}
                className="h-8 text-xs px-3 text-slate-700"
              >
                Previous
              </Button>
              <span className="text-xs font-medium text-slate-600 px-1">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages || isFetching}
                className="h-8 text-xs px-3 text-slate-700"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
