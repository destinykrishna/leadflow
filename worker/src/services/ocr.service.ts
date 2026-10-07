/**
 * Worker OCR Service Module
 * Exposes the focused OCR service for document verification processing.
 */
export {
  ocrService,
  OcrService,
  validateStorageUrl,
  MAX_OCR_DOWNLOAD_BYTES,
  DEFAULT_OCR_TIMEOUT_MS,
  SUPPORTED_OCR_MIME_TYPES,
  type OcrResult,
  type OcrProcessingOptions,
  type SupportedOcrMimeType,
} from '../../../server/src/services/ocr.service.js';
