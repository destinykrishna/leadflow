import { Types } from 'mongoose';
import { Lead, type ILead, type ILeadDocument } from '../models/lead.model.js';
import { Client, type IClientDocument } from '../models/client.model.js';
import { ScopedRepository } from './scoped.repository.js';
import { withBrokerageScope } from './base.repository.js';
import type { NormalizedLeadData } from '../validators/lead.validators.js';
import { BrokerageIsolationError } from '../utils/errors.js';

export interface IngestLeadResult {
  lead: ILeadDocument;
  isDuplicate: boolean;
  isAlreadyKnown: boolean;
  knownAs: 'LEAD' | 'CLIENT' | null;
  existingClientId?: string;
}

export class LeadRepository extends ScopedRepository<ILead, ILeadDocument> {
  constructor() {
    super(Lead);
  }

  /**
   * Resolves a lead by email strictly within the given brokerage boundary.
   */
  async findByEmail(
    brokerageId: string | Types.ObjectId,
    email: string
  ): Promise<ILeadDocument | null> {
    const scopedFilter = withBrokerageScope<ILead>(brokerageId, {
      email: email.toLowerCase().trim(),
    });
    return this.model.findOne(scopedFilter);
  }

  /**
   * Deterministically ingests a lead into a brokerage.
   * If a lead with the same email already exists within the brokerage,
   * returns the existing lead with isDuplicate: true (idempotent).
   * Notice when a new lead is a person the brokerage already knows (existing Client).
   * Safely absorbs concurrent duplicate key conflicts (code 11000).
   */
  async ingestLead(
    brokerageId: string | Types.ObjectId,
    data: NormalizedLeadData
  ): Promise<IngestLeadResult> {
    if (!brokerageId) {
      throw new BrokerageIsolationError('Brokerage ID is required for lead ingestion');
    }

    const validBrokerageId =
      brokerageId instanceof Types.ObjectId
        ? brokerageId
        : Types.ObjectId.isValid(brokerageId)
          ? new Types.ObjectId(brokerageId)
          : null;

    if (!validBrokerageId) {
      throw new BrokerageIsolationError('Invalid Brokerage ID provided for lead ingestion');
    }

    const normalizedEmail = data.email.toLowerCase().trim();

    // 1. Check for existing lead within this brokerage
    const existingLead = await this.findByEmail(validBrokerageId, normalizedEmail);
    if (existingLead) {
      return {
        lead: existingLead,
        isDuplicate: true,
        isAlreadyKnown: true,
        knownAs: 'LEAD',
      };
    }

    // 2. Check if person is an existing client of this brokerage ("already known")
    const existingClient = await Client.findOne(
      withBrokerageScope(validBrokerageId, { email: normalizedEmail })
    );

    const isAlreadyKnown = Boolean(existingClient);
    const knownAs = existingClient ? 'CLIENT' : null;
    const existingClientId = existingClient ? existingClient._id.toString() : undefined;

    // 3. Attempt creation under pipeline starting state 'NEW'
    try {
      const customFields: Record<string, unknown> = {
        ...(data.customFields ?? {}),
      };

      if (existingClient) {
        customFields.alreadyKnown = true;
        customFields.knownAs = 'CLIENT';
        customFields.existingClientId = existingClientId;
      }

      const createPayload: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: normalizedEmail,
        brokerageId: validBrokerageId,
        status: 'NEW',
        source: data.source,
        score: data.score,
        customFields,
      };

      if (data.phone !== undefined) {
        createPayload.phone = data.phone;
      }
      if (data.notes !== undefined) {
        createPayload.notes = data.notes;
      }

      // If existing client already has an assigned advisor, link lead to same advisor
      if (existingClient?.assignedTo) {
        createPayload.assignedTo = existingClient.assignedTo;
      }

      const createdLead = await this.model.create(
        createPayload as unknown as Partial<ILeadDocument>
      );

      return {
        lead: createdLead,
        isDuplicate: false,
        isAlreadyKnown,
        knownAs,
        ...(existingClientId ? { existingClientId } : {}),
      };
    } catch (error: any) {
      // 4. Gracefully handle concurrent insertion race condition (Mongo duplicate key error code 11000)
      const isDuplicateKeyError =
        Boolean(error) &&
        (error.code === 11000 ||
          error.name === 'MongoServerError' ||
          (typeof error.message === 'string' && error.message.includes('E11000')));

      if (isDuplicateKeyError) {
        let concurrentLead = await this.findByEmail(validBrokerageId, normalizedEmail);
        if (!concurrentLead) {
          // Brief microtick wait if concurrent transaction is finishing write
          await new Promise((resolve) => setTimeout(resolve, 10));
          concurrentLead = await this.findByEmail(validBrokerageId, normalizedEmail);
        }
        if (concurrentLead) {
          return {
            lead: concurrentLead,
            isDuplicate: true,
            isAlreadyKnown: true,
            knownAs: 'LEAD',
          };
        }
      }
      throw error;
    }
  }
}

export const leadRepository = new LeadRepository();
