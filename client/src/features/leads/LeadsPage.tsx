import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Search,
  Filter,
  User,
  ArrowRight,
  ExternalLink,
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
import { useLeadsList } from './api/leads.api'

export function LeadsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState<string>('ALL')

  const { data, isLoading, isError, error, refetch } = useLeadsList({
    status: selectedStatus !== 'ALL' ? (selectedStatus as LeadStatus) : undefined,
    search: search.trim() || undefined,
  })

  const leads = data?.leads || []

  // Filter leads in memory if search query entered
  const filteredLeads = React.useMemo(() => {
    if (!search.trim()) return leads
    const q = search.toLowerCase().trim()
    return leads.filter(
      (l) =>
        l.firstName.toLowerCase().includes(q) ||
        l.lastName.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.phone && l.phone.includes(q)) ||
        (l.source && l.source.toLowerCase().includes(q)),
    )
  }, [leads, search])

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
              {filteredLeads.length} Total
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review inbound prospective borrowers, mortgage qualification states, and advisor assignments.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/app/pipeline')}
          className="gap-1.5 text-xs self-start sm:self-auto"
        >
          View Kanban Pipeline
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
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
            onChange={(e) => setSelectedStatus(e.target.value)}
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
      ) : filteredLeads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-slate-400" />}
          title={search ? 'No Matching Inquiries' : 'No Inbound Leads'}
          description={
            search
              ? `No inquiries found matching "${search}". Try clearing your search filters.`
              : 'Prospects who submit financing inquiries through webhook forms will appear here.'
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
                {filteredLeads.map((lead: Lead) => {
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
                                {lead.firstName} {lead.lastName}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/app/leads/${lead._id}`)
                          }}
                          className="h-7 w-7 p-0 text-slate-400 group-hover:text-primary transition-colors"
                          title="Open Lead Workspace"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
