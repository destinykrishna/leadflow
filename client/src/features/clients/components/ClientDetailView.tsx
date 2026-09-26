import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  SearchX,
  Upload,
  ShieldCheck,
  Building,
  UserCheck,
  ArrowRight,
  Info,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatRelativeTime, formatDate } from '@/lib/format'
import { useAuth } from '@/hooks/useAuth'
import { useClient, useClientDocuments } from '../api/clients.api'
import { useLead } from '@/features/leads/api/leads.api'
import { useDocumentSocket } from '@/features/documents/hooks/useDocumentSocket'
import { UploadDocumentModal } from './UploadDocumentModal'
import type { ClientType, ClientStatus } from '@/types/client.types'
import type { DocumentItem } from '@/types/document.types'
import { STAGE_DEFINITIONS } from '@/types/pipeline.types'

export interface ClientDetailViewProps {
  clientId: string
  onClose?: () => void
  showFullPageLink?: boolean
}

const CLIENT_TYPE_INFO: Record<
  ClientType,
  { label: string; badgeVariant: 'default' | 'success' | 'warning' | 'neutral'; desc: string }
> = {
  BUYER: {
    label: 'Buyer / Borrower',
    badgeVariant: 'default',
    desc: 'Prospective property purchaser seeking residential financing',
  },
  SELLER: {
    label: 'Property Vendor',
    badgeVariant: 'warning',
    desc: 'Property seller seeking bridge loans, evaluation or advisory',
  },
  BOTH: {
    label: 'Buyer & Seller',
    badgeVariant: 'success',
    desc: 'Simultaneous purchase and sale transaction financing',
  },
  OTHER: {
    label: 'Special Financing',
    badgeVariant: 'neutral',
    desc: 'Commercial, remortgage, or specialized expat financing file',
  },
}

const STATUS_BADGE_MAP: Record<
  ClientStatus,
  { label: string; badgeVariant: 'success' | 'neutral' | 'danger' }
> = {
  ACTIVE: { label: 'Active Case', badgeVariant: 'success' },
  INACTIVE: { label: 'Inactive Case', badgeVariant: 'neutral' },
  ARCHIVED: { label: 'Archived', badgeVariant: 'neutral' },
}

