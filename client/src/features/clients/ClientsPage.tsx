import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase,
  Search,
  Filter,
  ArrowRight,
  Kanban,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatRelativeTime } from '@/lib/format'
import { useClients } from './api/clients.api'
import type { Client, ClientType, ClientStatus } from '@/types/client.types'

const CLIENT_TYPE_CONFIG: Record<
  ClientType,
  { label: string; badgeVariant: 'default' | 'success' | 'warning' | 'neutral' }
> = {
  BUYER: { label: 'Buyer', badgeVariant: 'default' },
  SELLER: { label: 'Seller', badgeVariant: 'warning' },
  BOTH: { label: 'Buyer & Seller', badgeVariant: 'success' },
  OTHER: { label: 'Other', badgeVariant: 'neutral' },
}

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; badgeVariant: 'success' | 'neutral' | 'danger' }
> = {
  ACTIVE: { label: 'Active', badgeVariant: 'success' },
  INACTIVE: { label: 'Inactive', badgeVariant: 'neutral' },
  ARCHIVED: { label: 'Archived', badgeVariant: 'neutral' },
}

export function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState<string>('ALL')
  const [selectedType, setSelectedType] = React.useState<string>('ALL')

  const { data: clients = [], isLoading, isError, error, refetch } = useClients()

  // Filter clients in memory based on search query, status, and profile type
  const filteredClients = React.useMemo(() => {
    return clients.filter((client) => {
      // Status filter
      if (selectedStatus !== 'ALL' && client.status !== selectedStatus) {
        return false
      }

      // Type filter
      if (selectedType !== 'ALL' && client.type !== selectedType) {
        return false
      }

      // Search query filter
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const fullName = `${client.firstName} ${client.lastName}`.toLowerCase()
        const email = (client.email || '').toLowerCase()
        const phone = (client.phone || '').toLowerCase()
        const city = (client.address?.city || '').toLowerCase()

        if (
          !fullName.includes(q) &&
          !email.includes(q) &&
          !phone.includes(q) &&
          !city.includes(q)
        ) {
          return false
        }
      }

      return true
    })
  }, [clients, search, selectedStatus, selectedType])

  // Summary Metrics
  const totalCount = clients.length
  const activeCount = clients.filter((c) => c.status === 'ACTIVE').length
  const buyersCount = clients.filter((c) => c.type === 'BUYER').length
  const sellersDualCount = clients.filter((c) => c.type === 'SELLER' || c.type === 'BOTH').length

  const handleClearFilters = () => {
    setSearch('')
    setSelectedStatus('ALL')
    setSelectedType('ALL')
  }

  return (
    <div className="space-y-4">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Clients & Mortgage Cases
            </h1>
            <Badge variant="neutral" size="sm">
              {filteredClients.length} Cases
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active borrower files, financing requirements, documentation progress, and advisor assignments.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/leads')}
            className="gap-1.5 text-xs"
          >
            <Users className="h-3.5 w-3.5" />
            Inbound Leads
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/pipeline')}
            className="gap-1.5 text-xs"
          >
            <Kanban className="h-3.5 w-3.5" />
            Kanban Pipeline
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border border-border/80 shadow-2xs bg-white">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Total Cases
          </span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">{totalCount}</span>
        </Card>

        <Card className="p-3 border border-border/80 shadow-2xs bg-white">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Active Files
          </span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">{activeCount}</span>
        </Card>

        <Card className="p-3 border border-border/80 shadow-2xs bg-white">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Home Buyers
          </span>
          <span className="text-xl font-bold text-primary mt-1 block">{buyersCount}</span>
        </Card>

        <Card className="p-3 border border-border/80 shadow-2xs bg-white">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Sellers & Dual
          </span>
          <span className="text-xl font-bold text-amber-600 mt-1 block">{sellersDualCount}</span>
        </Card>
      </div>

      {/* 3. Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by client name, email, phone, or city..."
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
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Cases</option>
            <option value="INACTIVE">Inactive Cases</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* Profile Type Dropdown Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary h-9"
          >
            <option value="ALL">All Client Types</option>
            <option value="BUYER">Buyers</option>
            <option value="SELLER">Sellers</option>
            <option value="BOTH">Buyer & Seller</option>
            <option value="OTHER">Other / Special</option>
          </select>
        </div>
      </div>

      {/* 4. Main Clients Table / Card List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Clients"
          message={error instanceof Error ? error.message : 'Error fetching client cases from server.'}
          onRetry={refetch}
        />
      ) : filteredClients.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-8 w-8 text-slate-400" />}
          title={search || selectedStatus !== 'ALL' || selectedType !== 'ALL' ? 'No Matching Cases' : 'No Active Cases'}
          description={
            search || selectedStatus !== 'ALL' || selectedType !== 'ALL'
              ? 'No mortgage cases found matching your filters. Try adjusting or clearing search criteria.'
              : 'Converted qualified leads will appear here as active client case files.'
          }
          action={
            search || selectedStatus !== 'ALL' || selectedType !== 'ALL' ? (
              <Button variant="outline" size="sm" onClick={handleClearFilters} className="text-xs">
                Clear Filters
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/app/pipeline')}
                className="gap-1.5 text-xs"
              >
                Go to Pipeline
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )
          }
          className="py-12"
        />
      ) : (
        <Card className="border border-border/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Borrower / Client</th>
                  <th className="py-3 px-4">Profile Type</th>
                  <th className="py-3 px-4">Case Status</th>
                  <th className="py-3 px-4">Inquiry Origin</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Advisor</th>
                  <th className="py-3 px-4 text-right">Created</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredClients.map((client: Client) => {
                  const initials =
                    `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase() || 'CL'
                  const typeConfig = CLIENT_TYPE_CONFIG[client.type] || CLIENT_TYPE_CONFIG.OTHER
                  const statusConfig = STATUS_CONFIG[client.status] || STATUS_CONFIG.ACTIVE
                  const hasLeadOrigin = Boolean(client.leadId)
                  const hasPortalUser = Boolean(client.userId)

                  const advisorName =
                    typeof client.assignedTo === 'object' && client.assignedTo !== null
                      ? client.assignedTo.name
                      : null

                  return (
                    <tr
                      key={client._id}
                      onClick={() => navigate(`/app/clients/${client._id}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Borrower Name, Avatar, & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700 text-xs group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900 group-hover:text-primary transition-colors">
                              <span>
                                {client.firstName} {client.lastName}
                              </span>
                              {hasPortalUser && (
                                <span title="Borrower portal account linked">
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground block truncate max-w-[180px]">
                              {client.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Profile Type */}
                      <td className="py-3 px-4">
                        <Badge variant={typeConfig.badgeVariant} size="sm">
                          {typeConfig.label}
                        </Badge>
                      </td>

                      {/* Case Status */}
                      <td className="py-3 px-4">
                        <Badge variant={statusConfig.badgeVariant} size="sm">
                          {statusConfig.label}
                        </Badge>
                      </td>

                      {/* Lead Origin */}
                      <td className="py-3 px-4">
                        {hasLeadOrigin ? (
                          <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <Briefcase className="h-3 w-3 text-emerald-600" />
                            <span>Converted Lead</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Direct File</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 text-slate-700">
                        {client.address?.city ? (
                          <span>{client.address.city}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Assigned Advisor */}
                      <td className="py-3 px-4 text-slate-700">
                        {advisorName ? (
                          <span className="font-medium">{advisorName}</span>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">Brokerage Pool</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-right text-muted-foreground text-[11px]">
                        {formatRelativeTime(client.createdAt)}
                      </td>

                      {/* Open Action */}
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/app/clients/${client._id}`)
                          }}
                          className="h-7 px-2 text-xs gap-1 text-primary group-hover:bg-primary/10"
                        >
                          Workspace
                          <ArrowRight className="h-3 w-3" />
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
