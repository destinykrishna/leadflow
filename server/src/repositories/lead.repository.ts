import { Types, type QueryFilter } from 'mongoose';
import { Lead, type ILead, type ILeadDocument, type LeadStatus } from '../models/lead.model.js';
import { Client, type IClientDocument } from '../models/client.model.js';
import { ScopedRepository } from './scoped.repository.js';
import { withBrokerageScope } from './base.repository.js';
import {
  type NormalizedLeadData,
  VALID_STAGE_TRANSITIONS,
  isValidStageTransition,
} from '../validators/lead.validators.js';
import { BrokerageIsolationError } from '../utils/errors.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';

export interface IngestLeadResult {
  lead: ILeadDocument;
  isDuplicate: boolean;
  isAlreadyKnown: boolean;
  knownAs: 'LEAD' | 'CLIENT' | null;
  existingClientId?: string;
  isReInquiry?: boolean;
  previousStage?: LeadStatus | null;
}

export interface PipelineFilterOptions {
  stage?: LeadStatus | undefined;
  status?: LeadStatus | undefined;
  assignedTo?: string | undefined;
  search?: string | undefined;
  brokerageId?: string | undefined;
  limit?: number | undefined;
  page?: number | undefined;
  stageLimit?: number | undefined;
  includeArchived?: boolean | undefined;
  isArchived?: boolean | undefined;
  sort?: 'createdAt' | 'updatedAt' | 'score' | 'name' | undefined;
  order?: 'asc' | 'desc' | undefined;
}

export interface AtomicStageUpdateResult {
  success: boolean;
  lead?: ILeadDocument;
  previousStage?: LeadStatus;
  currentStage?: LeadStatus;
  error?: 'NOT_FOUND' | 'INVALID_TRANSITION' | 'CONFLICT';
  message?: string;
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
      // Safe re-inquiry handling: If existing lead is in LOST stage or archived (and not converted to a Client case),
      // treat a legitimate new submission as a fresh NEW inquiry on the existing lead.
      const isReInquiryEligible =
        (existingLead.status === 'LOST' || existingLead.isArchived === true) &&
        !existingLead.convertedClientId;

      if (isReInquiryEligible) {
        const previousStage = existingLead.status;
        const preservedNotes = data.notes
          ? existingLead.notes
            ? `${data.notes}\n\n[Re-inquiry History - Prior Stage: ${previousStage}]: ${existingLead.notes}`
            : data.notes
          : existingLead.notes
            ? `[Re-inquiry received while in ${previousStage}]:\n${existingLead.notes}`
            : undefined;

        const existingCustom =
          existingLead.customFields instanceof Map
            ? Object.fromEntries(existingLead.customFields)
            : (existingLead.customFields ?? {});

        const updatedCustomFields: Record<string, unknown> = {
          ...existingCustom,
          ...(data.customFields ?? {}),
          reInquiryCount: ((existingCustom.reInquiryCount as number) || 0) + 1,
          lastReInquiryAt: new Date().toISOString(),
          previousStageBeforeReInquiry: previousStage,
        };

        const updateSet: Record<string, unknown> = {
          firstName: data.firstName,
          lastName: data.lastName,
          source: data.source,
          score: data.score,
          status: 'NEW',
          isArchived: false,
          archivedAt: null,
          customFields: updatedCustomFields,
        };

        if (data.phone !== undefined) {
          updateSet.phone = data.phone;
        }
        if (preservedNotes !== undefined) {
          updateSet.notes = preservedNotes;
        }

        const revivedLead = await this.model.findOneAndUpdate(
          {
            _id: existingLead._id,
            brokerageId: validBrokerageId,
            __v: existingLead.__v,
          },
          {
            $set: updateSet,
            $inc: { __v: 1 },
          },
          { returnDocument: 'after' }
        );

        const finalLead =
          revivedLead || (await this.findByEmail(validBrokerageId, normalizedEmail)) || existingLead;

        return {
          lead: finalLead,
          isDuplicate: false,
          isAlreadyKnown: true,
          knownAs: 'LEAD',
          isReInquiry: true,
          previousStage,
        };
      }

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
          if (
            (concurrentLead.status === 'LOST' || concurrentLead.isArchived === true) &&
            !concurrentLead.convertedClientId
          ) {
            const previousStage = concurrentLead.status;
            const updated = await this.model.findOneAndUpdate(
              {
                _id: concurrentLead._id,
                brokerageId: validBrokerageId,
              },
              {
                $set: {
                  firstName: data.firstName,
                  lastName: data.lastName,
                  phone: data.phone !== undefined ? data.phone : concurrentLead.phone,
                  source: data.source,
                  score: data.score,
                  status: 'NEW',
                  isArchived: false,
                  archivedAt: null,
                },
                $inc: { __v: 1 },
              },
              { returnDocument: 'after' }
            );
            return {
              lead: updated || concurrentLead,
              isDuplicate: false,
              isAlreadyKnown: true,
              knownAs: 'LEAD',
              isReInquiry: true,
              previousStage,
            };
          }

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

