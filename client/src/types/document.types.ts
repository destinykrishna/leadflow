export const DOCUMENT_TYPES = [
  'IDENTIFICATION',
  'PAYSLIP',
  'TAX_RETURN',
  'BANK_STATEMENT',
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
  uploadedBy?: string
  title: string
  type: DocumentType
  status: DocumentStatus
  fileUrl: string
  fileId: string
  mimeType: string
  sizeBytes: number
  metadata?: Record<string, unknown>
  failureReason?: string
  verifiedAt?: string
  createdAt: string
  updatedAt: string
}
