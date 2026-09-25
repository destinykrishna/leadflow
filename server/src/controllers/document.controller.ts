import type { Request, Response, NextFunction } from 'express';
import { documentRepository } from '../repositories/document.repository.js';
import { authorizationService } from '../services/authorization.service.js';
import { NotFoundError } from '../utils/errors.js';

export class DocumentController {
  /**
   * Fetches a document by ID with strict tenant boundary and client ownership enforcement.
   * - Platform Admin, Brokerage Admin, Advisor: can view documents in their brokerage.
   * - Client: can view ONLY documents uploaded by their own account.
   * - Cross-tenant or non-owned returns 404 (IDOR protection without existence disclosure).
   */
  async getDocumentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const doc = await documentRepository.findById(req.user!, id);
      if (!doc) {
        throw new NotFoundError('Document resource not found');
      }

      authorizationService.authorizeDocumentAccess(req.user!, doc);

      res.status(200).json({
        success: true,
        data: { document: doc },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const documentController = new DocumentController();
