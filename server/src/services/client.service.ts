import { Types } from 'mongoose';
import crypto from 'node:crypto';
import { Client, type IClientDocument, type ClientType, type IClientAddress } from '../models/client.model.js';
import { Lead, type ILeadDocument } from '../models/lead.model.js';
import { User, type IUserDocument } from '../models/user.model.js';
import { withBrokerageScope } from '../repositories/base.repository.js';
import { clientRepository } from '../repositories/client.repository.js';
import { authorizationService } from './authorization.service.js';
import { emitPipelineStageChanged } from './lead-pipeline.service.js';
import { triggerService } from './trigger.service.js';
import { hashPassword } from '../utils/password.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  BrokerageIsolationError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import {
  ELIGIBLE_CONVERSION_STAGES,
  isEligibleForConversion,
  type ConvertLeadInput,
} from '../validators/client.validators.js';
import type { IDomainService } from './base.service.js';

export interface ConvertLeadResult {
  client: IClientDocument;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isNew: boolean;
  };
  lead: ILeadDocument;
  temporaryPassword?: string | undefined;
}

export class ClientService implements IDomainService {
  readonly serviceName = 'ClientService';

  /**
   * Converts an eligible lead into a Client.
   * - Enforces role authorization (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR only; CLIENT forbidden).
   * - Validates lead conversion eligibility (must be QUALIFIED, PROPOSAL, NEGOTIATION, or WON; never LOST or raw NEW/CONTACTED).
   * - Prevents duplicate conversion via database unique constraints and atomic conditional updates.
   * - Links or provisions the Client's portal User account with role CLIENT.
   * - Preserves the relationship between Lead and Client (client.leadId & lead.convertedClientId).
   * - Preserves assigned advisor.
   * - Transitions lead stage to WON if not already WON, triggering realtime pipeline events.
   */
  async convertLead(
    caller: AuthUserContext,
    input: ConvertLeadInput & { leadId: string }
  ): Promise<ConvertLeadResult> {
    // 1. Role Authorization
    if (caller.role === 'CLIENT') {
      throw new ForbiddenError('Clients are not authorized to convert leads into client cases');
    }

    if (!['PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'].includes(caller.role)) {
      throw new ForbiddenError('Unauthorized to perform client conversion');
    }

    // 2. Validate Lead Identifier
    if (!Types.ObjectId.isValid(input.leadId)) {
      throw new ValidationError('Invalid lead ID format');
    }

    const leadObjectId = new Types.ObjectId(input.leadId);

    // 3. Lead Lookup with Tenant Boundary Enforcement
    let lead: ILeadDocument | null;
    if (caller.role === 'PLATFORM_ADMIN') {
      lead = await Lead.findById(leadObjectId);
    } else {
      if (!caller.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for tenant user');
      }
      lead = await Lead.findOne(
        withBrokerageScope(caller.brokerageId, { _id: leadObjectId })
      );
    }

    if (!lead) {
      throw new NotFoundError('Lead resource not found');
    }

    // 4. Enforce Valid Conversion State
    if (lead.status === 'LOST') {
      throw new ValidationError('Cannot convert a lead that has been marked as LOST');
    }

    if (!isEligibleForConversion(lead.status)) {
      throw new ValidationError(
        `Lead must be in a qualified stage (${ELIGIBLE_CONVERSION_STAGES.join(', ')}) to be converted. Current stage: ${lead.status}`
      );
    }

    // 5. Duplicate Check: Lead already converted
    if (lead.convertedClientId) {
      throw new ConflictError('This lead has already been converted into a client');
    }

    const existingClientForLead = await clientRepository.findByLeadId(
      lead.brokerageId,
      lead._id
    );
    if (existingClientForLead) {
      throw new ConflictError('This lead has already been converted into a client');
    }

    // 6. Duplicate Check: Client already exists with same email in brokerage
    const existingClientForEmail = await clientRepository.findByEmail(
      lead.brokerageId,
      lead.email
    );
    if (existingClientForEmail) {
      throw new ConflictError(
        'A client with this email already exists within the brokerage'
      );
    }

    // 7. Atomic Concurrency Guard: Claim the lead
    const newClientId = new Types.ObjectId();
    const previousStatus = lead.status;

    const claimedLead = await Lead.findOneAndUpdate(
      {
        _id: lead._id,
        brokerageId: lead.brokerageId,
        status: { $in: ELIGIBLE_CONVERSION_STAGES },
        convertedClientId: null,
      },
      {
        $set: {
          status: 'WON',
          convertedClientId: newClientId,
          'customFields.isConverted': true,
          'customFields.convertedAt': new Date(),
        },
        $inc: { __v: 1 },
      },
      { returnDocument: 'after' }
    );

    if (!claimedLead) {
      throw new ConflictError(
        'Lead has already been converted or is being processed concurrently'
      );
    }

    // 8. Portal User Linkage / Provisioning
    let clientUserId: Types.ObjectId;
    let userName: string;
    let isNewUser = false;
    let rawPassword: string | undefined;
    let createdUserDoc: IUserDocument | null = null;

    try {
      const existingUser = await User.findOne({
        brokerageId: lead.brokerageId,
        email: lead.email.toLowerCase().trim(),
      });

      if (existingUser) {
        if (existingUser.role !== 'CLIENT') {
          throw new ConflictError(
            `A user account with this email already exists with non-client role: ${existingUser.role}`
          );
        }

        // Verify existing user is not already linked to another client
        const existingClientForUser = await clientRepository.findByUserId(
          lead.brokerageId,
          existingUser._id
        );
        if (existingClientForUser) {
          throw new ConflictError(
            'A client is already linked to this user account in this brokerage'
          );
        }

        clientUserId = existingUser._id;
        userName = existingUser.name;
        isNewUser = false;
      } else {
        // Provision new CLIENT portal user
        rawPassword = input.password || crypto.randomBytes(16).toString('base64url');
        const passwordHash = await hashPassword(rawPassword);

        const userPayload: Record<string, unknown> = {
          brokerageId: lead.brokerageId,
          name: `${lead.firstName} ${lead.lastName}`.trim(),
          email: lead.email.toLowerCase().trim(),
          passwordHash,
          role: 'CLIENT',
          status: 'ACTIVE',
        };
        if (lead.phone) {
          userPayload.phone = lead.phone;
        }

        const newUser = await User.create(userPayload);
        createdUserDoc = newUser as unknown as IUserDocument;

        clientUserId = createdUserDoc._id;
        userName = createdUserDoc.name;
        isNewUser = true;
      }

      // 9. Preserve or Assign Advisor
      let assignedAdvisorId: Types.ObjectId | null = null;
      if (input.assignedTo) {
        if (!Types.ObjectId.isValid(input.assignedTo)) {
          throw new ValidationError('Invalid assigned advisor ID format');
        }
        const assignedUser = await User.findOne({
          _id: new Types.ObjectId(input.assignedTo),
          brokerageId: lead.brokerageId,
          role: { $in: ['ADVISOR', 'BROKERAGE_ADMIN'] },
          status: 'ACTIVE',
        });
        if (!assignedUser) {
          throw new ValidationError('Assigned advisor not found in this brokerage or inactive');
        }
        assignedAdvisorId = assignedUser._id;
      } else if (lead.assignedTo) {
        // Preserve assigned advisor from original Lead
        assignedAdvisorId = lead.assignedTo;
      } else if (caller.role === 'ADVISOR') {
        // If caller is an advisor converting an unassigned lead, assign to self
        assignedAdvisorId = new Types.ObjectId(caller.id);
      }

      // 10. Persist Client Document
      const clientPayload: Record<string, unknown> = {
        _id: newClientId,
        brokerageId: lead.brokerageId,
        userId: clientUserId,
        leadId: lead._id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email.toLowerCase().trim(),
        status: 'ACTIVE',
        type: input.type || 'BUYER',
      };
      if (lead.phone) {
        clientPayload.phone = lead.phone;
      }
      if (assignedAdvisorId) {
        clientPayload.assignedTo = assignedAdvisorId;
      }
      if (input.address) {
        clientPayload.address = input.address;
      }

      const clientDoc = await Client.create(clientPayload);
      const newClient = clientDoc as unknown as IClientDocument;

      // 11. Realtime Pipeline Notification & Stage Triggers (if stage changed to WON)
      if (previousStatus !== 'WON') {
        emitPipelineStageChanged({
          brokerageId: lead.brokerageId.toString(),
          leadId: lead._id.toString(),
          previousStage: previousStatus,
          newStage: 'WON',
          updatedBy: {
            id: caller.id,
            name: caller.name,
            role: caller.role,
          },
          lead: claimedLead,
          timestamp: new Date(),
        });

        triggerService
          .handleStageTransition({
            brokerageId: lead.brokerageId.toString(),
            lead: claimedLead,
            previousStage: previousStatus,
            newStage: 'WON',
            updatedBy: {
              id: caller.id,
              name: caller.name,
              role: caller.role,
            },
          })
          .catch((err) => {
            logger.error(
              { err: (err as Error).message, leadId: lead._id.toString() },
              'Error running stage triggers for converted lead'
            );
          });
      }

      logger.info(
        {
          brokerageId: lead.brokerageId,
          leadId: lead._id,
          clientId: newClient._id,
          userId: clientUserId,
          isNewUser,
        },
        'Successfully converted lead to client'
      );

      return {
        client: newClient,
        user: {
          id: clientUserId.toString(),
          email: lead.email,
          name: userName,
          role: 'CLIENT',
          isNew: isNewUser,
        },
        lead: claimedLead,
        temporaryPassword: isNewUser && !input.password ? rawPassword : undefined,
      };
    } catch (error: any) {
      // Rollback atomic lead claim on failure
      await Lead.updateOne(
        { _id: lead._id },
        {
          $set: {
            status: previousStatus,
            convertedClientId: null,
            'customFields.isConverted': false,
          },
        }
      );

      // Clean up newly created portal user to avoid orphaned accounts
      if (createdUserDoc) {
        await User.deleteOne({ _id: createdUserDoc._id }).catch((cleanupErr) => {
          logger.error({ cleanupErr }, 'Failed to clean up newly created user during rollback');
        });
      }

      // Safe error translation for MongoDB duplicate key collision
      if (error.code === 11000) {
        throw new ConflictError(
          'A client for this lead or email already exists within the brokerage'
        );
      }

      throw error;
    }
  }

