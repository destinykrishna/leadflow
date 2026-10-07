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
import { emitDocumentStatusChanged } from '../queues/document-events.js';
import { activityService } from './activity.service.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BrokerageIsolationError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import {
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
  validateFileSignature,
  type DocumentQuery,
  type ReviewDocumentInput,
} from '../validators/document.validators.js';
import { documentIntelligenceService } from './document-intelligence.service.js';
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
   * 1. Validates file presence, MIME type, size limit, binary magic bytes, and document type.
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

    // Binary magic byte validation: verify binary signature matches declared MIME and allowed formats
    validateFileSignature(input.file.buffer, input.file.mimetype, input.file.originalname);

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
    let targetClientUserId: string | undefined;

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
      targetClientUserId = caller.id;
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
        if (client.userId) {
          targetClientUserId = client.userId.toString();
        }
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
        if (client.userId) {
          targetClientUserId = client.userId.toString();
        }
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

      // 6. Emit realtime status event so active document views update dynamically without refresh
      emitDocumentStatusChanged({
        documentId: document._id.toString(),
        brokerageId: targetBrokerageId.toString(),
        clientId: targetClientId ? targetClientId.toString() : undefined,
        leadId: targetLeadId ? targetLeadId.toString() : undefined,
        uploadedBy: caller.id,
        clientUserId: targetClientUserId,
        previousStatus: 'PENDING',
        newStatus: 'PENDING',
        type: document.type,
        title: document.title,
        updatedAt: document.updatedAt,
      });

      // Record immutable activity log (failure isolated, never throws)
      void activityService.logActivity({
        brokerageId: targetBrokerageId,
        entityType: 'DOCUMENT',
        entityId: document._id,
        leadId: targetLeadId || undefined,
        clientId: targetClientId || undefined,
        action: 'DOCUMENT_UPLOADED',
        actor: {
          id: caller.id,
          name: caller.name,
          role: caller.role,
          email: caller.email,
        },
        metadata: {
          title: document.title,
          documentType: document.type,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
        },
      });

      // 7. Enqueue background verification job in BullMQ
      try {
        await enqueueDocumentProcessing({
          documentId: document._id.toString(),
          brokerageId: targetBrokerageId.toString(),
          clientId: targetClientId ? targetClientId.toString() : undefined,
          leadId: targetLeadId ? targetLeadId.toString() : undefined,
          uploadedBy: caller.id,
          clientUserId: targetClientUserId,
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
    const limit = Math.min(query?.limit ?? 100, 200);
    const page = Math.max(query?.page ?? 1, 1);
    const skip = (page - 1) * limit;

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

      return DocumentModel.find(clientFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
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

      return DocumentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
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

      return DocumentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
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

    // If CLIENT, additionally verify that document belongs to their own client record
    let clientProfileId: Types.ObjectId | string | null = null;
    if (caller.role === 'CLIENT') {
      const client = await Client.findOne(
        withBrokerageScope(caller.brokerageId!, {
          userId: new Types.ObjectId(caller.id),
        })
      );
      if (client) {
        clientProfileId = client._id;
      }
    }

    // Ownership check (anti-IDOR and tenant boundary)
    authorizationService.authorizeDocumentAccess(caller, doc, clientProfileId);

    // If extracted data exists, dynamically ensure review signals are up-to-date with current siblings
    if (doc.extractedData && (doc.clientId || doc.leadId)) {
      try {
        const siblingFilter: any = { _id: { $ne: doc._id } };
        if (doc.clientId) {
          siblingFilter.clientId = doc.clientId;
        } else if (doc.leadId) {
          siblingFilter.leadId = doc.leadId;
        }
        const siblings = await DocumentModel.find(
          withBrokerageScope(doc.brokerageId, siblingFilter)
        );
        doc.extractedData.reviewSignals = documentIntelligenceService.evaluateConsistency(
          doc,
          siblings
        );
      } catch (err: any) {
        logger.warn(
          { documentId: doc._id, err: err.message },
          'Failed to refresh cross-document review signals on read'
        );
      }
    }

    return doc;
  }

  /**
   * Generates an authorized, time-limited signed ImageKit download URL for a document.
   * Strictly enforces:
   * 1. Authenticated user with active standing
   * 2. Active brokerage context
   * 3. Role-based access rules (Platform Admin, Brokerage Admin, Advisor, Client)
   * 4. Multi-tenant brokerage isolation (withBrokerageScope & anti-IDOR 404 concealment)
   * 5. Strict client case / document ownership verification
   * Defends against VULN-02 by never exposing permanent unauthenticated URLs.
   */
  async getDocumentDownloadUrl(
    caller: AuthUserContext,
    id: string
  ): Promise<{
    documentId: string;
    title: string;
    downloadUrl: string;
    expiresIn: number;
  }> {
    const doc = await this.getDocumentById(caller, id);

    const expiresIn = 300; // 5 minutes
    const downloadUrl = storageService.generateSignedUrl(doc.fileUrl, {
      expiresInSeconds: expiresIn,
    });

    return {
      documentId: doc._id.toString(),
      title: doc.title,
      downloadUrl,
      expiresIn,
    };
  }

  /**
   * Performs human verification review (Approval or Rejection) on a document.
   * Strictly enforces:
   * 1. Only authorized staff (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR) in the same brokerage.
   * 2. CLIENT role is strictly forbidden from reviewing documents.
   * 3. Tenant isolation via withBrokerageScope (anti-IDOR 404 concealment).
   * 4. Atomic conditional transitions with optimistic concurrency locking (__v and status matching).
   * 5. Returns HTTP 409 ConflictError for stale reviews or documents already decided.
   * 6. Records verifiedBy (User ID), verifiedAt timestamp, verificationNotes, and mandatory rejectionReason on rejection.
   * 7. Emits realtime document:status_changed event to brokerage and client rooms.
   */
  async reviewDocument(
    caller: AuthUserContext,
    id: string,
    input: ReviewDocumentInput
  ): Promise<IDocumentDocument> {
    // 1. Role validation: Clients cannot verify documents
    if (caller.role === 'CLIENT') {
      throw new ForbiddenError('Clients are not authorized to review or verify documents');
    }

    if (!['PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'].includes(caller.role)) {
      throw new ForbiddenError('Unauthorized user role for document verification');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Document resource not found');
    }

    // 2. Resolve target brokerage scope and fetch existing document
    let filter: Record<string, unknown>;
    if (caller.role === 'PLATFORM_ADMIN') {
      filter = { _id: new Types.ObjectId(id) };
    } else {
      if (!caller.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for staff user');
      }
      filter = withBrokerageScope(caller.brokerageId, {
        _id: new Types.ObjectId(id),
      });
    }

    const doc = await DocumentModel.findOne(filter);
    if (!doc) {
      throw new NotFoundError('Document resource not found');
    }

    // 3. Stale review check (if expectedVersion provided and mismatch)
    if (input.expectedVersion !== undefined && doc.__v !== input.expectedVersion) {
      throw new ConflictError(
        'Document was modified by another process. Please refresh and review the latest version.'
      );
    }

    // Prevent duplicate terminal decisions
    if (doc.status === 'VERIFIED' || doc.status === 'REJECTED') {
      throw new ConflictError(
        `Document has already reached terminal status (${doc.status}) and cannot be re-reviewed.`
      );
    }

    // 4. Atomic conditional transition preventing worker/human races
    const targetBrokerageId = doc.brokerageId;
    const atomicFilter: Record<string, unknown> = {
      _id: doc._id,
      brokerageId: targetBrokerageId,
      status: { $in: ['PENDING_REVIEW', 'PENDING', 'PROCESSING'] },
      __v: doc.__v,
    };

    const updateSet: Record<string, unknown> = {
      status: input.status,
      verifiedAt: new Date(),
      verifiedBy: new Types.ObjectId(caller.id),
    };

    if (input.verificationNotes !== undefined && input.verificationNotes.trim().length > 0) {
      updateSet.verificationNotes = input.verificationNotes.trim();
    }

    if (input.status === 'REJECTED') {
      const reason = input.rejectionReason?.trim();
      updateSet.rejectionReason = reason;
      if (!updateSet.verificationNotes) {
        updateSet.verificationNotes = `Rejected by reviewer: ${reason}`;
      }
    } else if (input.status === 'VERIFIED') {
      updateSet.rejectionReason = null;
      if (!updateSet.verificationNotes) {
        updateSet.verificationNotes = 'Document verified and approved by advisor.';
      }
    }

    const reviewedDoc = await DocumentModel.findOneAndUpdate(
      atomicFilter,
      {
        $set: updateSet,
        $inc: { __v: 1 },
      },
      { returnDocument: 'after' }
    );

    if (!reviewedDoc) {
      // Document was updated concurrently by another reviewer or worker
      logger.warn(
        { documentId: id, callerId: caller.id, expectedVersion: doc.__v },
        'Conflict detected during human document review'
      );
      throw new ConflictError(
        'Document was concurrently updated or has already been reviewed. Please refresh.'
      );
    }

    logger.info(
      {
        documentId: reviewedDoc._id,
        brokerageId: reviewedDoc.brokerageId,
        newStatus: reviewedDoc.status,
        verifiedBy: caller.id,
      },
      `Document review successfully committed: ${reviewedDoc.status}`
    );

    // 5. Resolve target client user id for private room broadcast if applicable
    let targetClientUserId: string | undefined;
    if (reviewedDoc.clientId) {
      const client = await Client.findById(reviewedDoc.clientId);
      if (client?.userId) {
        targetClientUserId = client.userId.toString();
      }
    }

    // 6. Emit realtime document status event
    emitDocumentStatusChanged({
      documentId: reviewedDoc._id.toString(),
      brokerageId: reviewedDoc.brokerageId.toString(),
      clientId: reviewedDoc.clientId?.toString(),
      leadId: reviewedDoc.leadId?.toString(),
      uploadedBy: reviewedDoc.uploadedBy?.toString(),
      clientUserId: targetClientUserId,
      previousStatus: doc.status,
      newStatus: reviewedDoc.status,
      type: reviewedDoc.type,
      title: reviewedDoc.title,
      verificationNotes: reviewedDoc.verificationNotes,
      verifiedAt: reviewedDoc.verifiedAt,
      verifiedBy: caller.id,
      rejectionReason: reviewedDoc.rejectionReason,
      updatedAt: reviewedDoc.updatedAt,
    });

    if (reviewedDoc.status === 'VERIFIED' || reviewedDoc.status === 'REJECTED') {
      void activityService.logActivity({
        brokerageId: reviewedDoc.brokerageId,
        entityType: 'DOCUMENT',
        entityId: reviewedDoc._id,
        leadId: reviewedDoc.leadId || undefined,
        clientId: reviewedDoc.clientId || undefined,
        action: reviewedDoc.status === 'VERIFIED' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
        actor: {
          id: caller.id,
          name: caller.name,
          role: caller.role,
          email: caller.email,
        },
        metadata: {
          title: reviewedDoc.title,
          documentType: reviewedDoc.type,
          verificationNotes: reviewedDoc.verificationNotes,
          rejectionReason: reviewedDoc.rejectionReason,
        },
      });
    }

    return reviewedDoc;
  }
}

export const documentService = new DocumentService();
