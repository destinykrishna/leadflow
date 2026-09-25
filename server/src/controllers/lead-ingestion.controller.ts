import type { Request, Response, NextFunction } from 'express';
import { leadIngestionService } from '../services/lead-ingestion.service.js';
import { UnauthorizedError } from '../utils/errors.js';

export class LeadIngestionController {
  /**
   * Handles external lead webhook ingestion.
   * Authenticated via verifyWebhookAuth middleware.
   */
  async ingestWebhookLead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const brokerage = req.webhookBrokerage;
      if (!brokerage) {
        throw new UnauthorizedError('Brokerage context missing');
      }

      const result = await leadIngestionService.processIngestion(
        brokerage._id,
        req.body
      );

      const responseData = {
        id: result.lead._id.toString(),
        firstName: result.lead.firstName,
        lastName: result.lead.lastName,
        email: result.lead.email,
        phone: result.lead.phone,
        status: result.lead.status,
        source: result.lead.source,
        score: result.lead.score,
        createdAt: result.lead.createdAt,
      };

      if (result.isDuplicate) {
        res.status(200).json({
          success: true,
          isDuplicate: true,
          isAlreadyKnown: true,
          knownAs: 'LEAD',
          message: 'Lead already exists for this brokerage. Ingestion processed idempotently.',
          data: responseData,
        });
        return;
      }

      if (result.isAlreadyKnown && result.knownAs === 'CLIENT') {
        res.status(201).json({
          success: true,
          isDuplicate: false,
          isAlreadyKnown: true,
          knownAs: 'CLIENT',
          ...(result.existingClientId ? { existingClientId: result.existingClientId } : {}),
          message: 'Lead ingested successfully. Existing brokerage client recognized.',
          data: responseData,
        });
        return;
      }

      res.status(201).json({
        success: true,
        isDuplicate: false,
        isAlreadyKnown: false,
        knownAs: null,
        message: 'Lead ingested successfully.',
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const leadIngestionController = new LeadIngestionController();
