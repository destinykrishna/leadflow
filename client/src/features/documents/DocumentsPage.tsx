import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  User,
  FolderOpen,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatRelativeTime, formatDate } from '@/lib/format'
import { useDocuments } from './api/documents.api'
import { useDocumentSocket } from './hooks/useDocumentSocket'
import {
  DOCUMENT_TYPES,
  type DocumentItem,
  type DocumentType,
  type DocumentStatus,
} from '@/types/document.types'

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  IDENTIFICATION: 'Identification (Pass/ID)',
  PAYSLIP: 'Payslip (Gehaltsabrechnung)',
  BANK_STATEMENT: 'Bank Statement (Kontoauszug)',
  INCOME_PROOF: 'Income Proof (Einkommensnachweis)',
  CONTRACT: 'Contract (Vertrag)',
  TAX_RETURN: 'Tax Return (Steuererklärung)',
  PROPERTY_DETAILS: 'Property Exposé & Plans',
  OTHER: 'Other Financial Record',
}

export function DocumentsPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState<string>('ALL')
  const [selectedType, setSelectedType] = React.useState<string>('ALL')
  const [copiedDocId, setCopiedDocId] = React.useState<string | null>(null)

  // 1. Fetch brokerage documents
  const {
    data: documents = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useDocuments(
    selectedStatus !== 'ALL' || selectedType !== 'ALL'
      ? {
          status: selectedStatus !== 'ALL' ? (selectedStatus as DocumentStatus) : undefined,
          type: selectedType !== 'ALL' ? (selectedType as DocumentType) : undefined,
        }
      : undefined
  )

  // 2. Real-time updates via Socket.IO
  useDocumentSocket({ enabled: true })

  const handleCopyLink = (docId: string, url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedDocId(docId)
    setTimeout(() => setCopiedDocId(null), 2000)
  }

  // Filter in-memory by search query
  const filteredDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const titleMatch = doc.title?.toLowerCase().includes(q)
      const typeMatch = doc.type.toLowerCase().includes(q)
      const keyMatch = doc.fileKey?.toLowerCase().includes(q)
      return titleMatch || typeMatch || keyMatch
    })
  }, [documents, searchQuery])

  // Aggregate KPI counts
  const totalCount = documents.length
  const verifiedCount = documents.filter((d) => d.status === 'VERIFIED').length
  const processingCount = documents.filter((d) => d.status === 'PROCESSING').length
  const pendingCount = documents.filter((d) => d.status === 'PENDING').length
  const rejectedCount = documents.filter((d) => d.status === 'REJECTED').length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Document Verification
            </h1>
            <Badge variant="neutral" size="sm">
              BullMQ Automated
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Review borrower payslips, tax records, SCHUFA certificates, and bank statements across all active files.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3.5 border border-border/80 shadow-2xs bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Files</span>
            <FolderOpen className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">{totalCount}</div>
          <span className="text-[11px] text-muted-foreground">Across all cases</span>
        </Card>

        <Card className="p-3.5 border border-emerald-200/80 shadow-2xs bg-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Verified</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-950">{verifiedCount}</div>
          <span className="text-[11px] text-emerald-700">Audit approved</span>
        </Card>

        <Card className="p-3.5 border border-blue-200/80 shadow-2xs bg-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800">Processing</span>
            <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
          </div>
          <div className="mt-2 text-xl font-bold text-blue-950">{processingCount}</div>
          <span className="text-[11px] text-blue-700">In BullMQ worker</span>
        </Card>

        <Card className="p-3.5 border border-amber-200/80 shadow-2xs bg-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Pending</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-amber-950">{pendingCount}</div>
          <span className="text-[11px] text-amber-700">Queued for review</span>
        </Card>

        <Card className="p-3.5 border border-rose-200/80 shadow-2xs bg-rose-50/30 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">Rejected</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-rose-950">{rejectedCount}</div>
          <span className="text-[11px] text-rose-700">Requires correction</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 border border-border/80 shadow-2xs bg-white space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by document title, filename, or document category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-slate-50/50 focus:bg-white"
            />
          </div>

          {/* Type Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Categories</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-border/60">
          {[
            { key: 'ALL', label: `All Statuses (${totalCount})` },
            { key: 'VERIFIED', label: `Verified (${verifiedCount})` },
            { key: 'PROCESSING', label: `Processing (${processingCount})` },
            { key: 'PENDING', label: `Pending (${pendingCount})` },
            { key: 'REJECTED', label: `Rejected (${rejectedCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedStatus(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors shrink-0 ${
                selectedStatus === tab.key
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Main Document List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Documents"
          message={(error as Error)?.message || 'Could not retrieve documents from vault.'}
          onRetry={() => refetch()}
        />
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-slate-300" />}
          title={
            searchQuery || selectedStatus !== 'ALL' || selectedType !== 'ALL'
              ? 'No Matching Documents'
              : 'No Documents Uploaded Yet'
          }
          description={
            searchQuery || selectedStatus !== 'ALL' || selectedType !== 'ALL'
              ? 'Try clearing your search filters or status selection to see more results.'
              : 'When borrower documents (payslips, tax assessments, contracts) are uploaded to client cases, they will appear here for processing.'
          }
          action={
            searchQuery || selectedStatus !== 'ALL' || selectedType !== 'ALL' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedStatus('ALL')
                  setSelectedType('ALL')
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
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
              <Card
                key={doc._id}
                className="p-4 border border-border/80 shadow-2xs bg-white hover:border-slate-300 transition-colors group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left Column: Icon and Info */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mt-0.5 ${
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
                        <span className="font-bold text-xs text-slate-900 group-hover:text-primary transition-colors truncate">
                          {doc.title || doc.fileKey || doc.type}
                        </span>
                        <Badge variant="neutral" size="sm" className="text-[10px]">
                          {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
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
                        {doc.fileKey && (
                          <span className="font-mono text-slate-600 truncate max-w-xs">
                            {doc.fileKey}
                          </span>
                        )}
                        {fileSizeKB && (
                          <>
                            <span>•</span>
                            <span>{fileSizeKB} KB</span>
                          </>
                        )}
                        <span>•</span>
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

                      {/* Associated Case / Client Link */}
                      {doc.clientId && (
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-600">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>Linked Client Case:</span>
                          <Link
                            to={`/app/clients/${doc.clientId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            View Case File &rarr;
                          </Link>
                        </div>
                      )}

                      {/* Rejection Alert Callout */}
                      {isRejected && (doc.verificationNotes || doc.failureReason) && (
                        <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                          <div>
                            <span className="font-semibold block">Inspection Rejection Issue:</span>
                            <span className="leading-relaxed">
                              {doc.verificationNotes || doc.failureReason}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Verification Notes */}
                      {!isRejected && doc.verificationNotes && (
                        <p className="text-[11px] text-slate-600 mt-1 italic">
                          Note: {doc.verificationNotes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyLink(doc._id, doc.fileUrl)}
                      className="h-8 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
                      title="Copy file URL"
                    >
                      {isLinkCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')}
                      className="h-8 px-3 text-xs gap-1 text-slate-700 hover:text-primary hover:border-primary/50 shadow-2xs"
                    >
                      View File
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
