import type { Request, Response, NextFunction } from 'express';
import { documentService } from '../services/document.service.js';
import {
  uploadDocumentMetadataSchema,
  documentQuerySchema,
} from '../validators/document.validators.js';
import { ValidationError } from '../utils/errors.js';

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
        data: { document },
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
        data: { documents },
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
        data: { document },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const documentController = new DocumentController();
