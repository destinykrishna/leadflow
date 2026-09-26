import * as React from 'react'
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Info,
  ShieldAlert,
  Search,
  X,
  Loader2,
  FileCheck,
  Radio,
  FileSpreadsheet,
  FileBadge,
  Building2,
  UserCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDate } from '@/lib/format'
import { useMyCase, useClientDocuments } from '@/features/clients/api/clients.api'
import { useDocumentSocket } from '@/features/documents/hooks/useDocumentSocket'
import { UploadDocumentModal } from '@/features/clients/components/UploadDocumentModal'
import type { DocumentItem, DocumentStatus, DocumentType } from '@/types/document.types'

const STATUS_CONFIG: Record<
  DocumentStatus,
  {
    label: string
    shortLabel: string
    variant: 'success' | 'default' | 'warning' | 'danger'
    icon: React.ComponentType<{ className?: string }>
    bgLight: string
    borderLight: string
    textColor: string
  }
> = {
  VERIFIED: {
    label: 'Verified & Approved',
    shortLabel: 'Verified',
    variant: 'success',
    icon: CheckCircle2,
    bgLight: 'bg-emerald-50/70',
    borderLight: 'border-emerald-200',
    textColor: 'text-emerald-700',
  },
  PROCESSING: {
    label: 'Under Review',
    shortLabel: 'Under Review',
    variant: 'default',
    icon: Loader2,
    bgLight: 'bg-blue-50/70',
    borderLight: 'border-blue-200',
    textColor: 'text-blue-700',
  },
  PENDING: {
    label: 'Queued for Verification',
    shortLabel: 'Queued',
    variant: 'warning',
    icon: Clock,
    bgLight: 'bg-amber-50/70',
    borderLight: 'border-amber-200',
    textColor: 'text-amber-700',
  },
  REJECTED: {
    label: 'Needs Attention',
    shortLabel: 'Needs Action',
    variant: 'danger',
    icon: AlertTriangle,
    bgLight: 'bg-rose-50/70',
    borderLight: 'border-rose-200',
    textColor: 'text-rose-700',
  },
}

