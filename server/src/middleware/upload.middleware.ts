import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  isAllowedMimeType,
} from '../validators/document.validators.js';
import { ValidationError } from '../utils/errors.js';

// In-memory storage buffer for server-side processing and direct stream to ImageKit
const storage = multer.memoryStorage();

const multerInstance = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          `Unsupported file format: ${file.mimetype}. Allowed formats: PDF, JPEG, PNG, WEBP, TIFF`
        )
      );
    }
  },
});

/**
 * Express middleware for single document file upload under field 'file'.
 * Safely transforms Multer-specific errors into standard LeadFlow ApplicationErrors.
 */
export function handleFileUpload(req: Request, res: Response, next: NextFunction): void {
  const upload = multerInstance.single('file');

  upload(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new ValidationError(
              `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
            )
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(
            new ValidationError('Unexpected upload field: document must be uploaded under field "file"')
          );
        }
        return next(new ValidationError(`Upload error: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
}
