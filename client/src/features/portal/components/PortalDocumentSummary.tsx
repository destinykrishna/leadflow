import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Upload,
  ExternalLink,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'
import type { DocumentItem, DocumentStatus, DocumentType } from '@/types/document.types'

export interface PortalDocumentSummaryProps {
  documents: DocumentItem[]
  onOpenUpload: () => void
}

const STATUS_LABELS: Record<
  DocumentStatus,
  { label: string; badgeClass: string }
> = {
  VERIFIED: {
    label: 'Verified',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  PROCESSING: {
    label: 'Under Review',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  PENDING: {
    label: 'Queued',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  REJECTED: {
    label: 'Needs Attention',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
}

const TYPE_FRIENDLY_NAMES: Record<DocumentType, string> = {
  IDENTIFICATION: 'Identity Proof (PAN / Aadhaar / Passport)',
  PAYSLIP: 'Salary Slip / Form 16',
  BANK_STATEMENT: 'Bank Statement (6 Months)',
  INCOME_PROOF: 'Income Computation / ITR-V',
  CONTRACT: 'Sale Agreement / Builder Buyer Agreement',
  TAX_RETURN: 'Income Tax Return (ITR)',
  PROPERTY_DETAILS: 'Property Documents & Title Deed',
  OTHER: 'Financial Record',
}

export function PortalDocumentSummary({
  documents,
  onOpenUpload,
}: PortalDocumentSummaryProps) {
  const verifiedCount = documents.filter((d) => d.status === 'VERIFIED').length
  const processingCount = documents.filter((d) => d.status === 'PROCESSING').length
  const pendingCount = documents.filter((d) => d.status === 'PENDING').length
  const rejectedCount = documents.filter((d) => d.status === 'REJECTED').length

  // Show up to 5 most recent documents
  const recentDocs = React.useMemo(() => {
    return [...documents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }, [documents])

  return (
    <Card className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Required Documents
          </h2>
          <p className="text-xs text-slate-500">
            KYC, income proofs, and property verification records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onOpenUpload}
            className="h-8 gap-1.5 text-xs bg-primary text-white hover:bg-primary/90"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Document
          </Button>

          <Link to="/portal/documents">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <span>All Documents</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Restrained Status Metrics Row */}
      <div className="grid grid-cols-2 divide-y divide-slate-100 rounded-md border border-slate-200 bg-slate-50/50 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
        <div className="p-3 text-center sm:text-left">
          <p className="text-[11px] font-medium text-slate-500">Verified</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{verifiedCount}</p>
        </div>
        <div className="p-3 text-center sm:text-left">
          <p className="text-[11px] font-medium text-slate-500">Under Review</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{processingCount}</p>
        </div>
        <div className="p-3 text-center sm:text-left">
          <p className="text-[11px] font-medium text-slate-500">Queued</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{pendingCount}</p>
        </div>
        <div className="p-3 text-center sm:text-left">
          <p className="text-[11px] font-medium text-slate-500">Action Required</p>
          <p
            className={`mt-0.5 text-lg font-bold ${
              rejectedCount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {rejectedCount}
          </p>
        </div>
      </div>

      {/* Document List */}
      {recentDocs.length > 0 ? (
        <div className="divide-y divide-slate-100 rounded-md border border-slate-200 overflow-hidden">
          {recentDocs.map((doc) => {
            const statusConfig = STATUS_LABELS[doc.status] || STATUS_LABELS.PENDING
            const typeLabel = TYPE_FRIENDLY_NAMES[doc.type] || doc.type
            const isRejected = doc.status === 'REJECTED'

            return (
              <div
                key={doc._id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {doc.title || typeLabel}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {typeLabel} • Uploaded {formatDate(doc.createdAt)}
                    </p>

                    {isRejected && (doc.verificationNotes || doc.failureReason) && (
                      <div className="mt-1 flex items-start gap-1 text-[11px] text-rose-700">
                        <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>{doc.verificationNotes || doc.failureReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span
                    className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${statusConfig.badgeClass}`}
                  >
                    {statusConfig.label}
                  </span>

                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      title="View file"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-slate-200 p-6 text-center bg-slate-50/40">
          <p className="text-xs font-semibold text-slate-900">
            No Documents Uploaded
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Upload your PAN Card, Aadhaar, salary slips, and bank statements to begin verification.
          </p>
          <div className="mt-3">
            <Button size="sm" onClick={onOpenUpload} className="h-8 text-xs">
              Upload Document
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
