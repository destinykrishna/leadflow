import type { Request, Response, NextFunction } from 'express';
import { documentService } from '../services/document.service.js';
import {
  uploadDocumentMetadataSchema,
  documentQuerySchema,
  reviewDocumentSchema,
} from '../validators/document.validators.js';
import { ValidationError } from '../utils/errors.js';

/**
 * Defense-in-depth sanitizer ensuring raw permanent storage URLs (fileUrl)
 * and unmanaged download URLs are stripped from client-facing API responses.
 * The only application-accessible file access route is GET /api/documents/:id/download.
 */
function sanitizeDocumentResponse<T extends Record<string, any>>(doc: T): Record<string, unknown> {
  const obj = doc && typeof (doc as any).toJSON === 'function' ? (doc as any).toJSON() : { ...doc };
  delete obj.fileUrl;
  delete obj.downloadUrl;
  return obj;
}

export class DocumentController {
  /**
   * Handles authenticated multipart document upload:
   * - Validates file payload via Multer
   * - Validates document type, title, and ownership metadata
   * - Stores file securely in ImageKit and metadata in MongoDB
   */
  async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new ValidationError('File is required for document upload');
      }

      const validationResult = uploadDocumentMetadataSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new ValidationError(
          validationResult.error.issues?.[0]?.message || 'Invalid upload metadata'
        );
      }

      const document = await documentService.uploadDocument(req.user!, {
        file: req.file,
        ...validationResult.data,
      });

      res.status(201).json({
        success: true,
        data: { document: sanitizeDocumentResponse(document) },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lists documents with strict tenant isolation and client case scoping.
   */
  async listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validationResult = documentQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        throw new ValidationError(
          validationResult.error.issues?.[0]?.message || 'Invalid document query parameters'
        );
      }

      const documents = await documentService.listDocuments(
        req.user!,
        validationResult.data
      );

      res.status(200).json({
        success: true,
        data: { documents: documents.map(sanitizeDocumentResponse) },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetches a document by ID with strict tenant boundary and client ownership enforcement.
   * - Platform Admin, Brokerage Admin, Advisor: can view documents in their brokerage.
   * - Client: can view ONLY documents belonging to their own case / uploaded by their account.
   * - Cross-tenant or non-owned returns 404 (IDOR protection without existence disclosure).
   */
  async getDocumentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const document = await documentService.getDocumentById(req.user!, id);

      res.status(200).json({
        success: true,
        data: { document: sanitizeDocumentResponse(document) },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generates a time-limited signed ImageKit URL for secure document download/access.
   * - Enforces authentication, active standing, tenant isolation, and client case ownership.
   * - Cross-tenant or unauthorized client returns 404 (IDOR-immune).
   * - Supports JSON response or 307 temporary redirect via ?redirect=true query.
   */
  async getDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const result = await documentService.getDocumentDownloadUrl(req.user!, id);

      if (req.query.redirect === 'true') {
        res.redirect(307, result.downloadUrl);
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Performs human verification review (Approval or Rejection) on a document.
   * Gated to authorized staff within the same brokerage.
   */
  async reviewDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const validationResult = reviewDocumentSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new ValidationError(
          validationResult.error.issues?.[0]?.message || 'Invalid review payload'
        );
      }

      const document = await documentService.reviewDocument(
        req.user!,
        id,
        validationResult.data
      );

      res.status(200).json({
        success: true,
        data: { document: sanitizeDocumentResponse(document) },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const documentController = new DocumentController();