export function ClientDetailView({
  clientId,
  onClose,
  showFullPageLink = false,
}: ClientDetailViewProps) {
  const navigate = useNavigate()
  const { user } = useAuth()

  // 1. Fetch Client Case
  const {
    data: client,
    isLoading: isClientLoading,
    isError: isClientError,
    error: clientError,
    refetch: refetchClient,
  } = useClient(clientId)

  // 2. Fetch Client Documents
  const {
    data: documents = [],
    isLoading: isDocsLoading,
    refetch: refetchDocs,
  } = useClientDocuments(client?._id)

  // 3. Resolve originating lead identifier
  const leadId = React.useMemo(() => {
    if (!client?.leadId) return undefined
    if (typeof client.leadId === 'object' && client.leadId !== null) {
      return client.leadId._id
    }
    return typeof client.leadId === 'string' ? client.leadId : undefined
  }, [client?.leadId])

  // 4. Fetch Originating Lead Inquiry for Financial Overview
  // 4. Fetch Originating Lead Inquiry for Financial Overview
  const {
    data: lead,
    isLoading: isLeadLoading,
  } = useLead(leadId)

  // 5. Realtime Socket subscription for document processing updates
  useDocumentSocket({
    clientId: client?._id,
    leadId,
    enabled: Boolean(client?._id),
  })

  // Local UI states
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false)
  const [selectedDocFilter, setSelectedDocFilter] = React.useState<string>('ALL')
  const [copiedEmail, setCopiedEmail] = React.useState(false)
  const [copiedPhone, setCopiedPhone] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState(false)
  const [copiedDocId, setCopiedDocId] = React.useState<string | null>(null)

  // 404 detection (IDOR protection or non-existent record)
  const is404 =
    isClientError &&
    (Boolean(clientError && (clientError as { response?: { status?: number } }).response?.status === 404) ||
      Boolean(clientError && (clientError as { status?: number }).status === 404) ||
      Boolean(clientError && (clientError as Error).message?.includes('not found')))

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone)
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const handleCopyDocLink = (docId: string, url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedDocId(docId)
    setTimeout(() => setCopiedDocId(null), 2000)
  }

  // Financial figures extracted safely from originating lead inquiry
  const loanAmount = Number(lead?.customFields?.loanAmount) || 0
  const propertyValue = Number(lead?.customFields?.propertyValue) || 0
  const monthlyIncome =
    Number(lead?.customFields?.monthlyGrossIncome) ||
    Number(lead?.customFields?.monthlyIncome) ||
    0
  const downPayment = Number(lead?.customFields?.downPayment) || 0

  const ltv =
    loanAmount > 0 && propertyValue > 0
      ? ((loanAmount / propertyValue) * 100).toFixed(1)
      : null

  // Assigned advisor resolution
  const assignedAdvisor = React.useMemo(() => {
    if (!client?.assignedTo) return null
    if (typeof client.assignedTo === 'object' && client.assignedTo !== null) {
      return client.assignedTo
    }
    // If it's a string ID and matches the current logged-in user
    if (typeof client.assignedTo === 'string' && user && client.assignedTo === user.id) {
      return {
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    }
    return null
  }, [client?.assignedTo, user])

  const isAssignedToCurrentUser =
    user &&
    ((typeof client?.assignedTo === 'string' && client.assignedTo === user.id) ||
      (typeof client?.assignedTo === 'object' && client?.assignedTo?._id === user.id))

  // Filtered documents
  const filteredDocuments = React.useMemo(() => {
    if (selectedDocFilter === 'ALL') return documents
    return documents.filter((doc) => doc.status === selectedDocFilter)
  }, [documents, selectedDocFilter])

  // Document verification counts (all 4 states clearly distinguished)
  const verifiedDocCount = documents.filter((d) => d.status === 'VERIFIED').length
  const processingDocCount = documents.filter((d) => d.status === 'PROCESSING').length
  const pendingDocCount = documents.filter((d) => d.status === 'PENDING').length
  const rejectedDocCount = documents.filter((d) => d.status === 'REJECTED').length

  // 1. Loading Skeleton State
  if (isClientLoading && !client) {
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

        {/* Case KPI Strip Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>

        {/* 2-Column Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-60 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
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
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">Client Case Not Found</h2>
        <p className="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
          The requested client case <span className="font-mono font-medium text-slate-800">{clientId}</span> does
          not exist, was archived, or belongs to another brokerage under strict tenant isolation rules.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {onClose ? (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close View
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/app/clients')}>
              Return to Cases
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/app/pipeline')}>
            View Pipeline
          </Button>
          <Button variant="primary" size="sm" onClick={() => refetchClient()}>
            Retry Query
          </Button>
        </div>
      </div>
    )
  }

  // 3. General Error State
  if (isClientError && !client) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          title="Client Information Unavailable"
          message={
            clientError instanceof Error
              ? clientError.message
              : 'Failed to load client mortgage case details from server.'
          }
          onRetry={refetchClient}
        />
      </div>
    )
  }

  if (!client) return null

  const initials = `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase() || 'CL'
  const typeConfig = CLIENT_TYPE_INFO[client.type] || CLIENT_TYPE_INFO.OTHER
  const statusConfig = STATUS_BADGE_MAP[client.status] || STATUS_BADGE_MAP.ACTIVE

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-base shadow-2xs border border-primary/20">
            {initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {client.firstName} {client.lastName}
              </h1>
              <Badge variant={statusConfig.badgeVariant} size="sm">
                {statusConfig.label}
              </Badge>
              <Badge variant={typeConfig.badgeVariant} size="sm">
                {typeConfig.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
              <div className="flex items-center gap-1 font-mono">
                <span className="text-slate-400">ID:</span>
                <span className="text-slate-700">{client._id}</span>
                <button
                  type="button"
                  onClick={() => handleCopyId(client._id)}
                  title="Copy Client Case ID"
                  className="hover:text-primary transition-colors ml-0.5"
                >
                  {copiedId ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>

              <span className="text-slate-300">•</span>

              <div className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <a href={`mailto:${client.email}`} className="text-slate-700 hover:text-primary transition-colors">
                  {client.email}
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyEmail(client.email)}
                  title="Copy Email"
                  className="hover:text-primary transition-colors ml-0.5"
                >
                  {copiedEmail ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>

              {client.phone && (
                <>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <a href={`tel:${client.phone}`} className="text-slate-700 hover:text-primary transition-colors">
                      {client.phone}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(client.phone!)}
                      title="Copy Phone"
                      className="hover:text-primary transition-colors ml-0.5"
                    >
                      {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {showFullPageLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/clients/${client._id}`)}
              className="gap-1.5 text-xs"
            >
              Open Dedicated Page
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Document
          </Button>

          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-2 text-xs">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* 2. Mortgage Case KPI Highlight Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Target Loan */}
        <Card className="p-3.5 border border-border/80 shadow-2xs bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Target Loan
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">
              {loanAmount > 0 ? formatCurrency(loanAmount) : '—'}
            </span>
            {ltv && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {ltv}% LTV
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {lead ? 'From originating mortgage inquiry' : 'No inquiry amount recorded'}
          </p>
        </Card>

        {/* Card 2: Property Value */}
        <Card className="p-3.5 border border-border/80 shadow-2xs bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Property Value
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <Building className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold text-slate-900">
              {propertyValue > 0 ? formatCurrency(propertyValue) : '—'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {downPayment > 0 ? `Equity: ${formatCurrency(downPayment)}` : 'Residential purchase valuation'}
          </p>
        </Card>

        {/* Card 3: Monthly Gross Income */}
        <Card className="p-3.5 border border-border/80 shadow-2xs bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly Income
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold text-slate-900">
              {monthlyIncome > 0 ? formatCurrency(monthlyIncome) : '—'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Gross applicant household income
          </p>
        </Card>

        {/* Card 4: Verification Documents Status */}
        <Card className="p-3.5 border border-border/80 shadow-2xs bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Case Documents
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600">
              <FileText className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">{documents.length} Total</span>
            {verifiedDocCount > 0 && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {verifiedDocCount} Verified
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {pendingDocCount > 0
              ? `${pendingDocCount} pending verification`
              : 'All files up to date'}
          </p>
        </Card>
      </div>

      {/* 3. Main 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width): Case/Lead Origin & Documents Workspace */}
        <div className="lg:col-span-2 space-y-6">
          {/* Originating Lead & Financial Case File */}
          <Card className="p-5 border border-border/80 shadow-2xs bg-white">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-slate-900">Case & Inquiry Relationship</h2>
              </div>
              {lead && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/app/leads/${lead._id}`)}
                  className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                >
                  View Lead Workspace
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>

            {lead ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3 border border-border/60">
                    <span className="text-[11px] text-muted-foreground block font-medium">
                      Inquiry Stage
                    </span>
                    <div className="mt-1">
                      <Badge variant="success" size="sm">
                        {STAGE_DEFINITIONS[lead.status]?.label || lead.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 border border-border/60">
                    <span className="text-[11px] text-muted-foreground block font-medium">
                      Qualification Score
                    </span>
                    <span className="mt-1 text-sm font-bold text-slate-900 block">
                      {lead.score}/100 Score
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 border border-border/60">
                    <span className="text-[11px] text-muted-foreground block font-medium">
                      Intake Source
                    </span>
                    <span className="mt-1 text-xs font-semibold text-slate-700 block">
                      {lead.source}
                    </span>
                  </div>
                </div>

                {/* Inquiry Notes */}
                {lead.notes && (
                  <div className="rounded-lg bg-amber-50/50 p-3 border border-amber-200/60 text-xs text-amber-900">
                    <span className="font-semibold text-amber-950 block mb-1">
                      Originating Borrower Notes:
                    </span>
                    <p className="leading-relaxed">{lead.notes}</p>
                  </div>
                )}
              </div>
            ) : isLeadLoading ? (
              <div className="py-4 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <div className="py-4 flex items-center gap-3 text-xs text-muted-foreground">
                <Info className="h-4 w-4 text-slate-400 shrink-0" />
                <span>
                  This client case does not have a linked lead inquiry document or was created directly.
                </span>
              </div>
            )}
          </Card>

          {/* Documents Workspace */}
          <Card className="p-5 border border-border/80 shadow-2xs bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-slate-900">Mortgage File Documents</h2>
                <Badge variant="neutral" size="sm">
                  {documents.length}
                </Badge>

                {/* Manual Cache Refresh Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchDocs()}
                  disabled={isDocsLoading}
                  className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900 ml-1"
                  title="Refresh case documents"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isDocsLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>

              {/* Document Status Filter Tabs (4 Distinct Processing States) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { key: 'ALL', label: `All (${documents.length})` },
                  { key: 'VERIFIED', label: `Verified (${verifiedDocCount})` },
                  { key: 'PROCESSING', label: `Processing (${processingDocCount})` },
                  { key: 'PENDING', label: `Pending (${pendingDocCount})` },
                  { key: 'REJECTED', label: `Rejected (${rejectedDocCount})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedDocFilter(tab.key)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors shrink-0 ${
                      selectedDocFilter === tab.key
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Documents List */}
            <div className="mt-4">
              {isDocsLoading && documents.length === 0 ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-8 w-8 text-slate-300" />}
                  title={
                    selectedDocFilter === 'ALL'
                      ? 'No Documents Uploaded'
                      : `No ${selectedDocFilter.toLowerCase()} documents`
                  }
                  description={
                    selectedDocFilter === 'ALL'
                      ? 'Upload borrower payslips, tax assessments, bank statements, or identification records.'
                      : `No documents currently match the ${selectedDocFilter.toLowerCase()} filter.`
                  }
                  action={
                    selectedDocFilter === 'ALL' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="gap-1.5 text-xs"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload First Document
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDocFilter('ALL')}
                        className="text-xs"
                      >
                        Show All Documents
                      </Button>
                    )
                  }
                  className="py-8"
                />
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredDocuments.map((doc: DocumentItem) => {
                    const isVerified = doc.status === 'VERIFIED'
                    const isProcessing = doc.status === 'PROCESSING'
                    const isPending = doc.status === 'PENDING'
                    const isRejected = doc.status === 'REJECTED'

                    const fileSizeKB =
                      doc.fileSize ? (doc.fileSize / 1024).toFixed(0) :
                      doc.sizeBytes ? (doc.sizeBytes / 1024).toFixed(0) : null

                    const isLinkCopied = copiedDocId === doc._id

                    return (
                      <div
                        key={doc._id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-slate-50/50 p-2.5 rounded-lg transition-colors group"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Status Icon */}
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
                              isVerified
                                ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                                : isRejected
                                ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                                : isProcessing
                                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                                : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                            }`}
                          >
                            {isVerified ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : isRejected ? (
                              <AlertTriangle className="h-5 w-5" />
                            ) : isProcessing ? (
                              <RefreshCw className="h-5 w-5 animate-spin" />
                            ) : (
                              <Clock className="h-5 w-5" />
                            )}
                          </div>

                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-xs text-slate-900 group-hover:text-primary transition-colors truncate">
                                {doc.title || doc.type}
                              </span>
                              <Badge variant="neutral" size="sm" className="text-[10px]">
                                {doc.type}
                              </Badge>
                              <Badge
                                variant={
                                  isVerified
                                    ? 'success'
                                    : isRejected
                                    ? 'danger'
                                    : isProcessing
                                    ? 'default'
                                    : 'warning'
                                }
                                size="sm"
                                className="text-[10px]"
                              >
                                {isProcessing
                                  ? 'PROCESSING (BULLMQ)'
                                  : isPending
                                  ? 'PENDING'
                                  : doc.status}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              {fileSizeKB && <span>{fileSizeKB} KB</span>}
                              {fileSizeKB && <span>•</span>}
                              <span>Uploaded {formatRelativeTime(doc.createdAt)}</span>
                              {doc.verifiedAt && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-medium">
                                    Verified {formatDate(doc.verifiedAt)}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Prominent Rejection Reason Callout */}
                            {isRejected && (doc.verificationNotes || doc.failureReason) && (
                              <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                                <div>
                                  <span className="font-semibold block">Inspection Rejection Issue:</span>
                                  <span className="leading-relaxed">{doc.verificationNotes || doc.failureReason}</span>
                                </div>
                              </div>
                            )}

                            {/* Informational Notes for non-rejected items */}
                            {!isRejected && doc.verificationNotes && (
                              <p className="text-[11px] text-slate-600 mt-1 italic">
                                Note: {doc.verificationNotes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyDocLink(doc._id, doc.fileUrl)}
                            className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
                            title="Copy secure file link"
                          >
                            {isLinkCopied ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-[11px] text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span className="text-[11px]">Copy Link</span>
                              </>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')}
                            className="h-7 px-2.5 text-xs gap-1 text-slate-700 hover:text-primary hover:border-primary/50"
                          >
                            View File
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column (1/3 width): Client Details, Address, Advisor */}
        <div className="space-y-6">
          {/* Identity & Portal Account Card */}
          <Card className="p-5 border border-border/80 shadow-2xs bg-white space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <User className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-slate-900">Borrower Identity</h2>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Legal Name</span>
                <span className="font-semibold text-slate-900">
                  {client.firstName} {client.lastName}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Profile Classification</span>
                <Badge variant={typeConfig.badgeVariant} size="sm">
                  {typeConfig.label}
                </Badge>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Email Address</span>
                <a href={`mailto:${client.email}`} className="font-medium text-primary truncate max-w-[170px]">
                  {client.email}
                </a>
              </div>

              {client.phone && (
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium text-slate-800">{client.phone}</span>
                </div>
              )}

              {/* Portal Access Indicator */}
              <div className="pt-2">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 text-xs text-emerald-800">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold block">Portal Identity Active</span>
                    <span className="text-[11px] text-emerald-700">
                      Expat client is credentialed for self-service document access.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Registered Address */}
          <Card className="p-5 border border-border/80 shadow-2xs bg-white space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-slate-900">Registered Address</h2>
            </div>

            {client.address && (client.address.street || client.address.city) ? (
              <div className="text-xs text-slate-700 space-y-1">
                {client.address.street && <p className="font-medium">{client.address.street}</p>}
                <p>
                  {[client.address.postalCode, client.address.city].filter(Boolean).join(' ')}
                </p>
                {client.address.state && <p>{client.address.state}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No residential address on file.
              </p>
            )}
          </Card>

          {/* Assigned Advisor Card */}
          <Card className="p-5 border border-border/80 shadow-2xs bg-white space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-slate-900">Assigned Advisor</h2>
              </div>
              {isAssignedToCurrentUser && (
                <Badge variant="success" size="sm">
                  You
                </Badge>
              )}
            </div>

            {assignedAdvisor ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">{assignedAdvisor.name}</span>
                  <span className="text-muted-foreground text-[11px] block">{assignedAdvisor.role}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <a href={`mailto:${assignedAdvisor.email}`} className="text-primary hover:underline">
                    {assignedAdvisor.email}
                  </a>
                </div>
                {assignedAdvisor.phone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{assignedAdvisor.phone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>No advisor assigned directly.</p>
                <p className="text-[11px] text-slate-400">
                  Case is overseen by the brokerage team.
                </p>
              </div>
            )}
          </Card>

          {/* Audit & Timeline Card */}
          <Card className="p-5 border border-border/80 shadow-2xs bg-white space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <Calendar className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Timeline & Scope</h2>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Case Converted:</span>
                <span className="font-medium text-slate-700">{formatDate(client.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated:</span>
                <span className="font-medium text-slate-700">{formatRelativeTime(client.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tenant Isolation:</span>
                <span className="font-medium text-emerald-600">Enforced</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Upload Document Modal */}
      <UploadDocumentModal
        clientId={client._id}
        clientName={`${client.firstName} ${client.lastName}`}
        leadId={leadId}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          refetchDocs()
        }}
      />
    </div>
  )
}