  /**
   * Retrieves the authenticated client user's own case/profile information.
   * Completely immune to IDOR: derives identity strictly from verified server context (caller.id).
   */
  async getMyClientCase(caller: AuthUserContext): Promise<IClientDocument> {
    if (caller.role !== 'CLIENT') {
      throw new ForbiddenError('Only CLIENT users have a personal client case');
    }

    if (!caller.brokerageId) {
      throw new BrokerageIsolationError('Brokerage context missing for client user');
    }

    const client = await Client.findOne(
      withBrokerageScope(caller.brokerageId, {
        userId: new Types.ObjectId(caller.id),
      })
    )
      .populate('assignedTo', 'name email phone role')
      .populate('brokerageId', 'name slug')
      .populate('leadId', 'status source score createdAt customFields');

    if (!client) {
      throw new NotFoundError('Client case not found');
    }

    return client;
  }

  /**
   * Retrieves a client by ID with strict tenant boundary and ownership enforcement.
   * - ADVISOR / BROKERAGE_ADMIN: restricted to clients in their brokerage.
   * - CLIENT: strictly restricted to their own record (userId === caller.id).
   * - Cross-tenant or non-owned queries return 404 (NotFoundError), concealing existence.
   */
  async getClientById(caller: AuthUserContext, clientId: string): Promise<IClientDocument> {
    if (!Types.ObjectId.isValid(clientId)) {
      throw new NotFoundError('Client resource not found');
    }

    const client = await clientRepository.findById(caller, clientId);
    if (!client) {
      throw new NotFoundError('Client resource not found');
    }

    authorizationService.authorizeClientAccess(caller, client);

    return client;
  }

  /**
   * Lists clients scoped to the authenticated user's brokerage.
   * Restricted to staff roles (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR).
   */
  async listClients(caller: AuthUserContext): Promise<IClientDocument[]> {
    if (caller.role === 'CLIENT') {
      throw new ForbiddenError('Clients are not authorized to list brokerage clients');
    }

    return clientRepository.find(caller);
  }
}

export const clientService = new ClientService();
