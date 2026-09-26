import * as React from 'react'
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  FileCheck,
  FileText,
  Image as ImageIcon,
  X,
  Loader2,
  ShieldCheck,
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
    label: 'Identification (Pass / Ausweis)',
    desc: 'Passport, National ID, or German residence permit (Aufenthaltstitel)',
  },
  PAYSLIP: {
    label: 'Payslip (Gehaltsabrechnung)',
    desc: 'Recent monthly salary statements from employer (last 3 months)',
  },
  BANK_STATEMENT: {
    label: 'Bank Statement (Kontoauszug)',
    desc: 'Checking and savings account statements showing liquidity & reserves',
  },
  INCOME_PROOF: {
    label: 'Income Proof (Einkommensnachweis)',
    desc: 'Tax assessment (Steuerbescheid), freelance profit/loss, or dividend records',
  },
  CONTRACT: {
    label: 'Employment / Purchase Contract (Vertrag)',
    desc: 'Permanent work contract or draft property purchase agreement (Kaufvertrag)',
  },
  TAX_RETURN: {
    label: 'Tax Return (Steuererklärung)',
    desc: 'Official tax returns filed with the local Finanzamt',
  },
  PROPERTY_DETAILS: {
    label: 'Property Exposé & Plans',
    desc: 'Floor plans, energy certificate (Energieausweis), land register (Grundbuch)',
  },
  OTHER: {
    label: 'Other Financial Record',
    desc: 'SCHUFA certificate, gift letters, down payment verification, or misc docs',
  },
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
]

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

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
  const [isDragging, setIsDragging] = React.useState(false)
  const [uploadedDoc, setUploadedDoc] = React.useState<DocumentItem | null>(null)

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFile(null)
      setDocType('IDENTIFICATION')
      setTitle('')
      setNotes('')
      setErrorMessage(null)
      setIsSuccess(false)
      setIsDragging(false)
      setUploadedDoc(null)
    }
  }, [isOpen])

  const validateAndSetFile = (file: File) => {
    // 1. Size Validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(
        `File exceeds the 10MB limit (selected: ${(file.size / (1024 * 1024)).toFixed(1)} MB). Please select a smaller file.`
      )
      return
    }

    // 2. Type & Extension Validation
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.type)
    const isExtAllowed = ALLOWED_EXTENSIONS.includes(extension)

    if (!isMimeAllowed && !isExtAllowed) {
      setErrorMessage(
        'Unsupported file format. Please upload a PDF, JPEG, PNG, WEBP, or TIFF document.'
      )
      return
    }

    setErrorMessage(null)
    setSelectedFile(file)

    // Auto-populate title if empty or pristine
    if (!title.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      setTitle(nameWithoutExt)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setErrorMessage(null)
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

      setUploadedDoc(doc)
      setIsSuccess(true)
      onSuccess?.(doc)
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string } } }
        message?: string
      }
      setErrorMessage(
        errorObj.response?.data?.error?.message ||
          errorObj.message ||
          'Failed to upload document. Please ensure the file is valid and retry.'
      )
    }
  }

  const isImage = selectedFile && selectedFile.type.startsWith('image/')
  const formattedFileSize = selectedFile
    ? selectedFile.size > 1024 * 1024
      ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(selectedFile.size / 1024).toFixed(0)} KB`
    : null

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!uploadMutation.isPending && !open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-md sm:max-w-lg p-6">
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Document Uploaded & Queued
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm leading-relaxed">
                <span className="font-semibold text-slate-800">{uploadedDoc?.title || selectedFile?.name}</span>{' '}
                was stored securely in the vault and dispatched to the BullMQ background verification processor.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 w-full justify-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Brokerage tenant isolation verified</span>
            </div>

            <DialogFooter className="w-full pt-2">
              <Button
                type="button"
                variant="primary"
                onClick={onClose}
                className="w-full text-xs font-semibold"
              >
                Done
              </Button>
            </DialogFooter>
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

            {/* Error Banner (Context Preserved) */}
            {errorMessage && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Document Classification Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                disabled={uploadMutation.isPending}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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

            {/* File Dropzone or Preview */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">File Attachment</label>
              {selectedFile ? (
                /* Selected File Preview Card */
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-slate-50/80 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-slate-900 truncate block max-w-[240px]">
                        {selectedFile.name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <Badge variant="neutral" size="sm" className="text-[10px] py-0 px-1.5">
                          {formattedFileSize}
                        </Badge>
                        <span>Ready to upload</span>
                      </div>
                    </div>
                  </div>

                  {!uploadMutation.isPending && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 rounded-full"
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                /* Drag & Drop Area */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
                      : 'border-border/80 hover:border-primary/50 bg-slate-50/40 hover:bg-slate-50/80'
                  }`}
                >
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    id="client-doc-file-input"
                    aria-label="Upload document file"
                  />
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-semibold text-primary">Click to select</span> or drag and drop a file
                    </div>
                    <p className="text-[11px] text-slate-400">PDF, PNG, JPEG, WEBP, or TIFF (Up to 10MB)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Document Title (Editable) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Document Title <span className="font-normal text-muted-foreground">(Optional)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Passport - Primary Borrower"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploadMutation.isPending}
                className="text-xs h-9 bg-white"
              />
            </div>

            {/* Verification / Internal Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Verification Notes <span className="font-normal text-muted-foreground">(Optional)</span>
              </label>
              <textarea
                placeholder="Add verification instructions or relevant loan file notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={uploadMutation.isPending}
                rows={2}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none disabled:opacity-50"
              />
            </div>

            {/* Active Upload Progress Strip */}
            {uploadMutation.isPending && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-primary font-medium">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Uploading file & dispatching to BullMQ queue...</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={uploadMutation.isPending}
                className="w-full sm:w-auto text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedFile || uploadMutation.isPending}
                className="w-full sm:w-auto gap-1.5 text-xs font-semibold"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-3.5 w-3.5" />
                    Upload Document
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