  /**
   * Builds standardized query filter enforcing tenant boundaries, active lifecycle,
   * search terms, and advisor assignments.
   */
  buildLeadFilter(
    userContext: AuthUserContext,
    options: PipelineFilterOptions = {}
  ): Record<string, unknown> {
    const queryFilter: Record<string, unknown> = {};

    if (userContext.role === 'PLATFORM_ADMIN') {
      if (options.brokerageId && Types.ObjectId.isValid(options.brokerageId)) {
        queryFilter.brokerageId = new Types.ObjectId(options.brokerageId);
      }
    } else {
      if (!userContext.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for tenant user');
      }
      queryFilter.brokerageId = new Types.ObjectId(userContext.brokerageId);
    }

    // Exclude archived leads by default ($ne: true cleanly supports unmigrated documents)
    if (options.includeArchived) {
      if (options.isArchived !== undefined) {
        queryFilter.isArchived = options.isArchived;
      }
    } else {
      queryFilter.isArchived = { $ne: true };
    }

    const targetStage = options.stage ?? options.status;
    if (targetStage) {
      queryFilter.status = targetStage;
    }

    if (options.assignedTo && Types.ObjectId.isValid(options.assignedTo)) {
      queryFilter.assignedTo = new Types.ObjectId(options.assignedTo);
    }

    if (options.search) {
      const searchRegex = new RegExp(
        options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      queryFilter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    return queryFilter;
  }

  /**
   * Retrieves pipeline leads strictly scoped to the authenticated user's brokerage.
   * PLATFORM_ADMIN may query platform-wide or filter by an explicit brokerageId.
   */
  async findPipelineLeads(
    userContext: AuthUserContext,
    options: PipelineFilterOptions = {}
  ): Promise<ILeadDocument[]> {
    const queryFilter = this.buildLeadFilter(userContext, options);

    const sortField = options.sort === 'name' ? 'lastName' : (options.sort ?? 'createdAt');
    const sortDirection = options.order === 'asc' ? 1 : -1;
    const sortQuery: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const limit = Math.min(options.limit ?? 100, 500);
    const page = Math.max(options.page ?? 1, 1);
    const skip = (page - 1) * limit;

    return this.model
      .find(queryFilter)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .populate('assignedTo', '_id name email');
  }

  /**
   * Retrieves paginated leads along with the true total count matching filter criteria.
   * Ensures the Leads table does not load entire brokerage datasets into memory.
   */
  async findPipelineLeadsWithCount(
    userContext: AuthUserContext,
    options: PipelineFilterOptions = {}
  ): Promise<{
    leads: ILeadDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const queryFilter = this.buildLeadFilter(userContext, options);

    const sortField = options.sort === 'name' ? 'lastName' : (options.sort ?? 'createdAt');
    const sortDirection = options.order === 'asc' ? 1 : -1;
    const sortQuery: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const limit = Math.min(options.limit ?? 25, 500);
    const page = Math.max(options.page ?? 1, 1);
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      this.model
        .find(queryFilter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .populate('assignedTo', '_id name email'),
      this.model.countDocuments(queryFilter),
    ]);

    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves pipeline grouped across all 7 stages with accurate counts and stage-level limits.
   * Prevents large terminal stages (WON, LOST) from sending hundreds or thousands of documents at once.
   */
  async getPipelineGrouped(
    userContext: AuthUserContext,
    options: PipelineFilterOptions = {}
  ): Promise<{
    pipeline: Record<LeadStatus, ILeadDocument[]>;
    counts: Record<LeadStatus, number>;
    hasMore: Record<LeadStatus, boolean>;
    total: number;
  }> {
    const baseFilter = this.buildLeadFilter(userContext, options);

    const sortField = options.sort === 'name' ? 'lastName' : (options.sort ?? 'createdAt');
    const sortDirection = options.order === 'asc' ? 1 : -1;
    const sortQuery: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const stageLimit = options.stageLimit ?? 25;

    const stages: LeadStatus[] = [
      'NEW',
      'CONTACTED',
      'QUALIFIED',
      'PROPOSAL',
      'NEGOTIATION',
      'WON',
      'LOST',
    ];

    // 1. Fetch accurate counts per stage using MongoDB aggregation
    const countsAgg = await this.model.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts: Record<LeadStatus, number> = {
      NEW: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      PROPOSAL: 0,
      NEGOTIATION: 0,
      WON: 0,
      LOST: 0,
    };

    let total = 0;
    for (const item of countsAgg) {
      if (item._id in counts) {
        counts[item._id as LeadStatus] = item.count;
        total += item.count;
      }
    }

    // 2. Query stage documents up to stageLimit in parallel
    const stageResults = await Promise.all(
      stages.map((stage) =>
        this.model
          .find({ ...baseFilter, status: stage })
          .sort(sortQuery)
          .limit(stageLimit)
          .populate('assignedTo', '_id name email')
      )
    );

    const pipeline: Record<LeadStatus, ILeadDocument[]> = {
      NEW: stageResults[0] ?? [],
      CONTACTED: stageResults[1] ?? [],
      QUALIFIED: stageResults[2] ?? [],
      PROPOSAL: stageResults[3] ?? [],
      NEGOTIATION: stageResults[4] ?? [],
      WON: stageResults[5] ?? [],
      LOST: stageResults[6] ?? [],
    };

    const hasMore: Record<LeadStatus, boolean> = {
      NEW: counts.NEW > pipeline.NEW.length,
      CONTACTED: counts.CONTACTED > pipeline.CONTACTED.length,
      QUALIFIED: counts.QUALIFIED > pipeline.QUALIFIED.length,
      PROPOSAL: counts.PROPOSAL > pipeline.PROPOSAL.length,
      NEGOTIATION: counts.NEGOTIATION > pipeline.NEGOTIATION.length,
      WON: counts.WON > pipeline.WON.length,
      LOST: counts.LOST > pipeline.LOST.length,
    };

    return {
      pipeline,
      counts,
      hasMore,
      total,
    };
  }

  /**
   * Archives a lead (soft-delete), preserving all historical associations and data.
   */
  async archiveLead(
    userContext: AuthUserContext,
    id: string | Types.ObjectId
  ): Promise<ILeadDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    const objectId = id instanceof Types.ObjectId ? id : new Types.ObjectId(id);

    const filter: Record<string, unknown> = { _id: objectId };
    if (userContext.role !== 'PLATFORM_ADMIN') {
      if (!userContext.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for tenant user');
      }
      filter.brokerageId = new Types.ObjectId(userContext.brokerageId);
    }

    return this.model
      .findOneAndUpdate(
        filter,
        {
          $set: {
            isArchived: true,
            archivedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      )
      .populate('assignedTo', '_id name email');
  }

  /**
   * Unarchives / restores an archived lead.
   */
  async unarchiveLead(
    userContext: AuthUserContext,
    id: string | Types.ObjectId
  ): Promise<ILeadDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    const objectId = id instanceof Types.ObjectId ? id : new Types.ObjectId(id);

    const filter: Record<string, unknown> = { _id: objectId };
    if (userContext.role !== 'PLATFORM_ADMIN') {
      if (!userContext.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for tenant user');
      }
      filter.brokerageId = new Types.ObjectId(userContext.brokerageId);
    }

    return this.model
      .findOneAndUpdate(
        filter,
        {
          $set: {
            isArchived: false,
            archivedAt: null,
          },
        },
        { returnDocument: 'after' }
      )
      .populate('assignedTo', '_id name email');
  }

  /**
   * Resolves a single lead by ID with tenant boundary isolation and populated advisor details.
   */
  async findLeadById(
    userContext: AuthUserContext,
    id: string | Types.ObjectId
  ): Promise<ILeadDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    const objectId = id instanceof Types.ObjectId ? id : new Types.ObjectId(id);

    if (userContext.role === 'PLATFORM_ADMIN') {
      return this.model.findById(objectId).populate('assignedTo', '_id name email');
    }

    if (!userContext.brokerageId) {
      throw new BrokerageIsolationError('Brokerage context missing for tenant user');
    }

    const scopedFilter = withBrokerageScope<ILead>(userContext.brokerageId, {
      _id: objectId,
    } as unknown as QueryFilter<ILead>);

    return this.model.findOne(scopedFilter).populate('assignedTo', '_id name email');
  }

  /**
   * Atomically updates a lead's stage enforcing:
   * 1. Tenant boundary isolation (cross-tenant IDs return NOT_FOUND).
   * 2. Server-side stage transition validation (valid transitions only, WON/LOST are terminal).
   * 3. Database-level optimistic concurrency control (matching __v and status; prevents lost updates).
   */
  async atomicUpdateStage(
    userContext: AuthUserContext,
    leadId: string,
    targetStage: LeadStatus,
    expectedVersion?: number
  ): Promise<AtomicStageUpdateResult> {
    if (!Types.ObjectId.isValid(leadId)) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: 'Lead resource not found',
      };
    }

