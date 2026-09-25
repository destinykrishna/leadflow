import * as React from 'react'
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  FileCheck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useUploadClientDocument } from '../api/clients.api'
import {
  DOCUMENT_TYPES,
  type DocumentItem,
  type DocumentType,
} from '@/types/document.types'

export interface UploadDocumentModalProps {
  clientId: string
  clientName?: string
  leadId?: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: (doc: DocumentItem) => void
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, { label: string; desc: string }> = {
  IDENTIFICATION: {
    label: 'Identification',
    desc: 'Passport, National ID, or German residence permit (Aufenthaltstitel)',
  },
  PAYSLIP: {
    label: 'Payslip (Gehaltsabrechnung)',
    desc: 'Recent monthly salary statements from employer (last 3 months)',
  },
  BANK_STATEMENT: {
    label: 'Bank Statement (Kontoauszug)',
    desc: 'Checking and savings account statements showing cash flow',
  },
  INCOME_PROOF: {
    label: 'Income Proof',
    desc: 'Tax assessment (Steuerbescheid), freelance profit/loss or dividend records',
  },
  CONTRACT: {
    label: 'Employment or Purchase Contract',
    desc: 'Permanent work contract or property purchase offer/draft',
  },
  TAX_RETURN: {
    label: 'Tax Return (Steuererklärung)',
    desc: 'Official tax returns filed with Finanzamt',
  },
  PROPERTY_DETAILS: {
    label: 'Property Details (Exposé)',
    desc: 'Floor plans, energy pass (Energieausweis), land register excerpt (Grundbuch)',
  },
  OTHER: {
    label: 'Other Financial Document',
    desc: 'SCHUFA certificate, gift letters, equity proof, or misc documentation',
  },
}

export function UploadDocumentModal({
  clientId,
  clientName,
  leadId,
  isOpen,
  onClose,
  onSuccess,
}: UploadDocumentModalProps) {
  const uploadMutation = useUploadClientDocument()

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [docType, setDocType] = React.useState<DocumentType>('IDENTIFICATION')
  const [title, setTitle] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFile(null)
      setDocType('IDENTIFICATION')
      setTitle('')
      setNotes('')
      setErrorMessage(null)
      setIsSuccess(false)
    }
  }, [isOpen])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 10MB limit.')
      return
    }

    setErrorMessage(null)
    setSelectedFile(file)
    if (!title.trim()) {
      // Default title to filename without extension
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      setTitle(nameWithoutExt)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.')
      return
    }

    setErrorMessage(null)

    try {
      const doc = await uploadMutation.mutateAsync({
        clientId,
        leadId,
        file: selectedFile,
        type: docType,
        title: title.trim() || selectedFile.name,
        notes: notes.trim() || undefined,
      })

      setIsSuccess(true)
      onSuccess?.(doc)
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string } } }
        message?: string
      }
      setErrorMessage(
        errorObj.response?.data?.error?.message ||
          errorObj.message ||
          'Failed to upload document. Please ensure file format is allowed (PDF, JPEG, PNG, WEBP, TIFF).'
      )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg p-6">
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Document Uploaded Successfully</h3>
            <p className="text-xs text-muted-foreground">
              The file was securely stored and queued for automated verification.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Upload Case Document
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Attach verification documents to {clientName ? `${clientName}'s` : 'this'} mortgage file.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {errorMessage && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Document Type Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Document Classification</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type]?.label || type}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[docType]?.desc}
              </p>
            </div>

            {/* File Dropzone / Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Select File</label>
              <div className="relative border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors bg-slate-50/50">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="client-doc-file-input"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-800 font-medium">
                    <FileCheck className="h-5 w-5 text-emerald-600" />
                    <span className="truncate max-w-[240px]">{selectedFile.name}</span>
                    <Badge variant="neutral" size="sm">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </Badge>
                  </div>
                ) : (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <Upload className="h-6 w-6 mx-auto text-slate-400" />
                    <div>
                      <span className="font-semibold text-primary">Click to choose a file</span> or drag & drop
                    </div>
                    <p className="text-[11px] text-slate-400">PDF, PNG, JPG, WEBP, TIFF (Max 10MB)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Document Title (Optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Display Title <span className="font-normal text-muted-foreground">(Optional)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Passport - Primary Borrower"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            {/* Verification / Internal Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Verification Notes <span className="font-normal text-muted-foreground">(Optional)</span>
              </label>
              <textarea
                placeholder="Add internal notes for document verification..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={uploadMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedFile || uploadMutation.isPending}
                className="w-full sm:w-auto gap-1.5"
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
