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
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDate } from '@/lib/format'
import { useMyCase, useClientDocuments } from '@/features/clients/api/clients.api'
import { useDocumentSocket } from '@/features/documents/hooks/useDocumentSocket'
import { UploadDocumentModal } from '@/features/clients/components/UploadDocumentModal'
import type { DocumentStatus, DocumentType } from '@/types/document.types'

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; variant: 'success' | 'default' | 'warning' | 'danger'; icon: React.ComponentType<{ className?: string }> }
> = {
  VERIFIED: { label: 'Verified', variant: 'success', icon: CheckCircle2 },
  PROCESSING: { label: 'Under Review', variant: 'default', icon: Clock },
  PENDING: { label: 'Pending Queue', variant: 'warning', icon: Clock },
  REJECTED: { label: 'Needs Attention', variant: 'danger', icon: AlertTriangle },
}

const TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  IDENTIFICATION: 'Identity Proof (PAN / Aadhaar / Passport)',
  PAYSLIP: 'Salary Slip / Form 16',
  BANK_STATEMENT: 'Bank Account Statement (6 Months)',
  INCOME_PROOF: 'Income Proof / ITR Computation',
  CONTRACT: 'Employment Letter / Agreement to Sale',
  TAX_RETURN: 'Tax Return (ITR-V & 26AS)',
  PROPERTY_DETAILS: 'Property Documents & Layout',
  OTHER: 'Financial Record',
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

  // Realtime updates
  useDocumentSocket({
    clientId: client?._id,
    enabled: Boolean(client?._id),
  })

  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false)
  const [selectedStatusFilter, setSelectedStatusFilter] = React.useState<string>('ALL')

  // Filtered documents
  const filteredDocuments = React.useMemo(() => {
    if (selectedStatusFilter === 'ALL') return documents
    return documents.filter((doc) => doc.status === selectedStatusFilter)
  }, [documents, selectedStatusFilter])

  // Counts
  const verifiedCount = documents.filter((d) => d.status === 'VERIFIED').length
  const processingCount = documents.filter((d) => d.status === 'PROCESSING').length
  const pendingCount = documents.filter((d) => d.status === 'PENDING').length
  const rejectedCount = documents.filter((d) => d.status === 'REJECTED').length

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
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              Document Verification Center
            </h1>
            <Badge variant="neutral" size="sm">
              {documents.length} Files
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Upload and monitor required KYC, income proofs, and property title records for your home loan file.
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
            onClick={() => setIsUploadModalOpen(true)}
            className="h-9 gap-1.5 bg-primary text-white hover:bg-primary/90 text-xs shadow-2xs"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('ALL')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'ALL'
              ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            selectedStatusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{documents.length}</span>
            <span className={`text-[11px] ${selectedStatusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Files
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatusFilter('VERIFIED')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'VERIFIED'
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            selectedStatusFilter === 'VERIFIED' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{verifiedCount}</span>
            <span className={`text-[11px] ${selectedStatusFilter === 'VERIFIED' ? 'text-emerald-100' : 'text-emerald-700 font-medium'}`}>
              Verified
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatusFilter('PROCESSING')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'PROCESSING'
              ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            selectedStatusFilter === 'PROCESSING' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
          }`}>
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{processingCount}</span>
            <span className={`text-[11px] ${selectedStatusFilter === 'PROCESSING' ? 'text-blue-100' : 'text-blue-700 font-medium'}`}>
              Under Review
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatusFilter('PENDING')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'PENDING'
              ? 'border-amber-600 bg-amber-600 text-white shadow-2xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            selectedStatusFilter === 'PENDING' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'
          }`}>
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{pendingCount}</span>
            <span className={`text-[11px] ${selectedStatusFilter === 'PENDING' ? 'text-amber-100' : 'text-amber-700 font-medium'}`}>
              Pending Queue
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatusFilter('REJECTED')}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            selectedStatusFilter === 'REJECTED'
              ? 'border-rose-600 bg-rose-600 text-white shadow-2xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            selectedStatusFilter === 'REJECTED' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'
          }`}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none">{rejectedCount}</span>
            <span className={`text-[11px] ${selectedStatusFilter === 'REJECTED' ? 'text-rose-100' : 'text-rose-700 font-medium'}`}>
              Needs Action
            </span>
          </div>
        </button>
      </div>

      {/* Main Document List */}
      <Card className="p-5 border-slate-200/80 bg-white shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900">
            {selectedStatusFilter === 'ALL'
              ? 'All Uploaded Documents'
              : `${selectedStatusFilter} Documents (${filteredDocuments.length})`}
          </h2>

          {selectedStatusFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('ALL')}
              className="text-xs text-primary hover:underline font-medium"
            >
              Reset filter
            </button>
          )}
        </div>

        {filteredDocuments.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredDocuments.map((doc) => {
              const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.PENDING
              const StatusIcon = statusConfig.icon
              const typeDesc = TYPE_DESCRIPTIONS[doc.type] || doc.type
              const isRejected = doc.status === 'REJECTED'

              return (
                <div
                  key={doc._id}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 mt-0.5">
                      <FileText className="h-5 w-5" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {doc.title || doc.type}
                        </h3>
                        <span className="text-xs text-slate-500">
                          • {typeDesc}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400">
                        Submitted on {formatDate(doc.createdAt)}
                      </p>

                      {/* Rejection / Attention banner */}
                      {isRejected && (doc.verificationNotes || doc.failureReason) && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                          <div>
                            <span className="font-semibold">Verification Note:</span>{' '}
                            {doc.verificationNotes || doc.failureReason}
                            <div className="mt-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="h-6 text-[11px] bg-white border-rose-300 text-rose-700 hover:bg-rose-100"
                              >
                                Re-upload Corrected Document
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    <Badge variant={statusConfig.variant} size="sm">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>

                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <span>View Document</span>
                        <ExternalLink className="h-3 w-3 text-slate-400" />
                      </a>
                    )}
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
              {selectedStatusFilter === 'ALL'
                ? 'Upload your KYC proof, salary slips, and bank statements to start verification.'
                : `No documents found with status "${selectedStatusFilter}".`}
            </p>
            <div className="mt-4">
              <Button size="sm" onClick={() => setIsUploadModalOpen(true)} className="text-xs">
                Upload Document Now
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Helpful Checklist Card */}
      <Card className="p-5 border-slate-200/80 bg-slate-50/60">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs text-slate-600">
            <h4 className="font-semibold text-slate-900">
              Checklist of Essential Home Loan Documents
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li><strong>Identity & Address Proof:</strong> PAN Card (mandatory) and Aadhaar Card or Passport.</li>
              <li><strong>Income Proof (Salaried):</strong> Latest 3 months salary slips with employer seal and Form 16 / ITR.</li>
              <li><strong>Bank Statement:</strong> 6 months salary account bank statements showing monthly salary credits.</li>
              <li><strong>Property Papers:</strong> Draft sale agreement, title document, and approved layout plan.</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Upload Modal */}
      {client && (
        <UploadDocumentModal
          clientId={client._id}
          clientName={`${client.firstName} ${client.lastName}`}
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false)
            refetchDocs()
          }}
        />
      )}
    </div>
  )
}
