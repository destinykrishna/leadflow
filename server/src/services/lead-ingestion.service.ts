import { Types } from 'mongoose';
import { Lead, type ILeadDocument } from '../models/lead.model.js';
import { leadRepository, type IngestLeadResult } from '../repositories/lead.repository.js';
import { normalizeIncomingLeadPayload, type NormalizedLeadData } from '../validators/lead.validators.js';
import { triggerService } from './trigger.service.js';
import { activityService } from './activity.service.js';
import { emitPipelineStageChanged } from './lead-pipeline.service.js';
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

    // Silent Honeypot Defense: Drop bot submissions without database writes, realtime events, or triggers
    if (normalizedData.isHoneypot) {
      logger.info(
        {
          brokerageId: brokerageId.toString(),
          maskedEmail: maskEmail(normalizedData.email),
          source: normalizedData.source,
        },
        'Honeypot field triggered; silently ignoring spam lead submission'
      );

      const dummyId = new Types.ObjectId();
      const syntheticLead = new Lead({
        _id: dummyId,
        brokerageId: typeof brokerageId === 'string' ? new Types.ObjectId(brokerageId) : brokerageId,
        firstName: normalizedData.firstName,
        lastName: normalizedData.lastName,
        email: normalizedData.email,
        phone: normalizedData.phone,
        status: 'NEW',
        source: normalizedData.source,
        score: normalizedData.score,
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as ILeadDocument;

      return {
        lead: syntheticLead,
        isDuplicate: false,
        isAlreadyKnown: false,
        knownAs: null,
      };
    }

    logger.info(
      {
        brokerageId: brokerageId.toString(),
        maskedEmail: maskEmail(normalizedData.email),
        source: normalizedData.source,
      },
      'Processing lead webhook ingestion'
    );

    // 2. Perform idempotent ingestion with already-known client detection and re-inquiry handling
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
          isReInquiry: result.isReInquiry,
        },
        result.isReInquiry ? 'Re-inquiry on existing lead processed successfully' : 'New lead ingested successfully'
      );

      // Emit realtime pipeline stage event so open Kanban boards immediately display the new lead
      emitPipelineStageChanged({
        brokerageId: brokerageId.toString(),
        leadId: result.lead._id.toString(),
        previousStage: result.previousStage ?? null,
        newStage: 'NEW',
        updatedBy: {
          id: 'system:webhook',
          name: result.isReInquiry ? 'Webhook Ingestion (Re-inquiry)' : 'Webhook Ingestion',
          role: 'SYSTEM',
        },
        lead: result.lead,
        timestamp: new Date(),
      });

      // Record immutable activity log (failure isolated, never throws)
      void activityService.logActivity({
        brokerageId:
          typeof brokerageId === 'string'
            ? new Types.ObjectId(brokerageId)
            : brokerageId,
        entityType: 'LEAD',
        entityId: result.lead._id,
        leadId: result.lead._id,
        action: 'LEAD_CREATED',
        actor: {
          id: null,
          name: result.isReInquiry ? 'Webhook Ingestion (Re-inquiry)' : 'Webhook Ingestion',
          role: 'SYSTEM',
          email: null,
        },
        metadata: {
          source: result.lead.source,
          score: result.lead.score,
          isReInquiry: result.isReInquiry ?? false,
          isAlreadyKnown: result.isAlreadyKnown ?? false,
        },
      });

      // Execute configured stage automation triggers (e.g. welcome email, 2h call task) non-blocking
      triggerService
        .handleStageTransition({
          brokerageId,
          lead: result.lead,
          previousStage: result.previousStage ?? null,
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
