import * as React from 'react'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Radio,
  UserCheck,
  FileSpreadsheet,
  FileText,
  Building2,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { DocumentItem, DocumentType } from '@/types/document.types'

export interface ClientDocumentChecklistCardProps {
  documents: DocumentItem[]
  onUploadClick?: (type: DocumentType) => void
  isClientView?: boolean
}

interface ChecklistItemConfig {
  type: DocumentType
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
}

const CHECKLIST_ITEMS: ChecklistItemConfig[] = [
  {
    type: 'IDENTIFICATION',
    title: 'PAN & Aadhaar KYC',
    subtitle: 'Government identity proof',
    icon: UserCheck,
  },
  {
    type: 'PAYSLIP',
    title: 'Salary Slips (3M)',
    subtitle: 'Income verification',
    icon: FileSpreadsheet,
  },
  {
    type: 'BANK_STATEMENT',
    title: 'Bank Statement (6M)',
    subtitle: 'Primary salary account',
    icon: FileText,
  },
  {
    type: 'CONTRACT',
    title: 'Sale Agreement / Allotment',
    subtitle: 'Property documentation',
    icon: Building2,
  },
]

export function ClientDocumentChecklistCard({
  documents,
  onUploadClick,
  isClientView = false,
}: ClientDocumentChecklistCardProps) {
  // Only documents with status === 'VERIFIED' count as complete
  const verifiedCount = CHECKLIST_ITEMS.filter((item) =>
    documents.some((d) => d.type === item.type && d.status === 'VERIFIED')
  ).length

  const completionPercent = Math.round((verifiedCount / CHECKLIST_ITEMS.length) * 100)

  return (
    <Card className="p-4 border-slate-200/90 bg-slate-50/50 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {isClientView ? 'Your Mortgage Checklist' : 'Mandatory Mortgage Checklist'}
          </h3>
          <Badge
            variant={completionPercent === 100 ? 'success' : 'default'}
            size="sm"
            className="text-[10px] ml-1"
          >
            {verifiedCount} of {CHECKLIST_ITEMS.length} Verified
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          <span>Completion: {completionPercent}%</span>
          <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                completionPercent === 100 ? 'bg-emerald-600' : 'bg-primary'
              }`}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {CHECKLIST_ITEMS.map((item) => {
          const matchingDocs = documents.filter((d) => d.type === item.type)
          const isVerified = matchingDocs.some((d) => d.status === 'VERIFIED')
          const isPendingReview =
            !isVerified && matchingDocs.some((d) => d.status === 'PENDING_REVIEW')
          const isProcessing =
            !isVerified &&
            !isPendingReview &&
            matchingDocs.some((d) => d.status === 'PROCESSING' || d.status === 'PENDING')
          const isRejected =
            !isVerified &&
            !isPendingReview &&
            !isProcessing &&
            matchingDocs.some((d) => d.status === 'REJECTED')
          const isMissing = matchingDocs.length === 0

          const ItemIcon = item.icon

          return (
            <div
              key={item.type}
              className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                isVerified
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : isPendingReview
                  ? 'border-amber-200 bg-amber-50/40'
                  : isRejected
                  ? 'border-rose-200 bg-rose-50/40'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      isVerified
                        ? 'bg-emerald-100 text-emerald-700'
                        : isPendingReview
                        ? 'bg-amber-100 text-amber-700'
                        : isRejected
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isVerified ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isPendingReview ? (
                      <Clock className="h-4 w-4" />
                    ) : isRejected ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <ItemIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-900 block truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {item.subtitle}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-medium">
                  {isVerified ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </span>
                  ) : isPendingReview ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Awaiting Review
                    </span>
                  ) : isProcessing ? (
                    <span className="text-blue-700 flex items-center gap-1">
                      In Pre-Checks
                    </span>
                  ) : isRejected ? (
                    <span className="text-rose-700 font-semibold flex items-center gap-1">
                      Needs Re-upload
                    </span>
                  ) : (
                    <span className="text-slate-400">Missing File</span>
                  )}
                </span>

                {onUploadClick && (isMissing || isRejected) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onUploadClick(item.type)}
                    className="h-5 px-1.5 text-[10px] text-primary hover:bg-primary/10 gap-0.5"
                  >
                    <Upload className="h-2.5 w-2.5" />
                    <span>Upload</span>
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
