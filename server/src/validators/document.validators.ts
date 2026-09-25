import { z } from 'zod';
import { DOCUMENT_TYPES, DOCUMENT_STATUSES, type DocumentType, type DocumentStatus } from '../models/document.model.js';
import { objectIdSchema } from './common.validators.js';

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
});

export type DocumentQuery = z.infer<typeof documentQuerySchema>;

/**
 * Schema validating route params containing a document ID (:id).
 */
export const documentIdParamSchema = z.object({
  id: objectIdSchema,
});

export type DocumentIdParam = z.infer<typeof documentIdParamSchema>;
