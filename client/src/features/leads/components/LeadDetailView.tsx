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
  SearchX,
  Copy,
  Check,
  Clock,
  Layers,
  Sparkles,
  Percent,
  RefreshCw,
  XCircle,
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

// Ordered linear stages for the progression tracker
const LINEAR_STAGES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
]

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
  const [copiedId, setCopiedId] = React.useState(false)

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

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
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
      const errObj = err as {
        response?: { status?: number; data?: { error?: { code?: string; message?: string } } }
      }
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

  // 1. Loading Skeleton State
  if (isLeadLoading && !lead) {
    return (
      <div className="space-y-6 p-2 sm:p-4">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        </div>

        {/* Financial KPI Strip Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>

        {/* 2-Column Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  // 2. 404 Not Found State
  if (is404) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
          <SearchX className="h-7 w-7" />
        </div>
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">Lead Inquiry Not Found</h2>
        <p className="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
          The requested lead ID <span className="font-mono font-medium text-slate-800">{leadId}</span> does
          not exist, was deleted, or belongs to another brokerage under strict tenant isolation rules.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {onClose ? (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close View
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/app/pipeline')}>
              Return to Pipeline
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/app/leads')}>
            View All Leads
          </Button>
          <Button variant="primary" size="sm" onClick={() => refetchLead()}>
            Retry Query
          </Button>
        </div>
      </div>
    )
  }

  // 3. General Error State
  if (isLeadError && !lead) {
    return (
      <div className="p-4 sm:p-6">
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

  // Computed Loan-to-Value (LTV) %
  const hasLtv = loanAmount > 0 && propertyValue > 0
  const ltvPercent = hasLtv ? ((loanAmount / propertyValue) * 100).toFixed(1) : null

  // Borrower initials for avatar
  const borrowerInitials = `${lead.firstName?.[0] || ''}${lead.lastName?.[0] || ''}`.toUpperCase() || 'BW'

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

  // Split transitions into forward progress vs terminal exit (LOST)
  const forwardTransitions = validTransitions.filter((s) => s !== 'LOST')
  const hasLostTransition = validTransitions.includes('LOST')

  // Advisor display
  const assignedAdvisor =
    typeof lead.assignedTo === 'object' && lead.assignedTo !== null
      ? lead.assignedTo
      : null

  // Current linear index for progression tracker
  const currentStageIndex = LINEAR_STAGES.indexOf(lead.status)

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Workspace Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div className="flex items-start gap-3.5 min-w-0">
          {/* Borrower Avatar Circle */}
          <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/30 text-primary font-bold text-sm sm:text-base border border-primary/20 shadow-2xs">
            {borrowerInitials}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
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

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span>Inquiry ID:</span>
                <span className="font-mono text-slate-700">{lead._id}</span>
                <button
                  type="button"
                  onClick={() => handleCopyId(lead._id)}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Copy Inquiry ID"
                >
                  {copiedId ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
              <span>•</span>
              <span>Registered {formatDate(lead.createdAt)}</span>
              <span>•</span>
              <span className="hidden sm:inline">Updated {formatRelativeTime(lead.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {showFullPageLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/leads/${lead._id}`)}
              className="gap-1.5 text-xs h-8"
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
              className="gap-1.5 text-xs h-8 shadow-xs"
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
              className="gap-1.5 text-xs h-8 text-primary hover:bg-primary/10 border-primary/30"
            >
              View Client Case
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 2. Concurrency Conflict Notice */}
      {concurrencyNotice && (
        <div className="flex items-start justify-between rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-semibold block">Concurrency Notice</span>
              <p className="mt-0.5 text-amber-800 leading-relaxed">{concurrencyNotice}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchLead()}
              className="h-6 px-2 text-[11px] text-amber-800 hover:text-amber-950 hover:bg-amber-100"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reload
            </Button>
            <button
              type="button"
              onClick={() => setConcurrencyNotice(null)}
              className="rounded p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100/60 transition-colors"
              title="Dismiss notice"
            >
              <span className="text-xs font-semibold">Dismiss</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. "Already Known" Person Detection Banner */}
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
                className="shrink-0 gap-1.5 border-amber-300 bg-white text-amber-950 hover:bg-amber-50 text-xs self-start sm:self-auto"
              >
                View Existing Client Case
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 4. Financial KPI Highlights Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Target Loan Amount */}
        <Card className="border border-border/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
            <span className="font-medium">Target Loan Amount</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900">
            {loanAmount > 0 ? formatCurrency(loanAmount) : 'Pending Assessment'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {loanAmount > 0 ? 'Requested principal borrowing' : 'Awaiting borrower intake'}
          </div>
        </Card>

        {/* Estimated Property Value & LTV % */}
        <Card className="border border-border/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
            <span className="font-medium">Estimated Property Value</span>
            {hasLtv && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary">
                <Percent className="h-2.5 w-2.5" />
                {ltvPercent}% LTV
              </span>
            )}
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900">
            {propertyValue > 0 ? formatCurrency(propertyValue) : 'Not Specified'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {hasLtv ? `${ltvPercent}% Loan-to-Value Ratio` : 'Property valuation baseline'}
          </div>
        </Card>

        {/* Monthly Gross Income */}
        <Card className="border border-border/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
            <span className="font-medium">Monthly Gross Income</span>
            <Briefcase className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900">
            {monthlyIncome > 0 ? formatCurrency(monthlyIncome) : 'Not Declared'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Base Monthly Earnings
          </div>
        </Card>
      </div>

      {/* 5. Linear Stage Progression Tracker */}
      <Card className="border border-border/80 p-4 shadow-2xs bg-slate-50/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Pipeline Stage Progression
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Stage {currentStageIndex >= 0 ? currentStageIndex + 1 : '-'}/6: {stageDef?.label || lead.status}
          </span>
        </div>

        {lead.status === 'LOST' ? (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
            <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <span className="font-semibold">Terminal State: Closed Lost</span>
              <p className="text-[11px] text-rose-700 mt-0.5">
                This lead has been archived as lost. No forward stage progressions are available.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
            {LINEAR_STAGES.map((stageKey, idx) => {
              const def = STAGE_DEFINITIONS[stageKey]
              const isCurrent = lead.status === stageKey
              const isPast = currentStageIndex > idx

              return (
                <div
                  key={stageKey}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? 'border-primary bg-primary/10 text-primary font-semibold shadow-2xs ring-1 ring-primary/30'
                      : isPast
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
                      : 'border-border/60 bg-white text-muted-foreground opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] mb-0.5">
                    {isPast ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                    <span className="font-bold">{idx + 1}</span>
                  </div>
                  <span className="text-[11px] truncate max-w-full">
                    {def?.label.replace(' Inquiry', '')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* 6. Main Workspace Layout (2 columns on desktop) */}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                <span className="text-muted-foreground block mb-1">Employment Status</span>
                <span className="font-semibold text-slate-900 text-xs">
                  {employmentStatus || 'Permanent Contract'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                <span className="text-muted-foreground block mb-1">Expat Residence Status</span>
                <span className="font-semibold text-slate-900 text-xs">
                  {residenceStatus || 'EU Blue Card'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                <span className="text-muted-foreground block mb-1">LTV Assessment</span>
                <span className="font-semibold text-slate-900 text-xs">
                  {hasLtv ? `${ltvPercent}% Loan-to-Value` : 'Pending Appraisal'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                <span className="text-muted-foreground block mb-1">Financing Objective</span>
                <span className="font-semibold text-slate-900 text-xs">
                  Residential Real Estate Mortgage
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
                <span className="text-muted-foreground font-medium">Current Stage:</span>
                <Badge variant={stageDef?.badgeVariant || 'neutral'} size="md">
                  {stageDef?.label || lead.status}
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {stageDef?.description || 'Active qualification step.'}
              </p>

              {/* State Machine Transition Actions */}
              <div className="pt-2 border-t border-border/60 space-y-2.5">
                <span className="block text-[11px] font-semibold text-slate-700">
                  Allowed Next Transitions
                </span>

                {validTransitions.length === 0 ? (
                  <div className="rounded-lg bg-slate-100/60 p-2.5 text-center text-[11px] text-muted-foreground">
                    Terminal Stage: No outgoing transitions permitted.
                  </div>
                ) : (
                  <>
                    {/* Primary Forward Transitions */}
                    {forwardTransitions.map((nextStage) => {
                      const nextDef = STAGE_DEFINITIONS[nextStage]

                      return (
                        <Button
                          key={nextStage}
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={updateStageMutation.isPending}
                          onClick={() => handleStageTransition(nextStage)}
                          className="w-full justify-between text-xs h-8.5 shadow-xs"
                        >
                          <span className="flex items-center gap-1.5">
                            Advance to {nextDef?.label || nextStage}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )
                    })}

                    {/* Secondary Drop-off / Lost Transition */}
                    {hasLostTransition && (
                      <div className="pt-1.5 border-t border-dashed border-border/60">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updateStageMutation.isPending}
                          onClick={() => handleStageTransition('LOST')}
                          className="w-full justify-between text-xs h-8 text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                        >
                          <span className="flex items-center gap-1.5">
                            <XCircle className="h-3.5 w-3.5" />
                            Mark as Lost
                          </span>
                          <ArrowRight className="h-3 w-3 opacity-60" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Client Conversion Eligibility Highlight Card */}
          {isStaffRole && !isConverted && (
            <Card
              className={`border p-4 shadow-2xs transition-all ${
                isEligibleForConversion
                  ? 'border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent'
                  : 'border-border/60 bg-slate-50/50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    isEligibleForConversion ? 'text-primary' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">Client Case Conversion</span>
                    {isEligibleForConversion ? (
                      <span className="rounded px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                        Ready
                      </span>
                    ) : (
                      <span className="rounded px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px]">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {isEligibleForConversion
                      ? 'This lead has reached an eligible qualification stage and can be converted into an official client case with portal access.'
                      : 'Lead must advance to Qualified, Proposal, or Negotiation stage before portal account creation.'}
                  </p>
                  {isEligibleForConversion && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConvertModalOpen(true)}
                      className="mt-3 w-full text-xs h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Begin Client Onboarding
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Lead Score & Quality Card */}
          <Card className="border border-border/80 p-5 shadow-2xs">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/60">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Lead Score & Quality
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground font-medium">Calculated Score</span>
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
