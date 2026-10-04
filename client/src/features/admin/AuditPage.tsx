import * as React from 'react'
import {
  ShieldAlert,
  Filter,
  RefreshCw,
  Clock,
  User,
  Activity,
  Layers,
  Sparkles,
  Award,
  Upload,
  CheckCircle2,
  XCircle,
  CheckSquare,
  Mail,
  RotateCcw,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { formatRelativeTime, formatDate } from '@/lib/format'
import { useAuditLogs } from './api/audit.api'
import type { ActivityAction, ActivityEntityType, ActivityLogItem } from '@/types/activity.types'

const ACTION_FILTER_OPTIONS: { label: string; value: ActivityAction | '' }[] = [
  { label: 'All Actions', value: '' },
  { label: 'Stage Changed', value: 'STAGE_CHANGED' },
  { label: 'Inquiry Created', value: 'LEAD_CREATED' },
  { label: 'Advisor Assigned', value: 'ADVISOR_ASSIGNED' },
  { label: 'Inquiry Reopened', value: 'LEAD_REOPENED' },
  { label: 'Lead Converted', value: 'LEAD_CONVERTED' },
  { label: 'Document Uploaded', value: 'DOCUMENT_UPLOADED' },
  { label: 'Document Verified', value: 'DOCUMENT_VERIFIED' },
  { label: 'Document Rejected', value: 'DOCUMENT_REJECTED' },
  { label: 'Task Completed', value: 'TASK_COMPLETED' },
  { label: 'Email Dispatched', value: 'EMAIL_SENT' },
  { label: 'Note Added', value: 'NOTE_ADDED' },
  { label: 'Task Created', value: 'TASK_CREATED' },
]

const ENTITY_FILTER_OPTIONS: { label: string; value: ActivityEntityType | '' }[] = [
  { label: 'All Entities', value: '' },
  { label: 'Lead Inquiry', value: 'LEAD' },
  { label: 'Client Case', value: 'CLIENT' },
  { label: 'Document', value: 'DOCUMENT' },
  { label: 'Advisor Task', value: 'TASK' },
  { label: 'Email Log', value: 'EMAIL' },
]

function getActionBadge(action: ActivityAction) {
  switch (action) {
    case 'LEAD_CREATED':
      return { variant: 'neutral' as const, label: 'Inquiry Created', icon: Sparkles }
    case 'STAGE_CHANGED':
      return { variant: 'default' as const, label: 'Stage Changed', icon: Layers }
    case 'ADVISOR_ASSIGNED':
      return { variant: 'neutral' as const, label: 'Advisor Assigned', icon: UserCheck }
    case 'LEAD_REOPENED':
      return { variant: 'warning' as const, label: 'Lead Reopened', icon: RotateCcw }
    case 'LEAD_CONVERTED':
      return { variant: 'success' as const, label: 'Case Converted', icon: Award }
    case 'DOCUMENT_UPLOADED':
      return { variant: 'neutral' as const, label: 'Doc Uploaded', icon: Upload }
    case 'DOCUMENT_VERIFIED':
      return { variant: 'success' as const, label: 'Doc Verified', icon: CheckCircle2 }
    case 'DOCUMENT_REJECTED':
      return { variant: 'danger' as const, label: 'Doc Rejected', icon: XCircle }
    case 'TASK_COMPLETED':
      return { variant: 'success' as const, label: 'Task Completed', icon: CheckSquare }
    case 'EMAIL_SENT':
      return { variant: 'neutral' as const, label: 'Email Sent', icon: Mail }
    case 'NOTE_ADDED':
      return { variant: 'warning' as const, label: 'Note Added', icon: FileText }
    case 'TASK_CREATED':
      return { variant: 'default' as const, label: 'Task Created', icon: CheckSquare }
    default:
      return { variant: 'neutral' as const, label: action, icon: Activity }
  }
}

export function AuditPage() {
  const [page, setPage] = React.useState(1)
  const [selectedAction, setSelectedAction] = React.useState<ActivityAction | ''>('')
  const [selectedEntity, setSelectedEntity] = React.useState<ActivityEntityType | ''>('')
  const [inspectItem, setInspectItem] = React.useState<ActivityLogItem | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useAuditLogs({
    page,
    limit: 25,
    action: selectedAction || undefined,
    entityType: selectedEntity || undefined,
  })

  const activities = (data?.data as ActivityLogItem[]) || []
  const pagination = data?.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 }

  const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAction(e.target.value as ActivityAction | '')
    setPage(1)
  }

  const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEntity(e.target.value as ActivityEntityType | '')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Security & Activity Logs
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Immutable audit trail of pipeline stage movements, document verification decisions, and user actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 px-2.5 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 border border-border/80 shadow-2xs bg-white">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Filters:
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto flex-1">
            <Select
              value={selectedAction}
              onChange={handleActionChange}
              aria-label="Filter by activity action"
              className="h-8"
            >
              {ACTION_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>

            <Select
              value={selectedEntity}
              onChange={handleEntityChange}
              aria-label="Filter by entity type"
              className="h-8"
            >
              {ENTITY_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {(selectedAction || selectedEntity) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedAction('')
                setSelectedEntity('')
                setPage(1)
              }}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-slate-900"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="border border-border/80 shadow-2xs bg-white overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900">
              Recorded Events ({pagination.total})
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-6">
              <ErrorState
                title="Failed to Load Audit Logs"
                message={(error as Error)?.message || 'An unexpected error occurred while querying audit records.'}
                onRetry={() => { refetch(); }}
              />
            </div>
          ) : activities.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Activity className="h-8 w-8 text-slate-400" />}
                title="No Events Found"
                description={
                  selectedAction || selectedEntity
                    ? 'No audit log entries match the selected filters. Try broadening your criteria.'
                    : 'Security access events, document verification decisions, and pipeline movements will be recorded here.'
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-border/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Event Action</th>
                    <th className="py-3 px-4">Entity Type</th>
                    <th className="py-3 px-4">Triggered By</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {activities.map((item) => {
                    const badge = getActionBadge(item.action)
                    const Icon = badge.icon

                    return (
                      <tr key={item._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                              <Icon className="h-3 w-3" />
                            </div>
                            <span className="font-semibold text-slate-900">
                              {badge.label}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant="neutral" size="sm" className="text-[10px]">
                            {item.entityType}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>{item.actor?.name || 'System'}</span>
                            {item.actor?.role && (
                              <span className="text-[10px] text-muted-foreground bg-slate-100 rounded px-1">
                                {item.actor.role}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span title={formatDate(item.createdAt)}>
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectItem(item)}
                            className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                          >
                            <Eye className="h-3 w-3" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border/60 bg-slate-50/50">
              <span className="text-xs text-muted-foreground">
                Showing {activities.length} of {pagination.total} events
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Previous
                </Button>

                <span className="text-xs font-medium text-slate-700 px-1">
                  {page} / {pagination.totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages || isFetching}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  Next
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Inspection Dialog */}
      <Dialog open={Boolean(inspectItem)} onOpenChange={(open) => !open && setInspectItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Event Audit Record Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cryptographically timestamped and tenant-scoped audit record.
            </DialogDescription>
          </DialogHeader>

          {inspectItem && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 border border-border/60">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Action
                  </span>
                  <span className="font-semibold text-slate-900">{inspectItem.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Entity Type
                  </span>
                  <span className="font-semibold text-slate-900">{inspectItem.entityType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Timestamp
                  </span>
                  <span className="text-slate-800">{formatDate(inspectItem.createdAt)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Actor
                  </span>
                  <span className="text-slate-800">
                    {inspectItem.actor?.name || 'System'} ({inspectItem.actor?.role || 'SYSTEM'})
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-800 block mb-1">
                  Event Metadata Payload:
                </span>
                <div className="rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto max-h-60">
                  <pre className="leading-tight">
                    {JSON.stringify(inspectItem.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInspectItem(null)}
                  className="text-xs h-8 px-3"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
