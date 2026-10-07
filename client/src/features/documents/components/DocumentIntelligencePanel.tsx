import * as React from 'react'
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  Check,
  ExternalLink,
  User,
  CreditCard,
  Building,
  DollarSign,
  Calendar,
  Hash,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { openDocumentSecurely } from '../api/documents.api'
import type { DocumentItem, ExtractedField } from '@/types/document.types'

export interface DocumentIntelligencePanelProps {
  document: DocumentItem
  className?: string
  compact?: boolean
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100)
  if (percent >= 85) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        {percent}% High
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <AlertTriangle className="h-3 w-3 text-amber-600" />
      {percent}% Moderate
    </span>
  )
}

function FieldItem({
  label,
  field,
  icon: Icon,
  formatValue,
}: {
  label: string
  field?: ExtractedField<any> | null
  icon: React.ComponentType<{ className?: string }>
  formatValue?: (val: any) => string
}) {
  const [copied, setCopied] = React.useState(false)

  if (!field || field.value === null || field.value === undefined) {
    return (
      <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-50/60 border border-slate-100 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Icon className="h-3.5 w-3.5 text-slate-300" />
          <span className="font-medium text-slate-500">{label}</span>
        </div>
        <span className="text-[11px] text-slate-400 italic">Not detected</span>
      </div>
    )
  }

  const displayVal = formatValue ? formatValue(field.value) : String(field.value)

  const handleCopy = () => {
    void navigator.clipboard.writeText(String(field.value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-white border border-slate-200 text-xs shadow-2xs hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="font-medium text-slate-600 shrink-0">{label}:</span>
        <span className="font-semibold text-slate-900 truncate" title={displayVal}>
          {displayVal}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <ConfidenceBadge confidence={field.confidence} />
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Copy value"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  )
}

export function DocumentIntelligencePanel({
  document,
  className = '',
}: DocumentIntelligencePanelProps) {
  const [isOpening, setIsOpening] = React.useState(false)

  const extracted = document.extractedData
  const classification = extracted?.classification
  const fields = extracted?.fields

  const handleOpenOriginal = async () => {
    try {
      setIsOpening(true)
      await openDocumentSecurely(document)
    } catch (err) {
      console.error('Failed to open document file', err)
    } finally {
      setIsOpening(false)
    }
  }

  // 1. Handling state when no extracted data exists
  if (!extracted || !classification) {
    const isPdf =
      document.mimeType === 'application/pdf' ||
      document.title?.toLowerCase().endsWith('.pdf')
    const isProcessing = document.status === 'PROCESSING'

    return (
      <div
        className={`rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <Sparkles className="h-4 w-4 text-slate-400" />
            <span>Automated Document Intelligence</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenOriginal}
            disabled={isOpening}
            className="h-7 px-2.5 text-[11px] gap-1 shadow-2xs"
          >
            <ExternalLink className="h-3 w-3" />
            View Original File
          </Button>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-slate-200 text-slate-600">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-slate-800">
              {isProcessing
                ? 'Automated pre-checks are running...'
                : isPdf
                ? 'Standard PDF Document'
                : 'No automated pre-check data available'}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {isProcessing
                ? 'Classification and entity extraction are in progress. This file will update automatically once pre-checks complete.'
                : isPdf
                ? 'Automated optical pre-checks are optimized for scanned images. Multi-page PDFs queue safely for manual human verification.'
                : 'This document does not have cached optical extraction records. Please inspect the original file manually to complete underwriting review.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 2. Handling UNKNOWN or INSUFFICIENT_DATA classification states
  if (classification.status === 'UNKNOWN' || classification.status === 'INSUFFICIENT_DATA') {
    const isInsufficient = classification.status === 'INSUFFICIENT_DATA'
    return (
      <div
        className={`rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-xs space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span>Automated Document Intelligence</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenOriginal}
            disabled={isOpening}
            className="h-7 px-2.5 text-[11px] gap-1 shadow-2xs border-amber-300 hover:bg-amber-100/50"
          >
            <ExternalLink className="h-3 w-3 text-amber-700" />
            View Original File
          </Button>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-amber-200 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">
              {isInsufficient
                ? 'Insufficient Legible Content Detected'
                : 'Unrecognized Document Category'}
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {isInsufficient
                ? 'Text could not be extracted with sufficient clarity. The scan may be blurry or low-resolution. Manual inspection is required.'
                : 'The document text was readable, but could not be confidently matched to a standard Salary Slip, Bank Statement, ITR, or KYC format. Manual review is required.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. Recognized Document Intelligence Display
  const detectedType = classification.detectedType || document.type
  const typeMatchesDeclared = detectedType === document.type
  const currencySymbol = fields?.currency?.value === 'INR' ? '₹' : fields?.currency?.value || ''

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-3.5 ${className}`}
    >
      {/* Header with Classification and Original Doc Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-100 text-purple-700">
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="font-bold text-slate-900">Automated Pre-Check Analysis</span>
            <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
              AI Suggested
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
            <span className="text-slate-500">Detected Category:</span>
            <span className="font-semibold text-slate-800">{detectedType}</span>
            <ConfidenceBadge confidence={classification.confidence} />

            {!typeMatchesDeclared && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                <AlertTriangle className="h-2.5 w-2.5" />
                Declared as {document.type}
              </span>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpenOriginal}
          disabled={isOpening}
          className="h-7 px-2.5 text-[11px] gap-1 self-start sm:self-auto bg-white shadow-2xs hover:bg-slate-50"
        >
          <ExternalLink className="h-3 w-3 text-slate-600" />
          View Original File
        </Button>
      </div>

      {/* Underwriting Human Review Advisory */}
      <div className="flex items-center gap-2 rounded-lg bg-blue-50/70 border border-blue-200/80 px-3 py-2 text-[11px] text-blue-900">
        <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
        <span>
          <strong>Advisory:</strong> Field values below are automated suggestions. Compare with the original document before underwriting decision.
        </span>
      </div>

      {/* Structured Fields Grid */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
          Extracted Entities
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Borrower Name */}
          <FieldItem
            label="Borrower Name"
            field={fields?.borrowerName}
            icon={User}
          />

          {/* PAN Number */}
          <FieldItem
            label="PAN Number"
            field={fields?.pan}
            icon={CreditCard}
            formatValue={(v) => String(v).toUpperCase()}
          />

          {/* Employer Name */}
          <FieldItem
            label="Employer"
            field={fields?.employerName}
            icon={Building}
          />

          {/* Gross Salary / Income */}
          <FieldItem
            label="Gross Income"
            field={fields?.grossIncome}
            icon={DollarSign}
            formatValue={(v) =>
              typeof v === 'number'
                ? `${currencySymbol} ${v.toLocaleString('en-IN')}`
                : String(v)
            }
          />

          {/* Net Salary / Pay */}
          <FieldItem
            label="Net Pay"
            field={fields?.netIncome}
            icon={DollarSign}
            formatValue={(v) =>
              typeof v === 'number'
                ? `${currencySymbol} ${v.toLocaleString('en-IN')}`
                : String(v)
            }
          />

          {/* Document Period */}
          <FieldItem
            label="Period / Dates"
            field={fields?.documentPeriod}
            icon={Calendar}
          />

          {/* Bank Name */}
          <FieldItem
            label="Bank Name"
            field={fields?.bankName}
            icon={Building}
          />

          {/* Masked Account Number */}
          <FieldItem
            label="Account No."
            field={fields?.accountNumberMasked}
            icon={Hash}
          />

          {/* IFSC Code */}
          <FieldItem
            label="IFSC Code"
            field={fields?.ifscCode}
            icon={Hash}
          />

          {/* Assessment Year (for ITR) */}
          <FieldItem
            label="Assessment Year"
            field={fields?.assessmentYear}
            icon={Calendar}
          />

          {/* Employee ID */}
          <FieldItem
            label="Employee ID"
            field={fields?.employeeId}
            icon={Hash}
          />
        </div>
      </div>
    </div>
  )
}
