import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { requireRoles, requireSameBrokerage, requireActiveUser } from '../../src/middleware/rbac.middleware.js';
import { authorizationService } from '../../src/services/authorization.service.js';
import { Brokerage, Client, Document as DocumentModel } from '../../src/models/index.js';
import { clientRepository } from '../../src/repositories/client.repository.js';
import { documentRepository } from '../../src/repositories/document.repository.js';
import { ForbiddenError, UnauthorizedError, BrokerageIsolationError, NotFoundError } from '../../src/utils/errors.js';
import type { AuthUserContext } from '../../src/middleware/auth.middleware.js';
import type { Request, Response } from 'express';

describe('Authorization & RBAC Unit Tests', () => {
  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let platformAdminUser: AuthUserContext;
  let brokerageAdminUser: AuthUserContext;
  let advisorUser: AuthUserContext;
  let clientUserA: AuthUserContext;
  let clientUserB: AuthUserContext;

  beforeEach(async () => {
    brokerageA = await Brokerage.create({
      name: 'Berlin Mortgages GmbH',
      slug: 'berlin-mortgages',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Munich Mortgages UG',
      slug: 'munich-mortgages',
      plan: 'STARTER',
      status: 'ACTIVE',
    });

    platformAdminUser = {
      id: new Types.ObjectId().toString(),
      email: 'admin@platform.com',
      name: 'Super Admin',
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
      brokerageId: null,
    };

    brokerageAdminUser = {
      id: new Types.ObjectId().toString(),
      email: 'admin@berlin.de',
      name: 'Klaus Admin',
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
      brokerageId: brokerageA._id.toString(),
    };

    advisorUser = {
      id: new Types.ObjectId().toString(),
      email: 'advisor@berlin.de',
      name: 'Elena Advisor',
      role: 'ADVISOR',
      status: 'ACTIVE',
      brokerageId: brokerageA._id.toString(),
    };

    clientUserA = {
      id: new Types.ObjectId().toString(),
      email: 'alex@expat.de',
      name: 'Alex Client',
      role: 'CLIENT',
      status: 'ACTIVE',
      brokerageId: brokerageA._id.toString(),
    };

    clientUserB = {
      id: new Types.ObjectId().toString(),
      email: 'john@expat.de',
      name: 'John Client',
      role: 'CLIENT',
      status: 'ACTIVE',
      brokerageId: brokerageB._id.toString(),
    };
  });

  describe('RBAC Middleware Guards', () => {
    it('requireRoles should allow authorized role and call next()', () => {
      const guard = requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN');
      const req = { user: brokerageAdminUser } as Request;
      const res = {} as Response;
      let nextCalled = false;
      let capturedError: unknown = null;

      guard(req, res, (err) => {
        nextCalled = true;
        capturedError = err;
      });

      expect(nextCalled).toBe(true);
      expect(capturedError).toBeUndefined();
    });

    it('requireRoles should block unauthorized role with 403 ForbiddenError', () => {
      const guard = requireRoles('PLATFORM_ADMIN');
      const req = { user: advisorUser } as Request;
      const res = {} as Response;
      let capturedError: unknown = null;

      guard(req, res, (err) => {
        capturedError = err;
      });

      expect(capturedError).toBeInstanceOf(ForbiddenError);
      expect((capturedError as ForbiddenError).statusCode).toBe(403);
    });

    it('requireRoles should reject unauthenticated request with 401 UnauthorizedError', () => {
      const guard = requireRoles('ADVISOR');
      const req = {} as Request;
      const res = {} as Response;
      let capturedError: unknown = null;

      guard(req, res, (err) => {
        capturedError = err;
      });

      expect(capturedError).toBeInstanceOf(UnauthorizedError);
      expect((capturedError as UnauthorizedError).statusCode).toBe(401);
    });

    it('requireSameBrokerage should allow matching tenant context', () => {
      const guard = requireSameBrokerage('brokerageId');
      const req = {
        user: advisorUser,
        params: { brokerageId: brokerageA._id.toString() },
      } as unknown as Request;
      let capturedError: unknown = null;

      guard(req, {} as Response, (err) => {
        capturedError = err;
      });

      expect(capturedError).toBeUndefined();
    });

    it('requireSameBrokerage should allow PLATFORM_ADMIN cross-brokerage access', () => {
      const guard = requireSameBrokerage('brokerageId');
      const req = {
        user: platformAdminUser,
        params: { brokerageId: brokerageA._id.toString() },
      } as unknown as Request;
      let capturedError: unknown = null;

      guard(req, {} as Response, (err) => {
        capturedError = err;
      });

      expect(capturedError).toBeUndefined();
    });

    it('requireSameBrokerage should reject cross-brokerage access with 403 BrokerageIsolationError', () => {
      const guard = requireSameBrokerage('brokerageId');
      const req = {
        user: advisorUser,
        params: { brokerageId: brokerageB._id.toString() },
      } as unknown as Request;
      let capturedError: unknown = null;

      guard(req, {} as Response, (err) => {
        capturedError = err;
      });

      expect(capturedError).toBeInstanceOf(BrokerageIsolationError);
      expect((capturedError as BrokerageIsolationError).statusCode).toBe(403);
    });

    it('requireSameBrokerage should reject when target parameter is missing or empty', () => {
      const guard = requireSameBrokerage('brokerageId');
      const req = {
        user: advisorUser,
        params: {},
      } as unknown as Request;
      let capturedError: unknown = null;

      guard(req, {} as Response, (err) => {
        capturedError = err;
      });

      expect(capturedError).toBeInstanceOf(BrokerageIsolationError);
      expect((capturedError as BrokerageIsolationError).statusCode).toBe(403);
    });

    it('requireActiveUser should allow active accounts and reject suspended accounts', () => {
      let capturedError: unknown = null;
      requireActiveUser({ user: advisorUser } as Request, {} as Response, (err) => {
        capturedError = err;
      });
      expect(capturedError).toBeUndefined();

      const suspendedUser: AuthUserContext = { ...advisorUser, status: 'SUSPENDED' };
      requireActiveUser({ user: suspendedUser } as Request, {} as Response, (err) => {
        capturedError = err;
      });
      expect(capturedError).toBeInstanceOf(UnauthorizedError);
      expect((capturedError as UnauthorizedError).message).toMatch(/inactive or suspended/i);
    });
  });

  describe('AuthorizationService Policies & IDOR Protection', () => {
    it('assertBrokerageAccess should permit PLATFORM_ADMIN and matching tenant', () => {
      expect(() => {
        authorizationService.assertBrokerageAccess(platformAdminUser, brokerageA._id);
      }).not.toThrow();

      expect(() => {
        authorizationService.assertBrokerageAccess(advisorUser, brokerageA._id);
      }).not.toThrow();

      expect(() => {
        authorizationService.assertBrokerageAccess(advisorUser, brokerageB._id);
      }).toThrow(BrokerageIsolationError);
    });

    it('authorizeClientAccess should allow client to view their own profile', () => {
      const clientProfile = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(clientUserA.id),
        brokerageId: brokerageA._id,
      };

      expect(() => {
        authorizationService.authorizeClientAccess(clientUserA, clientProfile);
      }).not.toThrow();
    });

    it('authorizeClientAccess should throw NotFoundError when CLIENT accesses another client (prevent IDOR leakage)', () => {
      const otherClientInSameBrokerage = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(), // Different user
        brokerageId: brokerageA._id,
      };

      expect(() => {
        authorizationService.authorizeClientAccess(clientUserA, otherClientInSameBrokerage);
      }).toThrow(NotFoundError);
    });

    it('authorizeClientAccess should throw NotFoundError on cross-tenant client access', () => {
      const clientInBrokerageB = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(clientUserB.id),
        brokerageId: brokerageB._id,
      };

      expect(() => {
        authorizationService.authorizeClientAccess(advisorUser, clientInBrokerageB);
      }).toThrow(NotFoundError);
    });

    it('authorizeDocumentAccess should throw NotFoundError when CLIENT accesses another user document', () => {
      const otherDoc = {
        _id: new Types.ObjectId(),
        uploadedBy: new Types.ObjectId(), // Different uploader
        brokerageId: brokerageA._id,
      };

      expect(() => {
        authorizationService.authorizeDocumentAccess(clientUserA, otherDoc);
      }).toThrow(NotFoundError);
    });

    it('authorizeDocumentAccess should allow client to access document they uploaded', () => {
      const ownDoc = {
        _id: new Types.ObjectId(),
        uploadedBy: new Types.ObjectId(clientUserA.id),
        brokerageId: brokerageA._id,
      };

      expect(() => {
        authorizationService.authorizeDocumentAccess(clientUserA, ownDoc);
      }).not.toThrow();
    });

    it('authorizeDocumentAccess should safely reject with NotFoundError when uploadedBy is falsy or missing', () => {
      const docWithoutUploader = {
        _id: new Types.ObjectId(),
        uploadedBy: null as unknown as Types.ObjectId,
        brokerageId: brokerageA._id,
      };

      expect(() => {
        authorizationService.authorizeDocumentAccess(clientUserA, docWithoutUploader);
      }).toThrow(NotFoundError);
    });
  });

  describe('ScopedRepository Automatic Tenant Scoping', () => {
    it('should return null when querying guessed cross-tenant ID', async () => {
      // Create client in Brokerage B
      const clientInB = await Client.create({
        brokerageId: brokerageB._id,
        firstName: 'Secret',
        lastName: 'Buyer',
        email: 'secret@munich.de',
        phone: '+49 170 0000000',
        status: 'ACTIVE',
        type: 'BUYER',
      });

      // Advisor from Brokerage A queries the guessed ID of client in Brokerage B
      const result = await clientRepository.findById(advisorUser, clientInB._id);
      expect(result).toBeNull(); // Strictly scoped to Brokerage A, returns null

      // Platform admin can query across brokerages
      const platformResult = await clientRepository.findById(platformAdminUser, clientInB._id);
      expect(platformResult).not.toBeNull();
      expect(platformResult?._id.toString()).toBe(clientInB._id.toString());
    });

    it('should return null for malformed or non-existent IDs', async () => {
      const malformed = await clientRepository.findById(advisorUser, 'not-a-valid-id');
      expect(malformed).toBeNull();

      const nonExistent = await clientRepository.findById(advisorUser, new Types.ObjectId());
      expect(nonExistent).toBeNull();
    });

    it('should automatically inject brokerageId on creation for tenant users', async () => {
      const doc = await documentRepository.create(advisorUser, {
        title: 'Mortgage Application Form',
        fileUrl: 'https://storage.internal/docs/app.pdf',
        type: 'OTHER',
        status: 'PENDING',
        uploadedBy: new Types.ObjectId(advisorUser.id),
      });

      expect(doc.brokerageId.toString()).toBe(brokerageA._id.toString());
    });
  });
});
