import { Types, type QueryFilter } from 'mongoose';
import {
  Document as DocumentModel,
  type IDocument,
  type IDocumentDocument,
} from '../models/document.model.js';
import { ScopedRepository } from './scoped.repository.js';
import { withBrokerageScope } from './base.repository.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { BrokerageIsolationError } from '../utils/errors.js';

export class DocumentRepository extends ScopedRepository<IDocument, IDocumentDocument> {
  constructor() {
    super(DocumentModel);
  }

  /**
   * Resolves documents belonging to a client within a brokerage boundary.
   */
  async findByClientId(
    brokerageId: string | Types.ObjectId,
    clientId: string | Types.ObjectId
  ): Promise<IDocumentDocument[]> {
    const scopedFilter = withBrokerageScope<IDocument>(brokerageId, {
      clientId: clientId instanceof Types.ObjectId ? clientId : new Types.ObjectId(clientId),
    });
    return this.model.find(scopedFilter).sort({ createdAt: -1 });
  }

  /**
   * Resolves documents belonging to a lead within a brokerage boundary.
   */
  async findByLeadId(
    brokerageId: string | Types.ObjectId,
    leadId: string | Types.ObjectId
  ): Promise<IDocumentDocument[]> {
    const scopedFilter = withBrokerageScope<IDocument>(brokerageId, {
      leadId: leadId instanceof Types.ObjectId ? leadId : new Types.ObjectId(leadId),
    });
    return this.model.find(scopedFilter).sort({ createdAt: -1 });
  }

  /**
   * Resolves documents with populated relational fields (client, uploader).
   */
  async findByIdWithDetails(
    userContext: AuthUserContext,
    id: string | Types.ObjectId
  ): Promise<IDocumentDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    const objectId = id instanceof Types.ObjectId ? id : new Types.ObjectId(id);

    if (userContext.role === 'PLATFORM_ADMIN') {
      return this.model
        .findById(objectId)
        .populate('uploadedBy', 'name email role')
        .populate('clientId', 'firstName lastName email');
    }

    if (!userContext.brokerageId) {
      throw new BrokerageIsolationError('Brokerage context missing for tenant user');
    }

    const filter = withBrokerageScope<IDocument>(userContext.brokerageId, {
      _id: objectId,
    });

    return this.model
      .findOne(filter)
      .populate('uploadedBy', 'name email role')
      .populate('clientId', 'firstName lastName email');
  }
}

export const documentRepository = new DocumentRepository();
