import * as React from 'react'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DocumentIntelligencePanel } from './DocumentIntelligencePanel'
import { useReviewDocument } from '../api/documents.api'
import type { DocumentItem } from '@/types/document.types'

export interface ReviewDocumentModalProps {
  document: DocumentItem | null
  isOpen: boolean
  onClose: () => void
  action: 'APPROVE' | 'REJECT'
  onSuccess?: () => void
}

const COMMON_REJECTION_REASONS = [
  'Illegible or blurry scan',
  'Name mismatch with borrower application',
  'Document expired or dated older than 3 months',
  'Incomplete statement / missing pages',
  'Salary slip missing company seal or signature',
  'Password-protected file or corrupted upload',
]

export function ReviewDocumentModal({
  document,
  isOpen,
  onClose,
  action,
  onSuccess,
}: ReviewDocumentModalProps) {
  const [notes, setNotes] = React.useState('')
  const [rejectionReason, setRejectionReason] = React.useState('')
  const [selectedQuickReason, setSelectedQuickReason] = React.useState('')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const reviewMutation = useReviewDocument()

  // Reset inputs when modal opens or document changes
  React.useEffect(() => {
    if (isOpen) {
      setNotes('')
      setRejectionReason('')
      setSelectedQuickReason('')
      setErrorMsg(null)
    }
  }, [isOpen, document?._id])

  if (!document) return null

  const isApprove = action === 'APPROVE'

  const handleSelectQuickReason = (reason: string) => {
    setSelectedQuickReason(reason)
    setRejectionReason(reason)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!isApprove && !rejectionReason.trim()) {
      setErrorMsg('A rejection reason is required to notify the borrower.')
      return
    }

    try {
      await reviewMutation.mutateAsync({
        documentId: document._id,
        status: isApprove ? 'VERIFIED' : 'REJECTED',
        verificationNotes: notes.trim() || undefined,
        rejectionReason: !isApprove ? rejectionReason.trim() : undefined,
        expectedVersion: document.__v,
        clientId: document.clientId || undefined,
        leadId: document.leadId || undefined,
      })
      onSuccess?.()
      onClose()
    } catch (err: any) {
      const serverMessage =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to submit review decision.'
      setErrorMsg(serverMessage)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                isApprove ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {isApprove ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {isApprove ? 'Approve Document' : 'Reject Document'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            {isApprove
              ? 'Mark this document as verified and compliant with mortgage underwriting standards.'
              : 'Reject this document and provide a reason so the borrower can upload a corrected version.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Document Summary Pill */}
          <div className="rounded-lg border border-border bg-slate-50/80 p-3 text-xs space-y-1">
            <div className="font-semibold text-slate-900 truncate">{document.title}</div>
            <div className="text-muted-foreground flex items-center justify-between">
              <span>Category: {document.type}</span>
              <span className="font-mono text-[11px]">{document.status}</span>
            </div>
          </div>

          {/* Automated Document Intelligence Panel */}
          <DocumentIntelligencePanel document={document} />

          {errorMsg && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {!isApprove && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-800 block">
                Quick Rejection Reasons
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_REJECTION_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => handleSelectQuickReason(reason)}
                    className={`text-[11px] px-2 py-1 rounded-md border text-left transition-colors ${
                      selectedQuickReason === reason
                        ? 'border-rose-500 bg-rose-50 text-rose-800 font-medium'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <label className="text-xs font-semibold text-slate-800 block">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Salary slips are password-protected; please upload unencrypted PDF."
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value)
                    setSelectedQuickReason('')
                  }}
                  className="mt-1 text-xs"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-800 block">
              Internal Verification Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder={
                isApprove
                  ? 'e.g. Cross-verified with HDFC bank statement credits on page 4.'
                  : 'Additional internal advisor notes...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={reviewMutation.isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={reviewMutation.isPending || (!isApprove && !rejectionReason.trim())}
              className={`text-xs gap-1.5 ${
                isApprove
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {reviewMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
