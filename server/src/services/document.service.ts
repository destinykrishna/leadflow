import { Types } from 'mongoose';
import {
  Document as DocumentModel,
  DOCUMENT_TYPES,
  type IDocumentDocument,
  type DocumentType,
} from '../models/document.model.js';
import { Client } from '../models/client.model.js';
import { Lead } from '../models/lead.model.js';
import { documentRepository } from '../repositories/document.repository.js';
import { storageService } from './storage.service.js';
import { authorizationService } from './authorization.service.js';
import { withBrokerageScope } from '../repositories/base.repository.js';
import { enqueueDocumentProcessing } from '../queues/document.queue.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  BrokerageIsolationError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import {
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
  type DocumentQuery,
} from '../validators/document.validators.js';
import type { IDomainService } from './base.service.js';

export interface UploadDocumentInput {
  file: Express.Multer.File;
  type?: DocumentType | undefined;
  title?: string | undefined;
  clientId?: string | undefined;
  leadId?: string | undefined;
  notes?: string | undefined;
}

export class DocumentService implements IDomainService {
  readonly serviceName = 'DocumentService';

  /**
   * Orchestrates secure document upload:
   * 1. Validates file presence, MIME type, size limit, and document type.
   * 2. Resolves tenant boundary and verifies client/case ownership (rejecting unauthorized client-to-client uploads).
   * 3. Uploads file to ImageKit under a server-controlled folder hierarchy.
   * 4. Persists the Document record in MongoDB.
   * 5. Implements defensive compensation: deletes file from ImageKit if DB persistence fails.
   */
  async uploadDocument(
    caller: AuthUserContext,
    input: UploadDocumentInput
  ): Promise<IDocumentDocument> {
    // 1. File presence and constraint validation
    if (!input.file || !input.file.buffer) {
      throw new ValidationError('File is required for document upload');
    }

    if (!isAllowedMimeType(input.file.mimetype)) {
      throw new ValidationError(
        `Unsupported file format: ${input.file.mimetype}. Allowed formats: PDF, JPEG, PNG, WEBP, TIFF`
      );
    }

    if (input.file.size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
      );
    }

    if (input.type && !DOCUMENT_TYPES.includes(input.type)) {
      throw new ValidationError(`Invalid document type: ${input.type}`);
    }

    // 2. Resolve target tenant boundary and case ownership
    let targetBrokerageId: Types.ObjectId;
    let targetClientId: Types.ObjectId | undefined;
    let targetLeadId: Types.ObjectId | undefined;

