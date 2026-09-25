export const DOCUMENT_TYPES = [
  'IDENTIFICATION',
  'PAYSLIP',
  'BANK_STATEMENT',
  'INCOME_PROOF',
  'CONTRACT',
  'TAX_RETURN',
  'PROPERTY_DETAILS',
  'OTHER',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'VERIFIED',
  'REJECTED',
] as const

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export interface DocumentItem {
  _id: string
  brokerageId: string
  clientId?: string | null
  leadId?: string | null
  uploadedBy?: string | { _id: string; name?: string; email?: string }
  title: string
  type: DocumentType
  status: DocumentStatus
  fileUrl: string
  fileKey?: string
  fileId?: string
  mimeType?: string
  fileSize?: number
  sizeBytes?: number
  verificationNotes?: string
  failureReason?: string
  metadata?: Record<string, unknown>
  verifiedAt?: string
  createdAt: string
  updatedAt: string
}

