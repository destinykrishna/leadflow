import * as React from 'react'
import {
  Sparkles,
  Layers,
  UserCheck,
  RotateCcw,
  Award,
  Upload,
  CheckCircle2,
  XCircle,
  CheckSquare,
  Mail,
  Clock,
  User,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatRelativeTime, formatDate } from '@/lib/format'
import type { ActivityLogItem, ActivityAction } from '@/types/activity.types'
import { STAGE_DEFINITIONS, type LeadStatus } from '@/types/pipeline.types'

interface ActivityConfig {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  borderColor: string
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'neutral'
  badgeLabel: string
  formatTitle: (meta?: Record<string, unknown>) => string
}

const ACTION_CONFIGS: Record<ActivityAction, ActivityConfig> = {
  LEAD_CREATED: {
    icon: Sparkles,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    badgeVariant: 'neutral',
    badgeLabel: 'New Inquiry',
    formatTitle: (meta) => {
      const source = meta?.source ? String(meta.source) : 'Web'
      return `Inquiry received via ${source}`
    },
  },
  STAGE_CHANGED: {
    icon: Layers,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    borderColor: 'border-indigo-200',
    badgeVariant: 'default',
    badgeLabel: 'Stage Move',
    formatTitle: (meta) => {
      const from = meta?.previousStage
        ? STAGE_DEFINITIONS[meta.previousStage as LeadStatus]?.label || String(meta.previousStage)
        : 'Inquiry'
      const to = meta?.newStage
        ? STAGE_DEFINITIONS[meta.newStage as LeadStatus]?.label || String(meta.newStage)
        : 'Next Stage'
      return `Stage moved: ${from} → ${to}`
    },
  },
  ADVISOR_ASSIGNED: {
    icon: UserCheck,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    borderColor: 'border-purple-200',
    badgeVariant: 'neutral',
    badgeLabel: 'Assignment',
    formatTitle: (meta) => {
      const name = meta?.advisorName ? String(meta.advisorName) : 'Advisor'
      return `Assigned to ${name}`
    },
  },
  LEAD_REOPENED: {
    icon: RotateCcw,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    borderColor: 'border-amber-200',
    badgeVariant: 'warning',
    badgeLabel: 'Reopened',
    formatTitle: (meta) => {
      const reason = meta?.reason ? ` (${String(meta.reason)})` : ''
      return `Inquiry reopened from Lost to New${reason}`
    },
  },
  LEAD_CONVERTED: {
    icon: Award,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
    badgeVariant: 'success',
    badgeLabel: 'Converted',
    formatTitle: (meta) => {
      const type = meta?.clientType ? ` [${String(meta.clientType)}]` : ''
      return `Converted to formal Client Case${type}`
    },
  },
  DOCUMENT_UPLOADED: {
    icon: Upload,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    borderColor: 'border-sky-200',
    badgeVariant: 'neutral',
    badgeLabel: 'Upload',
    formatTitle: (meta) => {
      const title = meta?.title ? String(meta.title) : 'Document'
      return `Document uploaded: ${title}`
    },
  },
  DOCUMENT_VERIFIED: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
    badgeVariant: 'success',
    badgeLabel: 'Verified',
    formatTitle: (meta) => {
      const title = meta?.title ? String(meta.title) : 'Document'
      return `Document approved: ${title}`
    },
  },
  DOCUMENT_REJECTED: {
    icon: XCircle,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    borderColor: 'border-rose-200',
    badgeVariant: 'danger',
    badgeLabel: 'Rejected',
    formatTitle: (meta) => {
      const title = meta?.title ? String(meta.title) : 'Document'
      return `Document rejected: ${title}`
    },
  },
  TASK_COMPLETED: {
    icon: CheckSquare,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
    badgeVariant: 'success',
    badgeLabel: 'Task Done',
    formatTitle: (meta) => {
      const title = meta?.title ? String(meta.title) : 'Task'
      return `Task completed: ${title}`
    },
  },
  EMAIL_SENT: {
    icon: Mail,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    badgeVariant: 'neutral',
    badgeLabel: 'Email Sent',
    formatTitle: (meta) => {
      const subject = meta?.subject ? ` "${String(meta.subject)}"` : ''
      return `Automated email dispatched${subject}`
    },
  },
}

interface ActivityTimelineProps {
  activities?: ActivityLogItem[]
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

export function ActivityTimeline({
  activities = [],
  isLoading = false,
  emptyTitle = 'No Recorded Activity Yet',
  emptyDescription = 'Status transitions, document verifications, assignments, and dispatches will appear here.',
}: ActivityTimelineProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6 text-slate-400" />}
        title={emptyTitle}
        description={emptyDescription}
        className="py-8"
      />
    )
  }

  return (
    <div className="relative pl-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      <div className="space-y-5">
        {activities.map((item) => {
          const config = ACTION_CONFIGS[item.action] || {
            icon: Activity,
            iconBg: 'bg-slate-50',
            iconColor: 'text-slate-600',
            borderColor: 'border-slate-200',
            badgeVariant: 'neutral' as const,
            badgeLabel: item.action,
            formatTitle: () => item.action.replace(/_/g, ' '),
          }

          const IconComponent = config.icon
          const isExpanded = expandedId === item._id
          const hasMetadata = item.metadata && Object.keys(item.metadata).length > 0
          const actorName = item.actor?.name || 'System'
          const actorRole = item.actor?.role ? ` • ${item.actor.role}` : ''

          return (
            <div key={item._id} className="relative group">
              {/* Timeline marker icon */}
              <div
                className={`absolute -left-[31px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border bg-white shadow-2xs ${config.iconColor} ${config.borderColor}`}
              >
                <IconComponent className="h-3.5 w-3.5" />
              </div>

              {/* Item card */}
              <div className="rounded-lg border border-border/70 bg-white p-3 shadow-2xs hover:border-slate-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={config.badgeVariant} size="sm" className="text-[10px]">
                      {config.badgeLabel}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-900">
                      {config.formatTitle(item.metadata)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 self-end sm:self-auto">
                    <Clock className="h-3 w-3" />
                    <span title={formatDate(item.createdAt)}>
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Subtitle / Actor note */}
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-slate-400" />
                    <span>
                      {actorName}
                      <span className="text-slate-400">{actorRole}</span>
                    </span>
                  </div>

                  {hasMetadata && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item._id)}
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          Hide Details <ChevronUp className="h-2.5 w-2.5" />
                        </>
                      ) : (
                        <>
                          Inspect Details <ChevronDown className="h-2.5 w-2.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded metadata viewer */}
                {isExpanded && hasMetadata && (
                  <div className="mt-2.5 rounded-md bg-slate-50 p-2 border border-slate-200 text-[11px] font-mono text-slate-700 overflow-x-auto">
                    <pre className="text-[10px] leading-tight whitespace-pre-wrap">
                      {JSON.stringify(item.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
