import { Types } from 'mongoose';
import crypto from 'node:crypto';
import { User, type IUserDocument } from '../models/user.model.js';
import { Brokerage } from '../models/brokerage.model.js';
import { Session } from '../models/session.model.js';
import { hashPassword } from '../utils/password.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  BrokerageIsolationError,
  ForbiddenError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import type { IDomainService } from './base.service.js';
import type {
  CreateAdvisorInput,
  UpdateAdvisorInput,
  ListAdvisorsQuery,
} from '../validators/advisor.validators.js';

export interface SafeAdvisorResult {
  id: string;
  name: string;
  email: string;
  role: 'ADVISOR';
  status: string;
  phone?: string | undefined;
  brokerageId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedAdvisorsResult {
  advisors: SafeAdvisorResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AdvisorService implements IDomainService {
  readonly serviceName = 'AdvisorService';

  /**
   * Sanitizes a user document into a safe public advisor representation.
   * Never exposes passwordHash or sensitive credentials.
   */
  sanitizeAdvisor(user: IUserDocument): SafeAdvisorResult {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: 'ADVISOR',
      status: user.status,
      phone: user.phone,
      brokerageId: user.brokerageId ? user.brokerageId.toString() : '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Creates/invites a new advisor within the target brokerage.
   * - Enforces tenant boundaries (BROKERAGE_ADMIN bound to caller.brokerageId).
   * - Validates identity conflicts against global PLATFORM_ADMIN and existing tenant users.
   * - Provisions secure onboarding credentials without leaking plaintext passwords or hashes.
   */
  async createAdvisor(
    caller: AuthUserContext,
    input: CreateAdvisorInput
  ): Promise<SafeAdvisorResult> {
    if (caller.role !== 'PLATFORM_ADMIN' && caller.role !== 'BROKERAGE_ADMIN') {
      throw new ForbiddenError(
        `Access denied: Role ${caller.role} is not authorized to manage advisors`
      );
    }

    let targetBrokerageId: string;

    if (caller.role === 'BROKERAGE_ADMIN') {
      if (!caller.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for administrator');
      }
      if (input.brokerageId && input.brokerageId.toString() !== caller.brokerageId.toString()) {
        throw new BrokerageIsolationError(
          'Access denied: Cross-brokerage tenant boundary violation'
        );
      }
      targetBrokerageId = caller.brokerageId;
    } else {
      // PLATFORM_ADMIN
      if (!input.brokerageId) {
        throw new ValidationError('brokerageId is required for platform administrators');
      }
      if (!Types.ObjectId.isValid(input.brokerageId)) {
        throw new ValidationError('Invalid brokerageId format');
      }
      const targetBrokerage = await Brokerage.findById(input.brokerageId);
      if (!targetBrokerage || targetBrokerage.status !== 'ACTIVE') {
        throw new NotFoundError('Target brokerage not found or inactive');
      }
      targetBrokerageId = input.brokerageId;
    }

    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Conflict check against PLATFORM_ADMIN
    const platformAdmin = await User.findOne({
      email: normalizedEmail,
      role: 'PLATFORM_ADMIN',
    });
    if (platformAdmin) {
      throw new ConflictError(
        'A user with this email already exists as a platform administrator'
      );
    }

    // 2. Conflict check within same brokerage
    const existingInBrokerage = await User.findOne({
      brokerageId: new Types.ObjectId(targetBrokerageId),
      email: normalizedEmail,
    });
    if (existingInBrokerage) {
      throw new ConflictError(
        'An account with this email already exists within this brokerage'
      );
    }

    // 3. Generate safe onboarding credentials
    const rawPassword = input.password || crypto.randomBytes(16).toString('base64url');
    const passwordHash = await hashPassword(rawPassword);

    // 4. Create ADVISOR User document
    let advisorDoc: IUserDocument;
    try {
      const userPayload: Record<string, unknown> = {
        brokerageId: new Types.ObjectId(targetBrokerageId),
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'ADVISOR',
        status: 'ACTIVE',
      };
      if (input.phone) {
        userPayload.phone = input.phone.trim();
      }

      advisorDoc = (await User.create(userPayload)) as unknown as IUserDocument;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictError(
          'An account with this email already exists within this brokerage'
        );
      }
      throw err;
    }

    logger.info(
      {
        advisorId: advisorDoc._id,
        brokerageId: targetBrokerageId,
        callerId: caller.id,
      },
      'Advisor account created successfully'
    );

    return this.sanitizeAdvisor(advisorDoc);
  }

  /**
   * Lists advisors for the current brokerage.
   * - BROKERAGE_ADMIN restricted strictly to own brokerageId.
   * - PLATFORM_ADMIN can view all or filter by brokerageId.
   */
  async listAdvisors(
    caller: AuthUserContext,
    query: ListAdvisorsQuery = {}
  ): Promise<PaginatedAdvisorsResult> {
    if (caller.role !== 'PLATFORM_ADMIN' && caller.role !== 'BROKERAGE_ADMIN') {
      throw new ForbiddenError(
        `Access denied: Role ${caller.role} is not authorized to manage advisors`
      );
    }

    const filter: Record<string, any> = { role: 'ADVISOR' };

    if (caller.role === 'BROKERAGE_ADMIN') {
      if (!caller.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for administrator');
      }
      if (query.brokerageId && query.brokerageId.toString() !== caller.brokerageId.toString()) {
        throw new BrokerageIsolationError(
          'Access denied: Cross-brokerage tenant boundary violation'
        );
      }
      filter.brokerageId = new Types.ObjectId(caller.brokerageId);
    } else if (query.brokerageId) {
      if (!Types.ObjectId.isValid(query.brokerageId)) {
        throw new ValidationError('Invalid brokerageId format');
      }
      filter.brokerageId = new Types.ObjectId(query.brokerageId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
    const skip = (page - 1) * limit;

    const [advisors, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return {
      advisors: advisors.map((a) => this.sanitizeAdvisor(a)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves an advisor by ID with anti-IDOR protection.
   * Returns 404 NotFoundError on cross-tenant access to prevent discovery of external IDs.
   */
  async getAdvisorById(
    caller: AuthUserContext,
    advisorId: string,
    expectedBrokerageId?: string
  ): Promise<SafeAdvisorResult> {
    if (caller.role !== 'PLATFORM_ADMIN' && caller.role !== 'BROKERAGE_ADMIN') {
      throw new ForbiddenError(
        `Access denied: Role ${caller.role} is not authorized to manage advisors`
      );
    }

    if (!Types.ObjectId.isValid(advisorId)) {
      throw new NotFoundError('Advisor resource not found');
    }

    const advisor = await User.findOne({
      _id: new Types.ObjectId(advisorId),
      role: 'ADVISOR',
    });

    if (!advisor) {
      throw new NotFoundError('Advisor resource not found');
    }

    // Anti-IDOR check for BROKERAGE_ADMIN
    if (caller.role === 'BROKERAGE_ADMIN') {
      if (
        !caller.brokerageId ||
        !advisor.brokerageId ||
        advisor.brokerageId.toString() !== caller.brokerageId
      ) {
        throw new NotFoundError('Advisor resource not found');
      }
    }

    // Verify expectedBrokerageId if explicitly targeted via nested route
    if (expectedBrokerageId && advisor.brokerageId?.toString() !== expectedBrokerageId) {
      throw new NotFoundError('Advisor resource not found');
    }

    return this.sanitizeAdvisor(advisor);
  }

  /**
   * Updates advisor details (name, phone, status: ACTIVE / INACTIVE).
   * Preserves historical assignments (leads, clients, tasks) when an advisor is marked INACTIVE.
   * Immediately revokes all active sessions upon deactivation.
   */
  async updateAdvisor(
    caller: AuthUserContext,
    advisorId: string,
    input: UpdateAdvisorInput,
    expectedBrokerageId?: string
  ): Promise<SafeAdvisorResult> {
    if (caller.role !== 'PLATFORM_ADMIN' && caller.role !== 'BROKERAGE_ADMIN') {
      throw new ForbiddenError(
        `Access denied: Role ${caller.role} is not authorized to manage advisors`
      );
    }

    if (!Types.ObjectId.isValid(advisorId)) {
      throw new NotFoundError('Advisor resource not found');
    }

    const advisor = await User.findOne({
      _id: new Types.ObjectId(advisorId),
      role: 'ADVISOR',
    });

    if (!advisor) {
      throw new NotFoundError('Advisor resource not found');
    }

    // Anti-IDOR check for BROKERAGE_ADMIN
    if (caller.role === 'BROKERAGE_ADMIN') {
      if (
        !caller.brokerageId ||
        !advisor.brokerageId ||
        advisor.brokerageId.toString() !== caller.brokerageId
      ) {
        throw new NotFoundError('Advisor resource not found');
      }
    }

    // Verify expectedBrokerageId if explicitly targeted via nested route
    if (expectedBrokerageId && advisor.brokerageId?.toString() !== expectedBrokerageId) {
      throw new NotFoundError('Advisor resource not found');
    }

    if (input.name !== undefined) {
      advisor.name = input.name.trim();
    }

    if (input.phone !== undefined) {
      if (input.phone) {
        advisor.phone = input.phone.trim();
      } else {
        advisor.set('phone', undefined);
      }
    }

    if (input.status !== undefined) {
      advisor.status = input.status;
      if (input.status === 'INACTIVE') {
        // Immediately invalidate all active refresh sessions in database
        await Session.updateMany(
          { userId: advisor._id, isRevoked: false },
          { isRevoked: true, revokedAt: new Date() }
        );
      }
    }

    await advisor.save();

    logger.info(
      {
        advisorId: advisor._id,
        brokerageId: advisor.brokerageId,
        status: advisor.status,
        callerId: caller.id,
      },
      'Advisor profile/status updated successfully'
    );

    return this.sanitizeAdvisor(advisor);
  }
}

export const advisorService = new AdvisorService();
