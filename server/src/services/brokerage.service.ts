import { Types } from 'mongoose';
import crypto from 'node:crypto';
import { Brokerage, type IBrokerageDocument } from '../models/brokerage.model.js';
import { User, type IUserDocument } from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { IDomainService } from './base.service.js';
import type {
  CreateBrokerageInput,
  UpdateBrokerageInput,
} from '../validators/brokerage.validators.js';

export interface SafeBrokerageResult {
  id: string;
  name: string;
  slug?: string | undefined;
  plan: string;
  status: string;
  webhookSecret?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeAdminResult {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string | undefined;
  brokerageId: string;
  createdAt: Date;
}

export interface OnboardingResult {
  brokerage: SafeBrokerageResult;
  admin: SafeAdminResult;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class BrokerageService implements IDomainService {
  readonly serviceName = 'BrokerageService';

  /**
   * Sanitizes a brokerage document into a safe public/onboarding representation.
   */
  sanitizeBrokerage(brokerage: IBrokerageDocument): SafeBrokerageResult {
    return {
      id: brokerage._id.toString(),
      name: brokerage.name,
      slug: brokerage.slug,
      plan: brokerage.plan,
      status: brokerage.status,
      webhookSecret: brokerage.webhookSecret,
      createdAt: brokerage.createdAt,
      updatedAt: brokerage.updatedAt,
    };
  }

  /**
   * Atomically onboards a new brokerage and provisions its initial BROKERAGE_ADMIN account.
   * - Automatically generates a secure 24-byte hex webhook secret.
   * - Validates identity conflicts (brokerage slug, platform admin email).
   * - Implements compensating rollback if admin account creation fails.
   * - Returns only safe onboarding data (never exposes password hashes or internal credentials).
   */
  async createBrokerage(input: CreateBrokerageInput): Promise<OnboardingResult> {
    // 1. Resolve and normalize slug
    let slug = input.slug?.toLowerCase().trim();
    if (!slug) {
      const baseSlug = slugify(input.name) || 'brokerage';
      const existingSlug = await Brokerage.findOne({ slug: baseSlug });
      slug = existingSlug ? `${baseSlug}-${crypto.randomBytes(3).toString('hex')}` : baseSlug;
    } else {
      const existingSlug = await Brokerage.findOne({ slug });
      if (existingSlug) {
        throw new ConflictError('A brokerage with this slug already exists');
      }
    }

    // 2. Extract and normalize admin fields
    const adminName = (input.admin?.name ?? input.adminName)!.trim();
    const adminEmail = (input.admin?.email ?? input.adminEmail)!.toLowerCase().trim();
    const adminPassword = (input.admin?.password ?? input.adminPassword)!;
    const adminPhone = (input.admin?.phone ?? input.adminPhone)?.trim();

    // 3. Check for conflicting identity against global PLATFORM_ADMIN
    const existingPlatformAdmin = await User.findOne({
      email: adminEmail,
      role: 'PLATFORM_ADMIN',
    });
    if (existingPlatformAdmin) {
      throw new ConflictError('A user with this email already exists as a platform administrator');
    }

    // 4. Generate secure webhook secret & hash password
    const webhookSecret = crypto.randomBytes(24).toString('hex');
    const passwordHash = await hashPassword(adminPassword);

    // 5. Create Brokerage entity
    let brokerageDoc: IBrokerageDocument;
    try {
      brokerageDoc = await Brokerage.create({
        name: input.name.trim(),
        slug,
        plan: input.plan || 'STARTER',
        status: input.status || 'ACTIVE',
        webhookSecret,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictError('A brokerage with this slug or name already exists');
      }
      throw err;
    }

    // 6. Atomically provision initial BROKERAGE_ADMIN with compensating rollback
    let adminUser: IUserDocument;
    try {
      const adminPayload: Record<string, unknown> = {
        brokerageId: brokerageDoc._id,
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: 'BROKERAGE_ADMIN',
        status: 'ACTIVE',
      };
      if (adminPhone) {
        adminPayload.phone = adminPhone;
      }
      adminUser = (await User.create(adminPayload)) as unknown as IUserDocument;
    } catch (userErr: any) {
      // Compensating rollback: delete newly created brokerage so no orphan records persist
      await Brokerage.deleteOne({ _id: brokerageDoc._id }).catch((cleanupErr) => {
        logger.error(
          { cleanupErr, brokerageId: brokerageDoc._id },
          'Failed to delete orphaned brokerage during rollback'
        );
      });

      if (userErr?.code === 11000) {
        throw new ConflictError('An administrator account with this email already exists');
      }
      throw userErr;
    }

    logger.info(
      {
        brokerageId: brokerageDoc._id,
        slug: brokerageDoc.slug,
        adminUserId: adminUser._id,
      },
      'Brokerage and initial brokerage admin onboarded successfully'
    );

    return {
      brokerage: this.sanitizeBrokerage(brokerageDoc),
      admin: {
        id: adminUser._id.toString(),
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        status: adminUser.status,
        phone: adminUser.phone,
        brokerageId: brokerageDoc._id.toString(),
        createdAt: adminUser.createdAt,
      },
    };
  }

  /**
   * Updates brokerage lifecycle attributes (status, plan, name, slug).
   * Validates target ID and prevents slug conflicts.
   */
  async updateBrokerage(
    brokerageId: string,
    input: UpdateBrokerageInput
  ): Promise<SafeBrokerageResult> {
    if (!Types.ObjectId.isValid(brokerageId)) {
      throw new NotFoundError('Brokerage resource not found');
    }

    const brokerage = await Brokerage.findById(brokerageId);
    if (!brokerage) {
      throw new NotFoundError('Brokerage resource not found');
    }

    if (input.slug) {
      const normalizedSlug = input.slug.toLowerCase().trim();
      if (normalizedSlug !== brokerage.slug) {
        const slugConflict = await Brokerage.findOne({
          slug: normalizedSlug,
          _id: { $ne: brokerage._id },
        });
        if (slugConflict) {
          throw new ConflictError('A brokerage with this slug already exists');
        }
        brokerage.slug = normalizedSlug;
      }
    }

    if (input.name) {
      brokerage.name = input.name.trim();
    }
    if (input.plan) {
      brokerage.plan = input.plan;
    }
    if (input.status) {
      brokerage.status = input.status;
    }

    try {
      await brokerage.save();
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictError('A brokerage with this slug already exists');
      }
      throw err;
    }

    logger.info(
      {
        brokerageId: brokerage._id,
        status: brokerage.status,
        plan: brokerage.plan,
      },
      'Brokerage lifecycle details updated successfully'
    );

    return this.sanitizeBrokerage(brokerage);
  }

  /**
   * Rotates a brokerage's webhook secret.
   */
  async rotateWebhookSecret(brokerageId: string): Promise<{ id: string; webhookSecret: string }> {
    if (!Types.ObjectId.isValid(brokerageId)) {
      throw new NotFoundError('Brokerage resource not found');
    }

    const brokerage = await Brokerage.findById(brokerageId);
    if (!brokerage) {
      throw new NotFoundError('Brokerage resource not found');
    }

    const newSecret = crypto.randomBytes(24).toString('hex');
    brokerage.webhookSecret = newSecret;
    await brokerage.save();

    logger.info({ brokerageId: brokerage._id }, 'Brokerage webhook secret rotated successfully');

    return {
      id: brokerage._id.toString(),
      webhookSecret: newSecret,
    };
  }

  /**
   * Retrieves a brokerage by ID.
   */
  async getBrokerageById(brokerageId: string): Promise<SafeBrokerageResult> {
    if (!Types.ObjectId.isValid(brokerageId)) {
      throw new NotFoundError('Brokerage resource not found');
    }

    const brokerage = await Brokerage.findById(brokerageId);
    if (!brokerage) {
      throw new NotFoundError('Brokerage resource not found');
    }

    return this.sanitizeBrokerage(brokerage);
  }
}

export const brokerageService = new BrokerageService();