    const objectId = new Types.ObjectId(leadId);

    // 1. Fetch lead scoped to tenant
    let lead: ILeadDocument | null = null;
    if (userContext.role === 'PLATFORM_ADMIN') {
      lead = await this.model.findById(objectId);
    } else {
      if (!userContext.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for tenant user');
      }
      const filter = withBrokerageScope<ILead>(userContext.brokerageId, {
        _id: objectId,
      } as unknown as QueryFilter<ILead>);
      lead = await this.model.findOne(filter);
    }

    if (!lead) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: 'Lead resource not found',
      };
    }

    // 2. Reject transition if lead is already in target stage
    if (lead.status === targetStage) {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: `Lead is already in stage '${targetStage}'`,
      };
    }

    // 3. Validate state machine transition
    if (!isValidStageTransition(lead.status, targetStage)) {
      const allowed = VALID_STAGE_TRANSITIONS[lead.status];
      const allowedDesc = allowed.length > 0 ? allowed.join(', ') : 'none (terminal stage)';
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: `Invalid stage transition from '${lead.status}' to '${targetStage}'. Valid next stages: ${allowedDesc}`,
      };
    }

    // 4. Optimistic concurrency version check (if caller explicitly passed expected version)
    if (expectedVersion !== undefined && lead.__v !== expectedVersion) {
      return {
        success: false,
        error: 'CONFLICT',
        message: `Stage update conflict: Expected version ${expectedVersion} but current version is ${lead.__v}. Lead has been modified concurrently.`,
      };
    }

    // 5. Atomic conditional update matching the exact status and version read
    const matchFilter: Record<string, unknown> = {
      _id: objectId,
      status: lead.status,
      __v: lead.__v,
    };

    if (userContext.role !== 'PLATFORM_ADMIN') {
      matchFilter.brokerageId = new Types.ObjectId(userContext.brokerageId!);
    }

    const updatedLead = await this.model
      .findOneAndUpdate(
        matchFilter,
        {
          $set: { status: targetStage },
          $inc: { __v: 1 },
        },
        { returnDocument: 'after' }
      )
      .populate('assignedTo', '_id name email');

    // 6. If no document was modified, another concurrent update intervened
    if (!updatedLead) {
      return {
        success: false,
        error: 'CONFLICT',
        message:
          'Stage update conflict: Lead has been modified concurrently by another user. Please refresh the pipeline board.',
      };
    }

    return {
      success: true,
      lead: updatedLead,
      previousStage: lead.status,
      currentStage: targetStage,
    };
  }

  /**
   * Reopens a lead currently in LOST status back to NEW stage.
   * Enforces tenant isolation, LOST status check, and optimistic concurrency version control.
   */
  async reopenLead(
    userContext: AuthUserContext,
    leadId: string,
    expectedVersion?: number,
    reason?: string
  ): Promise<AtomicStageUpdateResult> {
    if (!Types.ObjectId.isValid(leadId)) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: 'Lead resource not found',
      };
    }

    const objectId = new Types.ObjectId(leadId);

    // 1. Fetch lead scoped to tenant
    let lead: ILeadDocument | null = null;
    if (userContext.role === 'PLATFORM_ADMIN') {
      lead = await this.model.findById(objectId);
    } else {
      if (!userContext.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for tenant user');
      }
      const filter = withBrokerageScope<ILead>(userContext.brokerageId, {
        _id: objectId,
      } as unknown as QueryFilter<ILead>);
      lead = await this.model.findOne(filter);
    }

    if (!lead) {
      return {
        success: false,
        error: 'NOT_FOUND',
        message: 'Lead resource not found',
      };
    }

    // 2. Only leads in LOST status can be reopened
    if (lead.status !== 'LOST') {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: `Only leads in 'LOST' status can be reopened (current status is '${lead.status}')`,
      };
    }

    // 3. Optimistic concurrency version check
    if (expectedVersion !== undefined && lead.__v !== expectedVersion) {
      return {
        success: false,
        error: 'CONFLICT',
        message: `Stage update conflict: Expected version ${expectedVersion} but current version is ${lead.__v}. Lead has been modified concurrently.`,
      };
    }

    // 4. Atomic conditional update matching _id, status: 'LOST', and __v
    const matchFilter: Record<string, unknown> = {
      _id: objectId,
      status: 'LOST',
      __v: lead.__v,
    };

    if (userContext.role !== 'PLATFORM_ADMIN') {
      matchFilter.brokerageId = new Types.ObjectId(userContext.brokerageId!);
    }

    let preservedNotes = lead.notes || '';
    if (reason && reason.trim()) {
      const stamp = `[Reopened by ${userContext.name || userContext.email}]: ${reason.trim()}`;
      preservedNotes = preservedNotes ? `${preservedNotes}\n\n${stamp}` : stamp;
    }

    const updatedLead = await this.model
      .findOneAndUpdate(
        matchFilter,
        {
          $set: {
            status: 'NEW',
            isArchived: false,
            archivedAt: null,
            notes: preservedNotes,
          },
          $inc: { __v: 1 },
        },
        { returnDocument: 'after' }
      )
      .populate('assignedTo', '_id name email');

    if (!updatedLead) {
      return {
        success: false,
        error: 'CONFLICT',
        message:
          'Stage update conflict: Lead has been modified concurrently by another user. Please refresh the pipeline board.',
      };
    }

    return {
      success: true,
      lead: updatedLead,
      previousStage: 'LOST',
      currentStage: 'NEW',
    };
  }
}

export const leadRepository = new LeadRepository();