    if (caller.role === 'CLIENT') {
      if (!caller.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for client user');
      }
      targetBrokerageId = new Types.ObjectId(caller.brokerageId);

      // Resolve authenticated client's personal case profile
      const client = await Client.findOne(
        withBrokerageScope(caller.brokerageId, {
          userId: new Types.ObjectId(caller.id),
        })
      );

      if (!client) {
        throw new NotFoundError('Client case profile not found');
      }

      // Defend against IDOR: if client provided a clientId in form data, it MUST match their own case
      if (input.clientId && input.clientId !== client._id.toString()) {
        throw new ForbiddenError('Clients may only upload documents to their own case');
      }

      targetClientId = client._id;
      targetLeadId = client.leadId;
    } else if (caller.role === 'ADVISOR' || caller.role === 'BROKERAGE_ADMIN') {
      if (!caller.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for staff user');
      }
      targetBrokerageId = new Types.ObjectId(caller.brokerageId);

      if (input.clientId) {
        if (!Types.ObjectId.isValid(input.clientId)) {
          throw new ValidationError('Invalid client ID format');
        }
        const client = await Client.findOne(
          withBrokerageScope(caller.brokerageId, {
            _id: new Types.ObjectId(input.clientId),
          })
        );
        if (!client) {
          throw new NotFoundError('Client resource not found');
        }
        targetClientId = client._id;
        targetLeadId = client.leadId;
      } else if (input.leadId) {
        if (!Types.ObjectId.isValid(input.leadId)) {
          throw new ValidationError('Invalid lead ID format');
        }
        const lead = await Lead.findOne(
          withBrokerageScope(caller.brokerageId, {
            _id: new Types.ObjectId(input.leadId),
          })
        );
        if (!lead) {
          throw new NotFoundError('Lead resource not found');
        }
        targetLeadId = lead._id;
      }
    } else if (caller.role === 'PLATFORM_ADMIN') {
      if (input.clientId) {
        if (!Types.ObjectId.isValid(input.clientId)) {
          throw new ValidationError('Invalid client ID format');
        }
        const client = await Client.findById(new Types.ObjectId(input.clientId));
        if (!client) {
          throw new NotFoundError('Client resource not found');
        }
        targetClientId = client._id;
        targetBrokerageId = client.brokerageId;
        targetLeadId = client.leadId;
      } else if (input.leadId) {
        if (!Types.ObjectId.isValid(input.leadId)) {
          throw new ValidationError('Invalid lead ID format');
        }
        const lead = await Lead.findById(new Types.ObjectId(input.leadId));
        if (!lead) {
          throw new NotFoundError('Lead resource not found');
        }
        targetLeadId = lead._id;
        targetBrokerageId = lead.brokerageId;
      } else {
        throw new ValidationError('Target clientId or leadId is required for platform admin upload');
      }
    } else {
      throw new ForbiddenError('Unauthorized user role for document upload');
    }

    // 3. Server-controlled storage folder hierarchy in ImageKit
    const folder = `/leadflow/brokerage_${targetBrokerageId}/clients/${
      targetClientId ? targetClientId.toString() : 'general'
    }`;

    // 4. Upload file to ImageKit
    const uploadResult = await storageService.uploadFile({
      file: input.file.buffer,
      fileName: input.file.originalname,
      mimeType: input.file.mimetype,
      folder,
      tags: [
        'leadflow',
        `brokerage_${targetBrokerageId}`,
        input.type || 'OTHER',
      ],
    });

