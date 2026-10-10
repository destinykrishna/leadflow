import type { DocumentItem } from '@/types/document.types'

/**
 * Evaluates whether a document text/note represents meaningful human-entered content
 * (e.g. custom rejection reasons or advisor review notes) versus routine system-generated
 * status messages from the OCR processing pipeline or background workers.
 */
export function isEligibleDocumentText(
  text: string | null | undefined,
  doc?: Partial<DocumentItem> | {
    rejectionReason?: string | null
    failureReason?: string | null
    verificationNotes?: string | null
    verifiedBy?: unknown
    metadata?: Record<string, unknown>
    status?: string
  }
): boolean {
  if (!text || !text.trim()) return false

  const clean = text.trim().replace(/^note:\s*/i, '').trim()
  if (!clean) return false

  // 1. Explicit metadata checks
  if (doc?.metadata?.isAutomated === true || doc?.metadata?.source === 'SYSTEM') {
    return false
  }

  // 2. Human rejection reasons entered by an advisor are always eligible
  if (doc?.rejectionReason && text.trim() === doc.rejectionReason.trim()) {
    return true
  }

  // 3. Known system worker signatures (OCR pipeline pre-checks and automated verifications)
  const systemSignatures = [
    /^automated\b/i,
    /technical pre-check/i,
    /awaiting human verification/i,
    /classified as [A-Z_]+ \(confidence:/i,
    /verification check passed/i,
    /automated verification check/i,
  ]

  for (const pattern of systemSignatures) {
    if (pattern.test(clean)) {
      return false
    }
  }

  return true
}