const TYPE_METADATA: Record<
  DocumentType,
  {
    label: string
    category: string
    desc: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  IDENTIFICATION: {
    label: 'Identity Proof (PAN / Aadhaar / Passport)',
    category: 'KYC & Identity',
    desc: 'Mandatory government photo ID (PAN Card required for Indian home loans)',
    icon: UserCheck,
  },
  PAYSLIP: {
    label: 'Salary Slip / Form 16',
    category: 'Income Verification',
    desc: 'Latest monthly salary slips (last 3-6 months) or employer Form 16',
    icon: FileSpreadsheet,
  },
  BANK_STATEMENT: {
    label: 'Bank Account Statement',
    category: 'Banking Records',
    desc: 'Primary salary account statement for the last 6 months showing salary credits',
    icon: FileText,
  },
  INCOME_PROOF: {
    label: 'Income Proof / ITR Statement',
    category: 'Income Verification',
    desc: 'Acknowledged ITR-V with computation of income for the last 2 assessment years',
    icon: FileCheck,
  },
  CONTRACT: {
    label: 'Agreement to Sale / Allotment Letter',
    category: 'Property Papers',
    desc: 'Draft or registered agreement to sale, builder buyer agreement, or allotment letter',
    icon: Building2,
  },
  TAX_RETURN: {
    label: 'Tax Return (ITR-V & 26AS)',
    category: 'Income Verification',
    desc: 'Form 26AS tax credit statement and ITR filing acknowledgement',
    icon: FileBadge,
  },
  PROPERTY_DETAILS: {
    label: 'Property Title Deeds & Layout',
    category: 'Property Papers',
    desc: 'Prior title deeds, sanctioned building layout plan, and property tax receipts',
    icon: Building2,
  },
  OTHER: {
    label: 'Other Financial Records',
    category: 'Supplementary Proofs',
    desc: 'CIBIL report, down payment investment proofs, or existing loan clearance NOCs',
    icon: FileText,
  },
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Document File'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ClientDocumentsPage() {
  const { data: client, isLoading: isClientLoading } = useMyCase()

  const {
    data: documents = [],
    isLoading: isDocsLoading,
    isError: isDocsError,
    error: docsError,
    refetch: refetchDocs,
    isFetching: isDocsFetching,
  } = useClientDocuments(client?._id)

  // Realtime updates via WebSocket
  useDocumentSocket({
    clientId: client?._id,
    enabled: Boolean(client?._id),
  })

  // Modal and re-upload state
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false)
  const [reuploadTargetDoc, setReuploadTargetDoc] = React.useState<DocumentItem | null>(null)
  const [initialDocType, setInitialDocType] = React.useState<DocumentType | undefined>(undefined)

  // Filters & Search
  const [selectedStatusFilter, setSelectedStatusFilter] = React.useState<string>('ALL')
  const [searchQuery, setSearchQuery] = React.useState('')

  // Computed counts
  const verifiedCount = documents.filter((d) => d.status === 'VERIFIED').length
  const processingCount = documents.filter((d) => d.status === 'PROCESSING').length
  const pendingCount = documents.filter((d) => d.status === 'PENDING').length
  const rejectedCount = documents.filter((d) => d.status === 'REJECTED').length

  // Filtered documents
  const filteredDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      const matchesStatus =
        selectedStatusFilter === 'ALL' || doc.status === selectedStatusFilter

      if (!matchesStatus) return false

      if (!searchQuery.trim()) return true

      const query = searchQuery.toLowerCase()
      const titleMatch = (doc.title || '').toLowerCase().includes(query)
      const typeLabel = (TYPE_METADATA[doc.type]?.label || doc.type).toLowerCase()
      const typeMatch = typeLabel.includes(query)
      const notesMatch = (doc.verificationNotes || doc.failureReason || '')
        .toLowerCase()
        .includes(query)

      return titleMatch || typeMatch || notesMatch
    })
  }, [documents, selectedStatusFilter, searchQuery])

  // Open upload modal fresh
  const handleOpenUpload = (type?: DocumentType) => {
    setReuploadTargetDoc(null)
    setInitialDocType(type)
    setIsUploadModalOpen(true)
  }

  // Open upload modal pre-filled for re-uploading a rejected document
  const handleReupload = (doc: DocumentItem) => {
    setReuploadTargetDoc(doc)
    setInitialDocType(doc.type)
    setIsUploadModalOpen(true)
  }

  // Check required document status for checklist
  const hasDocType = (type: DocumentType) => {
    return documents.some((d) => d.type === type && d.status !== 'REJECTED')
  }

  if (isClientLoading || isDocsLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  if (isDocsError) {
    return (
      <div className="py-12">
        <ErrorState
          title="Unable to Load Documents"
          message={(docsError as Error)?.message || 'Failed to retrieve your uploaded document records.'}
          onRetry={refetchDocs}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              Document Verification Center
            </h1>
            <Badge variant="neutral" size="sm">
              {documents.length} {documents.length === 1 ? 'File' : 'Files'}
            </Badge>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync Active</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Upload and track KYC identity proofs, income statements, and property title records for your Indian home loan verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDocs()}
            disabled={isDocsFetching}
            className="h-9 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isDocsFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenUpload()}
            className="h-9 gap-1.5 bg-primary text-white hover:bg-primary/90 text-xs font-semibold shadow-2xs"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Urgent Resubmission Notice if there are rejected documents */}
      {rejectedCount > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 mt-0.5">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-rose-900">
                  {rejectedCount} {rejectedCount === 1 ? 'Document Needs' : 'Documents Need'} Attention
                </h3>
                <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                  Verification was unable to approve some items. Please review the feedback below and upload corrected versions to avoid delay in loan sanction.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedStatusFilter('REJECTED')}
              className="text-xs font-semibold shrink-0 bg-white border-rose-300 text-rose-700 hover:bg-rose-100 h-8 self-start sm:self-center"
            >
              View Rejected Items
            </Button>
          </div>
        </div>
      )}

      {/* Metric Cards / Status Filter */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* ALL */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('ALL')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'ALL'
              ? 'border-slate-900 bg-slate-900 text-white shadow-2xs ring-2 ring-slate-900/10'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              selectedStatusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{documents.length}</span>
            <span className={`text-[11px] ${selectedStatusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Files
            </span>
          </div>
        </button>

        {/* VERIFIED */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('VERIFIED')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'VERIFIED'
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs ring-2 ring-emerald-600/10'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              selectedStatusFilter === 'VERIFIED' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{verifiedCount}</span>
            <span
              className={`text-[11px] ${
                selectedStatusFilter === 'VERIFIED' ? 'text-emerald-100' : 'text-emerald-700 font-medium'
              }`}
            >
              Verified
            </span>
          </div>
        </button>

        {/* PROCESSING */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('PROCESSING')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'PROCESSING'
              ? 'border-blue-600 bg-blue-600 text-white shadow-2xs ring-2 ring-blue-600/10'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              selectedStatusFilter === 'PROCESSING' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
            }`}
          >
            <Loader2 className={`h-4 w-4 ${selectedStatusFilter === 'PROCESSING' ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{processingCount}</span>
            <span
              className={`text-[11px] ${
                selectedStatusFilter === 'PROCESSING' ? 'text-blue-100' : 'text-blue-700 font-medium'
              }`}
            >
              Under Review
            </span>
          </div>
        </button>

        {/* PENDING */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('PENDING')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'PENDING'
              ? 'border-amber-600 bg-amber-600 text-white shadow-2xs ring-2 ring-amber-600/10'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              selectedStatusFilter === 'PENDING' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{pendingCount}</span>
            <span
              className={`text-[11px] ${
                selectedStatusFilter === 'PENDING' ? 'text-amber-100' : 'text-amber-700 font-medium'
              }`}
            >
              Queued
            </span>
          </div>
        </button>

        {/* REJECTED */}
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('REJECTED')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'REJECTED'
              ? 'border-rose-600 bg-rose-600 text-white shadow-2xs ring-2 ring-rose-600/10'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              selectedStatusFilter === 'REJECTED' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{rejectedCount}</span>
            <span
              className={`text-[11px] ${
                selectedStatusFilter === 'REJECTED' ? 'text-rose-100' : 'text-rose-700 font-medium'
              }`}
            >
              Needs Action
            </span>
          </div>
        </button>
      </div>

      {/* Essential Mortgage Documents Checklist */}
      <Card className="p-4 border-slate-200/90 bg-slate-50/50 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Indian Home Loan Checklist
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Required by lenders for mortgage sanction
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* 1. Identity & KYC */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                hasDocType('IDENTIFICATION') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {hasDocType('IDENTIFICATION') ? <CheckCircle2 className="h-4 w-4" /> : '1'}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-900 block truncate">
                  PAN & Aadhaar Card
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  Identity & KYC
                </span>
              </div>
            </div>
            {!hasDocType('IDENTIFICATION') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenUpload('IDENTIFICATION')}
                className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 font-medium shrink-0"
              >
                Upload
              </Button>
            )}
          </div>

          {/* 2. Salary Slips */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                hasDocType('PAYSLIP') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {hasDocType('PAYSLIP') ? <CheckCircle2 className="h-4 w-4" /> : '2'}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-900 block truncate">
                  Salary Slips (3M)
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  Income Proof
                </span>
              </div>
            </div>
            {!hasDocType('PAYSLIP') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenUpload('PAYSLIP')}
                className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 font-medium shrink-0"
              >
                Upload
              </Button>
            )}
          </div>

          {/* 3. Bank Statement */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                hasDocType('BANK_STATEMENT') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {hasDocType('BANK_STATEMENT') ? <CheckCircle2 className="h-4 w-4" /> : '3'}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-900 block truncate">
                  Bank Statement (6M)
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  Salary Account
                </span>
              </div>
            </div>
            {!hasDocType('BANK_STATEMENT') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenUpload('BANK_STATEMENT')}
                className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 font-medium shrink-0"
              >
                Upload
              </Button>
            )}
          </div>

          {/* 4. Property Papers */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                hasDocType('CONTRACT') || hasDocType('PROPERTY_DETAILS')
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {hasDocType('CONTRACT') || hasDocType('PROPERTY_DETAILS') ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  '4'
                )}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-900 block truncate">
                  Sale Agreement
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  Property Title
                </span>
              </div>
            </div>
            {!hasDocType('CONTRACT') && !hasDocType('PROPERTY_DETAILS') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenUpload('CONTRACT')}
                className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 font-medium shrink-0"
              >
                Upload
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Document List Card */}
      <Card className="p-5 border-slate-200/80 bg-white shadow-2xs space-y-4">
        {/* Controls: Search and Filter Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              {selectedStatusFilter === 'ALL'
                ? 'All Uploaded Documents'
                : `${STATUS_CONFIG[selectedStatusFilter as DocumentStatus]?.shortLabel || selectedStatusFilter} Documents`}
            </h2>
            <Badge variant="neutral" size="sm">
              {filteredDocuments.length}
            </Badge>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by title or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-7 h-8 text-xs bg-slate-50/50 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {(selectedStatusFilter !== 'ALL' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedStatusFilter('ALL')
                  setSearchQuery('')
                }}
                className="h-8 px-2 text-xs text-primary font-medium"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Document Items List */}
        {filteredDocuments.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredDocuments.map((doc) => {
              const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.PENDING
              const StatusIcon = statusConfig.icon
              const meta = TYPE_METADATA[doc.type] || TYPE_METADATA.OTHER
              const TypeIcon = meta.icon
              const isRejected = doc.status === 'REJECTED'
              const isProcessing = doc.status === 'PROCESSING'
              const isPending = doc.status === 'PENDING'
              const isVerified = doc.status === 'VERIFIED'
              const formattedSize = formatFileSize(doc.fileSize || doc.sizeBytes)

              return (
                <div
                  key={doc._id}
                  className={`py-4 transition-colors rounded-xl px-3 -mx-3 ${
                    isRejected ? 'bg-rose-50/30 border border-rose-100 my-2' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    {/* Left: Document info */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mt-0.5 ${
                          isVerified
                            ? 'bg-emerald-100 text-emerald-700'
                            : isProcessing
                              ? 'bg-blue-100 text-blue-700'
                              : isPending
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        <TypeIcon className="h-5 w-5" />
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {doc.title || meta.label}
                          </h3>
                          <Badge variant="neutral" size="sm" className="text-[11px] py-0 font-normal">
                            {meta.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                          <span>{formattedSize}</span>
                          <span>•</span>
                          <span>Submitted on {formatDate(doc.createdAt)}</span>
                          {doc.verifiedAt && isVerified && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-700 font-medium">
                                Approved on {formatDate(doc.verifiedAt)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Processing Status Microcopy */}
                        {isProcessing && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-700 pt-0.5">
                            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                            <span>Verification review in progress. We will notify you once checks conclude.</span>
                          </div>
                        )}

                        {isPending && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-700 pt-0.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>Queued in verification pipeline. Review will start shortly.</span>
                          </div>
                        )}

                        {/* Rejected Alert & Action Banner */}
                        {isRejected && (
                          <div className="mt-2.5 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 space-y-2">
                            <div className="flex items-start gap-2">
                              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                              <div className="space-y-1">
                                <span className="font-bold text-rose-900 block">
                                  Verification Issue Detected:
                                </span>
                                <p className="text-rose-800 leading-relaxed">
                                  {doc.verificationNotes ||
                                    doc.failureReason ||
                                    'Automated checks could not verify the authenticity or clarity of this document.'}
                                </p>
                                <p className="text-[11px] text-rose-600 italic">
                                  Guidance: Please ensure the document is flat, all four corners are visible, text is crisp and legible, and the file is not password-protected.
                                </p>
                              </div>
                            </div>

                            <div className="pt-1 flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleReupload(doc)}
                                className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5 shadow-2xs"
                              >
                                <UploadCloud className="h-3.5 w-3.5" />
                                Re-upload Corrected Document
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Status badge & View link */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end md:self-start pt-1">
                      <Badge variant={statusConfig.variant} size="sm" className="gap-1 font-semibold">
                        <StatusIcon className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} />
                        {statusConfig.label}
                      </Badge>

                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                          title="Open document securely in new tab"
                        >
                          <span>View Document</span>
                          <ExternalLink className="h-3 w-3 text-slate-400" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center bg-slate-50/50">
            <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900">
              No matching documents
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No documents found matching "${searchQuery}". Try a different keyword.`
                : selectedStatusFilter === 'ALL'
                  ? 'Upload your KYC proof, salary slips, and bank statements to start verification.'
                  : `No documents currently marked as "${selectedStatusFilter}".`}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {searchQuery && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearchQuery('')}
                  className="text-xs"
                >
                  Clear Search
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleOpenUpload()}
                className="text-xs font-semibold"
              >
                Upload Document Now
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Helpful Guidance Card */}
      <Card className="p-5 border-slate-200/80 bg-slate-50/70 shadow-2xs">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs text-slate-600">
            <h4 className="font-semibold text-slate-900">
              Important Verification Guidelines for Indian Home Loans
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
              <li>
                <strong>Legibility:</strong> Ensure scans are clear and not blurry. All numbers, dates, and names must match your Aadhaar and PAN records.
              </li>
              <li>
                <strong>Unencrypted Files:</strong> Please upload unprotected PDF files. If your e-Aadhaar or bank statement has a PDF password, remove it before uploading.
              </li>
              <li>
                <strong>Supported Formats:</strong> PDF, PNG, JPEG, WEBP, and TIFF up to 10MB per document.
              </li>
              <li>
                <strong>Need Help?</strong> Contact your dedicated loan advisor directly through the dashboard or case summary.
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Upload & Re-upload Modal */}
      {client && (
        <UploadDocumentModal
          clientId={client._id}
          clientName={`${client.firstName} ${client.lastName}`}
          isOpen={isUploadModalOpen}
          initialType={initialDocType}
          reuploadDoc={reuploadTargetDoc}
          onClose={() => {
            setIsUploadModalOpen(false)
            setReuploadTargetDoc(null)
            setInitialDocType(undefined)
          }}
          onSuccess={() => {
            setIsUploadModalOpen(false)
            setReuploadTargetDoc(null)
            setInitialDocType(undefined)
            refetchDocs()
          }}
        />
      )}
    </div>
  )
}
