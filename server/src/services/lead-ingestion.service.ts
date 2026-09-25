import { Types } from 'mongoose';
import { leadRepository, type IngestLeadResult } from '../repositories/lead.repository.js';
import { normalizeIncomingLeadPayload, type NormalizedLeadData } from '../validators/lead.validators.js';
import { triggerService } from './trigger.service.js';
import { logger } from '../utils/logger.js';

import { maskEmail } from '../utils/mask.js';

export class LeadIngestionService {
  /**
   * Normalizes incoming lead payload, enforces tenant boundaries, and executes
   * idempotent, deduplicated ingestion into the database.
   * Architecture structured for future background queueing (e.g. BullMQ in Phase 7).
   */
  async processIngestion(
    brokerageId: Types.ObjectId | string,
    rawPayload: unknown
  ): Promise<IngestLeadResult> {
    // 1. Validate & normalize payload (strips any untrusted client brokerageId)
    const normalizedData: NormalizedLeadData = normalizeIncomingLeadPayload(rawPayload);

    logger.info(
      {
        brokerageId: brokerageId.toString(),
        maskedEmail: maskEmail(normalizedData.email),
        source: normalizedData.source,
      },
      'Processing lead webhook ingestion'
    );

    // 2. Perform idempotent ingestion with already-known client detection
    const result = await leadRepository.ingestLead(brokerageId, normalizedData);

    if (result.isDuplicate) {
      logger.info(
        {
          leadId: result.lead._id.toString(),
          brokerageId: brokerageId.toString(),
          maskedEmail: maskEmail(normalizedData.email),
          isAlreadyKnown: result.isAlreadyKnown,
          knownAs: result.knownAs,
        },
        'Duplicate lead detected; idempotent ingestion returned existing record'
      );
    } else {
      logger.info(
        {
          leadId: result.lead._id.toString(),
          brokerageId: brokerageId.toString(),
          maskedEmail: maskEmail(normalizedData.email),
          isAlreadyKnown: result.isAlreadyKnown,
          knownAs: result.knownAs,
        },
        'New lead ingested successfully'
      );

      // Execute configured stage automation triggers (e.g. welcome email, 2h call task) non-blocking
      triggerService
        .handleStageTransition({
          brokerageId,
          lead: result.lead,
          previousStage: null,
          newStage: 'NEW',
        })
        .catch((err) => {
          logger.error(
            { err: (err as Error).message, leadId: result.lead._id.toString() },
            'Error running stage triggers for ingested lead'
          );
        });
    }

    return result;
  }
}

export const leadIngestionService = new LeadIngestionService();
