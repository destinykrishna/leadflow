import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  DollarSign,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CheckSquare,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Copy,
  Check,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatRelativeTime, formatDate } from '@/lib/format'
import { useAuth } from '@/hooks/useAuth'
import {
  STAGE_DEFINITIONS,
  VALID_STAGE_TRANSITIONS,
  type Lead,
  type LeadStatus,
} from '@/types/pipeline.types'
import {
  useLead,
  useLeadTasks,
  useLeadDocuments,
  useUpdateLeadWorkspaceStage,
} from '../api/leads.api'
import { ConvertLeadModal } from './ConvertLeadModal'

export interface LeadDetailViewProps {
  leadId: string
  initialLead?: Lead | null
  onClose?: () => void
  showFullPageLink?: boolean
}

export function LeadDetailView({
  leadId,
  initialLead,
  onClose,
  showFullPageLink = false,
}: LeadDetailViewProps) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const {
    data: fetchedLead,
    isLoading: isLeadLoading,
    isError: isLeadError,
    error: leadError,
    refetch: refetchLead,
  } = useLead(leadId)

  const lead = fetchedLead || initialLead

  const {
    data: tasks = [],
    isLoading: isTasksLoading,
    refetch: refetchTasks,
  } = useLeadTasks(lead?._id)

  const {
    data: documents = [],
    isLoading: isDocsLoading,
    refetch: refetchDocs,
  } = useLeadDocuments(lead?._id)

  const updateStageMutation = useUpdateLeadWorkspaceStage()

  const [isConvertModalOpen, setIsConvertModalOpen] = React.useState(false)
  const [concurrencyNotice, setConcurrencyNotice] = React.useState<string | null>(null)
  const [copiedEmail, setCopiedEmail] = React.useState(false)

  // 404 detection
  const is404 =
    isLeadError &&
    (Boolean(leadError && (leadError as { response?: { status?: number } }).response?.status === 404) ||
      Boolean(leadError && (leadError as { status?: number }).status === 404) ||
      Boolean(leadError && (leadError as Error).message?.includes('not found')))

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  // Stage action handler
  const handleStageTransition = async (targetStage: LeadStatus) => {
    if (!lead) return
    setConcurrencyNotice(null)

    try {
      await updateStageMutation.mutateAsync({
        id: lead._id,
        stage: targetStage,
        version: lead.__v,
      })
      refetchLead()
      refetchTasks()
    } catch (err: unknown) {
      const errObj = err as { response?: { status?: number; data?: { error?: { code?: string; message?: string } } } }
      if (errObj.response?.status === 409 || errObj.response?.data?.error?.code === 'CONFLICT') {
        setConcurrencyNotice(
          'Concurrency conflict: This lead was modified by another session or automated trigger. The latest data has been loaded.',
        )
        refetchLead()
      } else {
        setConcurrencyNotice(
          errObj.response?.data?.error?.message || 'Failed to update lead stage. Please retry.',
        )
      }
    }
  }

  // 1. Loading State
  if (isLeadLoading && !lead) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  // 2. 404 State
  if (is404) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Lead Inquiry Not Found</h2>
        <p className="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
          The requested lead ID <span className="font-mono font-medium text-slate-800">{leadId}</span> does
          not exist, was deleted, or belongs to another brokerage under tenant isolation rules.
        </p>
        <div className="mt-6 flex items-center gap-3">
          {onClose ? (
            <Button variant="outline" onClick={onClose}>
              Close View
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate('/app/pipeline')}>
              Return to Pipeline
            </Button>
          )}
          <Button variant="primary" onClick={() => refetchLead()}>
            Retry Query
          </Button>
        </div>
      </div>
    )
  }

  // 3. General Error State
  if (isLeadError && !lead) {
    return (
      <div className="p-6">
        <ErrorState
          title="Lead Information Unavailable"
          message={
            leadError instanceof Error
              ? leadError.message
              : 'Failed to load lead inquiry details from server.'
          }
          onRetry={refetchLead}
        />
      </div>
    )
  }

  if (!lead) return null

  // Financial fields extraction
  const loanAmount = Number(lead.customFields?.loanAmount) || 0
  const propertyValue = Number(lead.customFields?.propertyValue) || 0
  const monthlyIncome = Number(lead.customFields?.monthlyIncome) || 0
  const employmentStatus = (lead.customFields?.employmentStatus as string) || null
  const residenceStatus = (lead.customFields?.residenceStatus as string) || null

  // "Already Known" detection from backend customFields
  const isAlreadyKnown = Boolean(
    lead.customFields?.alreadyKnown ||
      lead.customFields?.isAlreadyKnown ||
      lead.customFields?.knownAs === 'CLIENT',
  )
  const existingClientId =
    (lead.customFields?.existingClientId as string) ||
    lead.convertedClientId ||
    null

  // Conversion permissions & eligibility
  const isStaffRole = user && ['PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'].includes(user.role)
  const isConverted = Boolean(lead.convertedClientId)
  const isEligibleForConversion =
    ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].includes(lead.status) && !isConverted

  // State machine valid transitions
  const validTransitions = VALID_STAGE_TRANSITIONS[lead.status] || []
  const stageDef = STAGE_DEFINITIONS[lead.status]

  // Advisor display
  const assignedAdvisor =
    typeof lead.assignedTo === 'object' && lead.assignedTo !== null
      ? lead.assignedTo
      : null

  return (
    <div className="space-y-6 pb-8">
      {/* Workspace Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {lead.firstName} {lead.lastName}
            </h1>
            <Badge variant={stageDef?.badgeVariant || 'neutral'} size="md">
              {stageDef?.label || lead.status}
            </Badge>

            {isConverted && (
              <Badge variant="success" size="md" className="gap-1">
                <Check className="h-3 w-3" />
                Client Case
              </Badge>
            )}

            {isAlreadyKnown && (
              <Badge variant="warning" size="md" className="gap-1">
                <Sparkles className="h-3 w-3" />
                Already Known
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Inquiry ID: <span className="font-mono text-slate-700">{lead._id}</span></span>
            <span>•</span>
            <span>Registered {formatDate(lead.createdAt)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {showFullPageLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/leads/${lead._id}`)}
              className="gap-1.5 text-xs"
            >
              Open Full Page
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}

          {isStaffRole && !isConverted && (
            <Button
              variant="primary"
              size="sm"
              disabled={!isEligibleForConversion}
              onClick={() => setIsConvertModalOpen(true)}
              className="gap-1.5 text-xs shadow-xs"
              title={
                !isEligibleForConversion
                  ? 'Leads must reach Qualified, Proposal, or Negotiation stage before conversion'
                  : 'Convert lead to active client case'
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Convert to Client
            </Button>
          )}

          {isConverted && existingClientId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/clients/${existingClientId}`)}
              className="gap-1.5 text-xs text-primary hover:bg-primary/10"
            >
              View Client Case
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Concurrency Notice Alert */}
      {concurrencyNotice && (
        <div className="flex items-start justify-between rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span>{concurrencyNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setConcurrencyNotice(null)}
            className="text-amber-700 hover:text-amber-900 text-xs font-semibold ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* "Already Known" Person Detection Banner */}
      {isAlreadyKnown && (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-amber-100/50 p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-800">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-amber-950">
                  Already Known Borrower Profile
                </h2>
                <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                  This contact email matches an existing client record registered with your brokerage.
                  Advisor assignments and verified mortgage history may already exist.
                </p>
              </div>
            </div>

            {existingClientId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/app/clients/${existingClientId}`)}
                className="shrink-0 gap-1.5 border-amber-300 bg-white text-amber-950 hover:bg-amber-50 text-xs"
              >
                View Existing Client Case
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace Layout (2 columns on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Borrower Profile & Financial Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Borrower Information Card */}
          <Card className="border border-border/80 p-5 shadow-2xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border/60">
              <User className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Borrower Contact Information
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Full Name</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {lead.firstName} {lead.lastName}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block mb-0.5">Email Address</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${lead.email}`}
                    className="font-semibold text-primary hover:underline truncate"
                  >
                    {lead.email}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyEmail(lead.email)}
                    className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Copy email"
                  >
                    {copiedEmail ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block mb-0.5">Phone Number</span>
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="font-medium text-slate-900 hover:text-primary transition-colors"
                  >
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-slate-400 italic">Not provided</span>
                )}
              </div>

              <div>
                <span className="text-muted-foreground block mb-0.5">Inquiry Source</span>
                <Badge variant="neutral" size="sm">
                  {lead.source}
                </Badge>
              </div>

              <div>
                <span className="text-muted-foreground block mb-0.5">Created Date</span>
                <span className="text-slate-700">{formatDate(lead.createdAt)}</span>
              </div>

              <div>
                <span className="text-muted-foreground block mb-0.5">Last Interaction</span>
                <span className="text-slate-700">{formatRelativeTime(lead.updatedAt)}</span>
              </div>
            </div>

            {lead.notes && (
              <div className="mt-4 pt-3 border-t border-border/60">
                <span className="text-muted-foreground block text-[11px] font-semibold mb-1">
                  Inquiry Notes
                </span>
                <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-800 leading-relaxed">
                  {lead.notes}
                </p>
              </div>
            )}
          </Card>

          {/* Mortgage & Financial Requirements Card */}
          <Card className="border border-border/80 p-5 shadow-2xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border/60">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Mortgage & Financing Scope
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                <span className="text-muted-foreground block mb-1">Target Loan Amount</span>
                <span className="text-base font-bold text-slate-900">
                  {loanAmount > 0 ? formatCurrency(loanAmount) : 'Pending Assessment'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                <span className="text-muted-foreground block mb-1">Estimated Property Value</span>
                <span className="text-base font-bold text-slate-900">
                  {propertyValue > 0 ? formatCurrency(propertyValue) : 'Not Specified'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                <span className="text-muted-foreground block mb-1">Monthly Gross Income</span>
                <span className="text-base font-bold text-slate-900">
                  {monthlyIncome > 0 ? formatCurrency(monthlyIncome) : 'Not Declared'}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <span className="text-muted-foreground block mb-0.5">Employment Status</span>
                <span className="font-semibold text-slate-800">
                  {employmentStatus || 'Permanent Contract (Standard)'}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block mb-0.5">Expat Residence Status</span>
                <span className="font-semibold text-slate-800">
                  {residenceStatus || 'EU Blue Card / Permanent Residence'}
                </span>
              </div>
            </div>
          </Card>

          {/* Relevant Tasks Section */}
          <Card className="border border-border/80 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Relevant Tasks ({tasks.length})
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchTasks()}
                className="h-6 text-[11px] text-muted-foreground hover:text-slate-900"
              >
                Refresh
              </Button>
            </div>

            {isTasksLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="h-6 w-6 text-slate-400" />}
                title="No Linked Tasks"
                description="Tasks scheduled by stage triggers or assigned by advisors for this lead will appear here."
                className="py-6"
              />
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/60 bg-slate-50/50 p-2.5 text-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                          task.status === 'COMPLETED'
                            ? 'bg-emerald-500'
                            : task.isOverdue
                            ? 'bg-rose-500'
                            : 'bg-amber-400'
                        }`}
                      />
                      <div>
                        <span className="font-semibold text-slate-900">{task.title}</span>
                        {task.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Badge
                        variant={
                          task.priority === 'URGENT' || task.priority === 'HIGH'
                            ? 'danger'
                            : 'neutral'
                        }
                        size="sm"
                        className="text-[10px]"
                      >
                        {task.priority}
                      </Badge>
                      <Badge
                        variant={task.status === 'COMPLETED' ? 'success' : 'default'}
                        size="sm"
                        className="text-[10px]"
                      >
                        {task.status}
                      </Badge>
                      {task.dueDate && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Relevant Documents Section */}
          <Card className="border border-border/80 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Relevant Documents ({documents.length})
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchDocs()}
                className="h-6 text-[11px] text-muted-foreground hover:text-slate-900"
              >
                Refresh
              </Button>
            </div>

            {isDocsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : documents.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-6 w-6 text-slate-400" />}
                title="No Documents Uploaded"
                description="Payslips, passport identification, and tax certificates submitted by the borrower will appear here."
                className="py-6"
              />
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/60 bg-slate-50/50 p-2.5 text-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 truncate block">
                          {doc.title || doc.type}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(doc.createdAt)} • {(doc.sizeBytes / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Badge variant="neutral" size="sm" className="text-[10px]">
                        {doc.type}
                      </Badge>
                      <Badge
                        variant={
                          doc.status === 'VERIFIED'
                            ? 'success'
                            : doc.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                        }
                        size="sm"
                        className="text-[10px]"
                      >
                        {doc.status}
                      </Badge>
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1 text-primary hover:bg-primary/10 transition-colors"
                          title="View Document File"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (1 span): Stage Actions, Score, Assignment */}
        <div className="space-y-6">
          {/* Current Stage & Progression Actions Card */}
          <Card className="border border-border/80 p-5 shadow-2xs">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/60">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Pipeline Stage Actions
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-muted-foreground">Current Stage:</span>
                <Badge variant={stageDef?.badgeVariant || 'neutral'} size="md">
                  {stageDef?.label || lead.status}
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {stageDef?.description || 'Active qualification step.'}
              </p>

              {/* State Machine Transition Buttons */}
              <div className="pt-2 border-t border-border/60 space-y-2">
                <span className="block text-[11px] font-semibold text-slate-700">
                  Allowed Next Transitions
                </span>

                {validTransitions.length === 0 ? (
                  <div className="rounded-lg bg-slate-100/60 p-2.5 text-center text-[11px] text-muted-foreground">
                    Terminal Stage — No outgoing transitions permitted.
                  </div>
                ) : (
                  validTransitions.map((nextStage) => {
                    const nextDef = STAGE_DEFINITIONS[nextStage]
                    const isLostAction = nextStage === 'LOST'

                    return (
                      <Button
                        key={nextStage}
                        type="button"
                        variant={isLostAction ? 'outline' : 'primary'}
                        size="sm"
                        disabled={updateStageMutation.isPending}
                        onClick={() => handleStageTransition(nextStage)}
                        className={`w-full justify-between text-xs h-8 ${
                          isLostAction ? 'hover:border-rose-300 hover:text-rose-700' : ''
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {isLostAction ? 'Mark as Lost' : `Advance to ${nextDef?.label || nextStage}`}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )
                  })
                )}
              </div>
            </div>
          </Card>

          {/* Lead Score & Qualification Card */}
          <Card className="border border-border/80 p-5 shadow-2xs">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/60">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Lead Score & Quality
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Calculated Score</span>
                <span
                  className={`text-xl font-bold ${
                    lead.score >= 70
                      ? 'text-emerald-600'
                      : lead.score >= 40
                      ? 'text-amber-600'
                      : 'text-slate-600'
                  }`}
                >
                  {lead.score} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
                </span>
              </div>

              {/* Visual meter bar */}
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    lead.score >= 70
                      ? 'bg-emerald-500'
                      : lead.score >= 40
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                  style={{ width: `${Math.min(lead.score, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>Category:</span>
                <span className="font-semibold text-slate-800">
                  {lead.score >= 70 ? 'High Intent' : lead.score >= 40 ? 'Moderate' : 'Unqualified'}
                </span>
              </div>
            </div>
          </Card>

          {/* Assigned Advisor Card */}
          <Card className="border border-border/80 p-5 shadow-2xs">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/60">
              <Briefcase className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Assigned Advisor
              </h2>
            </div>

            {assignedAdvisor ? (
              <div className="flex items-center gap-3 text-xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                  {assignedAdvisor.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900 block truncate">
                    {assignedAdvisor.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate block">
                    {assignedAdvisor.email}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-muted-foreground">
                Unassigned Inquiry
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Convert Lead to Client Modal */}
      {isStaffRole && (
        <ConvertLeadModal
          lead={lead}
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          onSuccess={() => {
            refetchLead()
            refetchTasks()
            refetchDocs()
          }}
        />
      )}
    </div>
  )
}