    // 5. Persist Document record in MongoDB with compensation rollback on error
    try {
      const docPayload: Record<string, unknown> = {
        brokerageId: targetBrokerageId,
        uploadedBy: new Types.ObjectId(caller.id),
        title: input.title?.trim() || input.file.originalname,
        fileUrl: uploadResult.fileUrl,
        fileKey: uploadResult.fileId,
        fileSize: uploadResult.fileSize,
        mimeType: input.file.mimetype,
        type: input.type || 'OTHER',
        status: 'PENDING',
      };

      if (targetClientId) {
        docPayload.clientId = targetClientId;
      }
      if (targetLeadId) {
        docPayload.leadId = targetLeadId;
      }
      if (input.notes) {
        docPayload.verificationNotes = input.notes.trim();
      }

      const createdDoc = await DocumentModel.create(docPayload);
      const document = createdDoc as unknown as IDocumentDocument;

      logger.info(
        {
          brokerageId: targetBrokerageId,
          documentId: document._id,
          fileKey: uploadResult.fileId,
          type: document.type,
          uploadedBy: caller.id,
        },
        'Document successfully uploaded and registered'
      );

      // 6. Enqueue background verification job in BullMQ
      try {
        await enqueueDocumentProcessing({
          documentId: document._id.toString(),
          brokerageId: targetBrokerageId.toString(),
          clientId: targetClientId ? targetClientId.toString() : undefined,
          leadId: targetLeadId ? targetLeadId.toString() : undefined,
        });
      } catch (queueError) {
        // Isolate queue/Redis failure from API client:
        // Document is safely stored as PENDING; client request does not fail
        logger.error(
          {
            err: (queueError as Error)?.message,
            documentId: document._id,
            brokerageId: targetBrokerageId,
          },
          'Failed to enqueue document verification job; document remains PENDING'
        );
      }

      return document;
    } catch (dbError) {
      // Consistency compensation: delete file from ImageKit so no orphan files exist
      logger.error(
        {
          fileId: uploadResult.fileId,
          errorMessage: (dbError as Error)?.message,
        },
        'MongoDB document persistence failed, rolling back ImageKit storage upload'
      );
      await storageService.deleteFile(uploadResult.fileId);
      throw dbError;
    }
  }

  /**
   * Lists documents with strict tenant and client case scoping.
   */
  async listDocuments(
    caller: AuthUserContext,
    query?: DocumentQuery
  ): Promise<IDocumentDocument[]> {
    if (caller.role === 'CLIENT') {
      if (!caller.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for client user');
      }

      // Resolve client record
      const client = await Client.findOne(
        withBrokerageScope(caller.brokerageId, {
          userId: new Types.ObjectId(caller.id),
        })
      );

      if (!client) {
        return [];
      }

      const clientFilter: Record<string, unknown> = {
        brokerageId: new Types.ObjectId(caller.brokerageId),
        clientId: client._id,
      };

      if (query?.type) {
        clientFilter.type = query.type;
      }
      if (query?.status) {
        clientFilter.status = query.status;
      }

      return DocumentModel.find(clientFilter).sort({ createdAt: -1 });
    }

    if (caller.role === 'ADVISOR' || caller.role === 'BROKERAGE_ADMIN') {
      if (!caller.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for staff user');
      }

      const filter: Record<string, unknown> = {
        brokerageId: new Types.ObjectId(caller.brokerageId),
      };

      if (query?.clientId) {
        if (!Types.ObjectId.isValid(query.clientId)) {
          throw new ValidationError('Invalid client ID format');
        }
        filter.clientId = new Types.ObjectId(query.clientId);
      }
      if (query?.leadId) {
        if (!Types.ObjectId.isValid(query.leadId)) {
          throw new ValidationError('Invalid lead ID format');
        }
        filter.leadId = new Types.ObjectId(query.leadId);
      }
      if (query?.type) {
        filter.type = query.type;
      }
      if (query?.status) {
        filter.status = query.status;
      }

      return DocumentModel.find(filter).sort({ createdAt: -1 });
    }

    if (caller.role === 'PLATFORM_ADMIN') {
      const filter: Record<string, unknown> = {};

      if (query?.clientId && Types.ObjectId.isValid(query.clientId)) {
        filter.clientId = new Types.ObjectId(query.clientId);
      }
      if (query?.leadId && Types.ObjectId.isValid(query.leadId)) {
        filter.leadId = new Types.ObjectId(query.leadId);
      }
      if (query?.type) {
        filter.type = query.type;
      }
      if (query?.status) {
        filter.status = query.status;
      }

      return DocumentModel.find(filter).sort({ createdAt: -1 });
    }

    throw new ForbiddenError('Unauthorized user role for listing documents');
  }

  /**
   * Retrieves a document by ID with strict tenant boundary and client ownership enforcement.
   */
  async getDocumentById(
    caller: AuthUserContext,
    id: string
  ): Promise<IDocumentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Document resource not found');
    }

    const doc = await documentRepository.findByIdWithDetails(caller, id);
    if (!doc) {
      throw new NotFoundError('Document resource not found');
    }

    // Ownership check
    authorizationService.authorizeDocumentAccess(caller, doc);

    // If CLIENT, additionally verify that document belongs to their own client record
    if (caller.role === 'CLIENT') {
      const client = await Client.findOne(
        withBrokerageScope(caller.brokerageId!, {
          userId: new Types.ObjectId(caller.id),
        })
      );
      const isOwner =
        (doc.uploadedBy as any)?._id?.toString() === caller.id ||
        doc.uploadedBy?.toString() === caller.id ||
        (client && doc.clientId?.toString() === client._id.toString());

      if (!isOwner) {
        throw new NotFoundError('Document resource not found');
      }
    }

    return doc;
  }
}

export const documentService = new DocumentService();
