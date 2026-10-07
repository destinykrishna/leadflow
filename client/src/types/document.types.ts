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

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  IDENTIFICATION: 'Identity Proof (PAN / Aadhaar / Passport)',
  PAYSLIP: 'Salary Slip / Form 16',
  BANK_STATEMENT: 'Bank Statement (6M)',
  INCOME_PROOF: 'Income Proof / ITR',
  CONTRACT: 'Agreement to Sale',
  TAX_RETURN: 'Income Tax Return (ITR-V)',
  PROPERTY_DETAILS: 'Property Documents',
  OTHER: 'Other Document',
}

export const DOCUMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PENDING_REVIEW',
  'VERIFIED',
  'REJECTED',
] as const

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const CLASSIFICATION_STATUSES = [
  'RECOGNIZED',
  'UNKNOWN',
  'INSUFFICIENT_DATA',
] as const

export type ClassificationStatus = (typeof CLASSIFICATION_STATUSES)[number]

export interface ExtractedField<T = string | number> {
  value: T
  confidence: number
}

export interface DocumentClassification {
  status: ClassificationStatus
  detectedType: DocumentType | null
  confidence: number
  matchedKeywords: string[]
}

export interface DocumentExtractedFields {
  borrowerName?: ExtractedField<string> | null
  pan?: ExtractedField<string> | null
  employerName?: ExtractedField<string> | null
  grossIncome?: ExtractedField<number> | null
  netIncome?: ExtractedField<number> | null
  currency?: ExtractedField<string> | null
  documentPeriod?: ExtractedField<string> | null
  dateOfBirth?: ExtractedField<string> | null
  accountNumberMasked?: ExtractedField<string> | null
  bankName?: ExtractedField<string> | null
  ifscCode?: ExtractedField<string> | null
  assessmentYear?: ExtractedField<string> | null
  employeeId?: ExtractedField<string> | null
}

export interface DocumentExtractedData {
  classification: DocumentClassification
  fields: DocumentExtractedFields
  extractedAt: string
  modelVersion: string
}

export interface DocumentItem {
  _id: string
  brokerageId: string
  clientId?: string | null
  leadId?: string | null
  uploadedBy?: string | { _id: string; name?: string; email?: string }
  title: string
  type: DocumentType
  status: DocumentStatus
  fileUrl?: string
  downloadUrl?: string
  fileKey?: string
  fileId?: string
  mimeType?: string
  fileSize?: number
  sizeBytes?: number
  verificationNotes?: string
  failureReason?: string
  rejectionReason?: string | null
  verifiedBy?: string | { _id: string; name?: string; email?: string } | null
  metadata?: Record<string, unknown>
  extractedData?: DocumentExtractedData | null
  verifiedAt?: string
  __v?: number
  createdAt: string
  updatedAt: string
}

