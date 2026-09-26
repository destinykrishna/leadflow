import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'
import type { DocumentItem, DocumentStatus, DocumentType } from '@/types/document.types'

export interface PortalDocumentSummaryProps {
  documents: DocumentItem[]
  onOpenUpload: () => void
}

const STATUS_BADGE_CONFIG: Record<
  DocumentStatus,
  { label: string; variant: 'success' | 'default' | 'warning' | 'danger'; icon: React.ComponentType<{ className?: string }> }
> = {
  VERIFIED: { label: 'Verified', variant: 'success', icon: CheckCircle2 },
  PROCESSING: { label: 'Under Review', variant: 'default', icon: Clock },
  PENDING: { label: 'Pending Queue', variant: 'warning', icon: Clock },
  REJECTED: { label: 'Needs Attention', variant: 'danger', icon: AlertTriangle },
}

const TYPE_FRIENDLY_NAMES: Record<DocumentType, string> = {
  IDENTIFICATION: 'Identity Proof (PAN / Aadhaar / Passport)',
  PAYSLIP: 'Salary Slip / Form 16',
  BANK_STATEMENT: 'Bank Account Statement',
  INCOME_PROOF: 'Income Proof / ITR Computation',
  CONTRACT: 'Employment / Sale Agreement',
  TAX_RETURN: 'Tax Return (ITR-V)',
  PROPERTY_DETAILS: 'Property Documents & Layout',
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
    <Card className="p-5 border-slate-200/80 bg-white shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Document Verification Summary
          </h2>
          <p className="text-xs text-muted-foreground">
            Current status of required KYC, income, and property documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onOpenUpload}
            className="h-8 gap-1.5 bg-primary text-white hover:bg-primary/90 shadow-2xs text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Document
          </Button>

          <Link to="/portal/documents">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-slate-200 hover:bg-slate-50"
            >
              <span>All Documents</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Counters Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-base font-bold text-slate-900 leading-none">
              {verifiedCount}
            </span>
            <span className="text-[11px] font-medium text-emerald-800">
              Verified
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-blue-100 bg-blue-50/50 p-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-base font-bold text-slate-900 leading-none">
              {processingCount}
            </span>
            <span className="text-[11px] font-medium text-blue-800">
              Under Review
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-amber-100 bg-amber-50/50 p-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-600 text-white">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-base font-bold text-slate-900 leading-none">
              {pendingCount}
            </span>
            <span className="text-[11px] font-medium text-amber-800">
              Pending Queue
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-rose-100 bg-rose-50/50 p-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-600 text-white">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-base font-bold text-slate-900 leading-none">
              {rejectedCount}
            </span>
            <span className="text-[11px] font-medium text-rose-800">
              Needs Attention
            </span>
          </div>
        </div>
      </div>

      {/* Document List / Empty State */}
      {recentDocs.length > 0 ? (
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {recentDocs.map((doc) => {
            const statusConfig = STATUS_BADGE_CONFIG[doc.status] || STATUS_BADGE_CONFIG.PENDING
            const StatusIcon = statusConfig.icon
            const typeLabel = TYPE_FRIENDLY_NAMES[doc.type] || doc.type
            const isRejected = doc.status === 'REJECTED'

            return (
              <div
                key={doc._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2.5 bg-white hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 mt-0.5">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {doc.title || doc.type}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({typeLabel})
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Uploaded on {formatDate(doc.createdAt)}
                    </p>

                    {/* Inspection note if rejected */}
                    {isRejected && (doc.verificationNotes || doc.failureReason) && (
                      <div className="flex items-start gap-1.5 mt-1 rounded-md bg-rose-50 border border-rose-200/80 px-2 py-1 text-[11px] text-rose-800">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-600 mt-0.5" />
                        <span>
                          <strong>Action required:</strong>{' '}
                          {doc.verificationNotes || doc.failureReason}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <Badge variant={statusConfig.variant} size="sm">
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig.label}
                  </Badge>

                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      title="View file in secure tab"
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
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/40">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Upload className="h-5 w-5" />
          </div>
          <h3 className="mt-2 text-xs font-semibold text-slate-900">
            No Documents Uploaded Yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Upload your PAN Card, Aadhaar, salary slips, and bank statements to begin instant automated verification.
          </p>
          <div className="mt-3">
            <Button size="sm" onClick={onOpenUpload} className="h-8 text-xs">
              Upload Your First Document
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
