import { Types } from 'mongoose';
import { Client, type IClient, type IClientDocument } from '../models/client.model.js';
import { ScopedRepository } from './scoped.repository.js';
import { withBrokerageScope } from './base.repository.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { BrokerageIsolationError } from '../utils/errors.js';

export class ClientRepository extends ScopedRepository<IClient, IClientDocument> {
  constructor() {
    super(Client);
  }

  /**
   * Resolves a client by email strictly within the given brokerage boundary.
   */
  async findByEmail(
    brokerageId: string | Types.ObjectId,
    email: string
  ): Promise<IClientDocument | null> {
    const scopedFilter = withBrokerageScope<IClient>(brokerageId, {
      email: email.toLowerCase().trim(),
    });
    return this.model.findOne(scopedFilter);
  }

  /**
   * Resolves a client by associated User ID strictly within the given brokerage boundary.
   */
  async findByUserId(
    brokerageId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IClientDocument | null> {
    const scopedFilter = withBrokerageScope<IClient>(brokerageId, {
      userId: userId instanceof Types.ObjectId ? userId : new Types.ObjectId(userId),
    });
    return this.model.findOne(scopedFilter);
  }

  /**
   * Resolves a client by originating Lead ID strictly within the given brokerage boundary.
   */
  async findByLeadId(
    brokerageId: string | Types.ObjectId,
    leadId: string | Types.ObjectId
  ): Promise<IClientDocument | null> {
    const scopedFilter = withBrokerageScope<IClient>(brokerageId, {
      leadId: leadId instanceof Types.ObjectId ? leadId : new Types.ObjectId(leadId),
    });
    return this.model.findOne(scopedFilter);
  }

  /**
   * Resolves a client by ID with populated relational fields (advisor, brokerage, lead origin)
   * while enforcing tenant isolation.
   */
  async findByIdWithDetails(
    userContext: AuthUserContext,
    id: string | Types.ObjectId
  ): Promise<IClientDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    const objectId = id instanceof Types.ObjectId ? id : new Types.ObjectId(id);

    if (userContext.role === 'PLATFORM_ADMIN') {
      return this.model
        .findById(objectId)
        .populate('assignedTo', 'name email phone role')
        .populate('brokerageId', 'name slug')
        .populate('leadId', 'status source score createdAt customFields');
    }

    if (!userContext.brokerageId) {
      throw new BrokerageIsolationError('Brokerage context missing for tenant user');
    }

    const filter = withBrokerageScope<IClient>(userContext.brokerageId, {
      _id: objectId,
    });

    return this.model
      .findOne(filter)
      .populate('assignedTo', 'name email phone role')
      .populate('brokerageId', 'name slug')
      .populate('leadId', 'status source score createdAt customFields');
  }
}

export const clientRepository = new ClientRepository();
