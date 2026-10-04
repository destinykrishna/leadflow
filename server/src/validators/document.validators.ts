import path from 'node:path';
import { z } from 'zod';
import { DOCUMENT_TYPES, DOCUMENT_STATUSES, type DocumentType, type DocumentStatus } from '../models/document.model.js';
import { objectIdSchema } from './common.validators.js';
import { ValidationError } from '../utils/errors.js';

export const documentTypeEnum = z.enum(DOCUMENT_TYPES);
export const documentStatusEnum = z.enum(DOCUMENT_STATUSES);

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

export const MIME_TO_EXTENSIONS: Record<AllowedMimeType, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/tiff': ['.tif', '.tiff'],
};

/**
 * Inspects binary magic bytes to determine the true MIME type.
 * Supports PDF, JPEG, PNG, WEBP, and TIFF.
 */
export function detectMimeTypeFromBytes(buffer: Buffer): AllowedMimeType | null {
  if (!buffer || buffer.length < 3) {
    return null;
  }

  // PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A (\x89PNG\r\n\x1a\n)
  // Also supports buffers created from string literals where \x89 is utf8-encoded as 0xC2 0x89
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 9 &&
    buffer[0] === 0xc2 &&
    buffer[1] === 0x89 &&
    buffer[2] === 0x50 &&
    buffer[3] === 0x4e &&
    buffer[4] === 0x47 &&
    buffer[5] === 0x0d &&
    buffer[6] === 0x0a &&
    buffer[7] === 0x1a &&
    buffer[8] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // WEBP: "RIFF" at 0..3 and "WEBP" at 8..11
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // TIFF: 0x49 0x49 0x2A 0x00 (little-endian) or 0x4D 0x4D 0x00 0x2A (big-endian)
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
      (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a))
  ) {
    return 'image/tiff';
  }

  return null;
}

/**
 * Validates binary signature, declared MIME type, and optional filename extension.
 * Rejects mismatched content, disguised HTML/executables, or spoofed MIME types.
 */
export function validateFileSignature(
  buffer: Buffer,
  declaredMimeType: string,
  fileName?: string
): AllowedMimeType {
  if (!buffer || buffer.length === 0) {
    throw new ValidationError('File buffer is empty');
  }

  const detectedMime = detectMimeTypeFromBytes(buffer);
  if (!detectedMime) {
    throw new ValidationError(
      'Invalid or corrupted file content. Binary signature does not match allowed types (PDF, JPEG, PNG, WEBP, TIFF)'
    );
  }

  if (declaredMimeType && declaredMimeType.toLowerCase() !== detectedMime) {
    throw new ValidationError(
      `Declared MIME type "${declaredMimeType}" does not match actual file signature "${detectedMime}"`
    );
  }

  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext) {
      const allowedExts = MIME_TO_EXTENSIONS[detectedMime];
      if (!allowedExts || !allowedExts.includes(ext)) {
        throw new ValidationError(
          `File extension "${ext}" does not match detected binary format "${detectedMime}". Expected: ${allowedExts?.join(', ')}`
        );
      }
    }
  }

  return detectedMime;
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

const optionalObjectIdSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  objectIdSchema.optional()
);

/**
 * Validation schema for document upload metadata.
 */
export const uploadDocumentMetadataSchema = z.object({
  type: documentTypeEnum.default('OTHER'),
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title cannot exceed 200 characters')
    .optional(),
  clientId: optionalObjectIdSchema,
  leadId: optionalObjectIdSchema,
  notes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional(),
});

export type UploadDocumentMetadata = z.infer<typeof uploadDocumentMetadataSchema>;

/**
 * Validation schema for document query filters.
 */
export const documentQuerySchema = z.object({
  clientId: optionalObjectIdSchema,
  leadId: optionalObjectIdSchema,
  type: documentTypeEnum.optional(),
  status: documentStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  page: z.coerce.number().int().min(1).default(1),
});

export type DocumentQuery = z.infer<typeof documentQuerySchema>;

/**
 * Schema validating route params containing a document ID (:id).
 */
export const documentIdParamSchema = z.object({
  id: objectIdSchema,
});

export type DocumentIdParam = z.infer<typeof documentIdParamSchema>;

/**
 * Validation schema for human document verification / review.
 * Only VERIFIED or REJECTED statuses can be set by staff.
 * Rejection reason is required if status is REJECTED.
 */
export const reviewDocumentSchema = z
  .object({
    status: z.enum(['VERIFIED', 'REJECTED']),
    verificationNotes: z
      .string()
      .trim()
      .max(2000, 'Verification notes cannot exceed 2000 characters')
      .optional(),
    rejectionReason: z
      .string()
      .trim()
      .max(1000, 'Rejection reason cannot exceed 1000 characters')
      .optional(),
    expectedVersion: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.status === 'REJECTED') {
        return Boolean(data.rejectionReason && data.rejectionReason.trim().length > 0);
      }
      return true;
    },
    {
      message: 'Rejection reason is required when rejecting a document',
      path: ['rejectionReason'],
    }
  );

export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;

