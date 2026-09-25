import { describe, it, expect, beforeAll } from 'vitest';
import { Types } from 'mongoose';
import {
  Brokerage,
  User,
  Lead,
  Client,
  Document as DocumentModel,
  Task,
  EmailTemplate,
  PipelineTrigger,
} from '../../src/models/index.js';
import { createMinimalSeedData } from '../fixtures/seed.fixture.js';

describe('Domain Models (Phase 1, Prompt 2 & 3: Domain Alignment)', () => {
  beforeAll(async () => {
    // Ensure all compound and unique indexes are synced to MongoMemoryServer
    await Promise.all([
      Brokerage.syncIndexes(),
      User.syncIndexes(),
      Lead.syncIndexes(),
      Client.syncIndexes(),
      DocumentModel.syncIndexes(),
      Task.syncIndexes(),
      EmailTemplate.syncIndexes(),
      PipelineTrigger.syncIndexes(),
    ]);
  });

  describe('Brokerage Model', () => {
    it('should create a valid brokerage with defaults', async () => {
      const brokerage = await Brokerage.create({
        name: 'Apex Realty Group',
        slug: 'apex-realty',
      });

      expect(brokerage._id).toBeDefined();
      expect(brokerage.name).toBe('Apex Realty Group');
      expect(brokerage.plan).toBe('STARTER');
      expect(brokerage.status).toBe('ACTIVE');
      expect(brokerage.createdAt).toBeInstanceOf(Date);
      expect(brokerage.updatedAt).toBeInstanceOf(Date);
    });

    it('should fail validation when name is missing', async () => {
      await expect(
        Brokerage.create({ plan: 'GROWTH' })
      ).rejects.toThrow(/Brokerage name is required/);
    });

    it('should reject invalid status enum', async () => {
      await expect(
        Brokerage.create({
          name: 'Invalid Status Brokerage',
          status: 'NOT_A_REAL_STATUS' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('User Model & RBAC Alignment (Prompt 3)', () => {
    it('should create a valid advisor scoped to a brokerage', async () => {
      const brokerageId = new Types.ObjectId();
      const user = await User.create({
        brokerageId,
        name: 'Sarah Connor',
        email: 'sarah@realty.com',
        passwordHash: '$2b$10$hashedpassword',
        role: 'ADVISOR',
      });

      expect(user._id).toBeDefined();
      expect(user.brokerageId).toEqual(brokerageId);
      expect(user.role).toBe('ADVISOR');
      expect(user.status).toBe('ACTIVE');
    });

    it('should create a PLATFORM_ADMIN without requiring brokerageId', async () => {
      const platformAdmin = await User.create({
        name: 'Super Admin',
        email: 'superadmin@leadflow.io',
        passwordHash: '$2b$10$hashedpassword',
        role: 'PLATFORM_ADMIN',
      });

      expect(platformAdmin._id).toBeDefined();
      expect(platformAdmin.role).toBe('PLATFORM_ADMIN');
      expect(platformAdmin.brokerageId).toBeNull();
    });

    it('should require brokerageId for BROKERAGE_ADMIN, ADVISOR, and CLIENT', async () => {
      const rolesRequiringBrokerage = ['BROKERAGE_ADMIN', 'ADVISOR', 'CLIENT'] as const;

      for (const role of rolesRequiringBrokerage) {
        await expect(
          User.create({
            name: `Test ${role}`,
            email: `test-${role.toLowerCase()}@test.com`,
            passwordHash: 'hash',
            role,
          })
        ).rejects.toThrow(/brokerageId is required for brokerage-scoped users/);
      }
    });

    it('should reject invalid email format', async () => {
      const brokerageId = new Types.ObjectId();
      await expect(
        User.create({
          brokerageId,
          name: 'Bad Email',
          email: 'not-an-email',
          passwordHash: 'hash',
          role: 'ADVISOR',
        })
      ).rejects.toThrow(/Invalid email address format/);
    });

    it('should reject invalid user role enum', async () => {
      const brokerageId = new Types.ObjectId();
      await expect(
        User.create({
          brokerageId,
          name: 'Invalid Role',
          email: 'invalid-role@test.com',
          passwordHash: 'hash',
          role: 'SUPER_HERO' as any,
        })
      ).rejects.toThrow();
    });

    it('should enforce unique email within the same brokerage for tenant users', async () => {
      const brokerageId = new Types.ObjectId();
      const email = 'duplicate@brokerage.com';

      await User.create({
        brokerageId,
        name: 'Advisor One',
        email,
        passwordHash: 'hash1',
        role: 'ADVISOR',
      });

      await expect(
        User.create({
          brokerageId,
          name: 'Advisor Two',
          email,
          passwordHash: 'hash2',
          role: 'ADVISOR',
        })
      ).rejects.toThrow(/E11000/);
    });

    it('should enforce unique email for PLATFORM_ADMIN', async () => {
      await User.create({
        name: 'Admin One',
        email: 'unique-platform-admin@leadflow.io',
        passwordHash: 'hash1',
        role: 'PLATFORM_ADMIN',
      });

      await expect(
        User.create({
          name: 'Admin Two',
          email: 'unique-platform-admin@leadflow.io',
          passwordHash: 'hash2',
          role: 'PLATFORM_ADMIN',
        })
      ).rejects.toThrow(/E11000/);
    });

    it('should allow the same email across different brokerages (multi-tenancy)', async () => {
      const brokerage1 = new Types.ObjectId();
      const brokerage2 = new Types.ObjectId();
      const email = 'advisor@shared-domain.com';

      const user1 = await User.create({
        brokerageId: brokerage1,
        name: 'Advisor Brokerage 1',
        email,
        passwordHash: 'hash1',
        role: 'ADVISOR',
      });

      const user2 = await User.create({
        brokerageId: brokerage2,
        name: 'Advisor Brokerage 2',
        email,
        passwordHash: 'hash2',
        role: 'ADVISOR',
      });

      expect(user1._id).toBeDefined();
      expect(user2._id).toBeDefined();
      expect(user1.brokerageId).not.toEqual(user2.brokerageId);
    });
  });

  describe('Lead Model', () => {
    it('should create a valid lead with default status NEW and score 0', async () => {
      const brokerageId = new Types.ObjectId();
      const lead = await Lead.create({
        brokerageId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        source: 'WEBSITE',
      });

      expect(lead._id).toBeDefined();
      expect(lead.status).toBe('NEW');
      expect(lead.score).toBe(0);
      expect(lead.brokerageId).toEqual(brokerageId);
    });

    it('should enforce required fields on Lead', async () => {
      await expect(Lead.create({})).rejects.toThrow(/First name is required/);
    });

    it('should reject invalid lead status', async () => {
      const brokerageId = new Types.ObjectId();
      await expect(
        Lead.create({
          brokerageId,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          status: 'INVALID_STATUS' as any,
        })
      ).rejects.toThrow();
    });

    it('should detect duplicate leads within the same brokerage', async () => {
      const brokerageId = new Types.ObjectId();
      const email = 'buyer@leads.com';

      await Lead.create({
        brokerageId,
        firstName: 'Alice',
        lastName: 'Smith',
        email,
      });

      await expect(
        Lead.create({
          brokerageId,
          firstName: 'Bob',
          lastName: 'Smith',
          email,
        })
      ).rejects.toThrow(/E11000/);
    });

    it('should allow cross-brokerage duplicate leads', async () => {
      const brokerage1 = new Types.ObjectId();
      const brokerage2 = new Types.ObjectId();
      const email = 'crossbrokerage@leads.com';

      const lead1 = await Lead.create({
        brokerageId: brokerage1,
        firstName: 'Lead',
        lastName: 'One',
        email,
      });

      const lead2 = await Lead.create({
        brokerageId: brokerage2,
        firstName: 'Lead',
        lastName: 'Two',
        email,
      });

      expect(lead1._id).toBeDefined();
      expect(lead2._id).toBeDefined();
    });
  });

  describe('Client Model', () => {
    it('should create a valid client with address, userId, and brokerage scoping', async () => {
      const brokerageId = new Types.ObjectId();
      const userId = new Types.ObjectId();
      const client = await Client.create({
        brokerageId,
        userId,
        firstName: 'Robert',
        lastName: 'Taylor',
        email: 'robert@client.com',
        type: 'BUYER',
        address: {
          street: '123 Main St',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
        },
      });

      expect(client._id).toBeDefined();
      expect(client.userId).toEqual(userId);
      expect(client.status).toBe('ACTIVE');
      expect(client.type).toBe('BUYER');
      expect(client.address?.city).toBe('Austin');
    });

    it('should enforce unique client email per brokerage', async () => {
      const brokerageId = new Types.ObjectId();
      const email = 'client@unique.com';

      await Client.create({
        brokerageId,
        firstName: 'Client',
        lastName: 'One',
        email,
      });

      await expect(
        Client.create({
          brokerageId,
          firstName: 'Client',
          lastName: 'Two',
          email,
        })
      ).rejects.toThrow(/E11000/);
    });
  });

  describe('Document Model', () => {
    it('should create a valid document with type PAYSLIP and status PENDING', async () => {
      const brokerageId = new Types.ObjectId();
      const uploadedBy = new Types.ObjectId();

      const doc = await DocumentModel.create({
        brokerageId,
        title: 'German Payslip (Gehaltsabrechnung)',
        fileUrl: 'https://storage.example.com/docs/payslip.pdf',
        type: 'PAYSLIP',
        uploadedBy,
      });

      expect(doc._id).toBeDefined();
      expect(doc.status).toBe('PENDING');
      expect(doc.type).toBe('PAYSLIP');
    });

    it('should reject invalid document status', async () => {
      const brokerageId = new Types.ObjectId();
      const uploadedBy = new Types.ObjectId();

      await expect(
        DocumentModel.create({
          brokerageId,
          title: 'Tax Form',
          fileUrl: 'https://storage.example.com/docs/w2.pdf',
          uploadedBy,
          status: 'UNRECOGNIZED_STATUS' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('Task Model', () => {
    it('should create a valid task with default status and priority', async () => {
      const brokerageId = new Types.ObjectId();
      const assignedTo = new Types.ObjectId();

      const task = await Task.create({
        brokerageId,
        title: 'Follow up with expat lead',
        assignedTo,
      });

      expect(task._id).toBeDefined();
      expect(task.status).toBe('PENDING');
      expect(task.priority).toBe('MEDIUM');
    });

    it('should reject invalid priority enum', async () => {
      const brokerageId = new Types.ObjectId();
      const assignedTo = new Types.ObjectId();

      await expect(
        Task.create({
          brokerageId,
          title: 'Invalid Priority',
          assignedTo,
          priority: 'SUPER_URGENT' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('EmailTemplate Model', () => {
    it('should create a valid email template with variables', async () => {
      const brokerageId = new Types.ObjectId();
      const template = await EmailTemplate.create({
        brokerageId,
        name: 'Welcome Email',
        slug: 'welcome-email',
        subject: 'Welcome to {{brokerageName}}',
        body: '<p>Hi {{clientName}}, welcome!</p>',
        variables: ['brokerageName', 'clientName'],
      });

      expect(template._id).toBeDefined();
      expect(template.variables).toHaveLength(2);
      expect(template.isActive).toBe(true);
    });

    it('should enforce unique slug per brokerage', async () => {
      const brokerageId = new Types.ObjectId();

      await EmailTemplate.create({
        brokerageId,
        name: 'First Template',
        slug: 'lead-intro',
        subject: 'Intro',
        body: 'Body text',
      });

      await expect(
        EmailTemplate.create({
          brokerageId,
          name: 'Second Template',
          slug: 'lead-intro',
          subject: 'Another Intro',
          body: 'Different body',
        })
      ).rejects.toThrow(/E11000/);
    });
  });

  describe('PipelineTrigger Model', () => {
    it('should create a valid pipeline trigger with actionConfig', async () => {
      const brokerageId = new Types.ObjectId();
      const trigger = await PipelineTrigger.create({
        brokerageId,
        name: 'Send Welcome on Qualified',
        fromStage: 'CONTACTED',
        toStage: 'QUALIFIED',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          recipientType: 'LEAD',
        },
      });

      expect(trigger._id).toBeDefined();
      expect(trigger.toStage).toBe('QUALIFIED');
      expect(trigger.actionType).toBe('SEND_EMAIL');
      expect(trigger.isActive).toBe(true);
    });

    it('should reject invalid actionType enum', async () => {
      const brokerageId = new Types.ObjectId();

      await expect(
        PipelineTrigger.create({
          brokerageId,
          name: 'Invalid Action',
          toStage: 'WON',
          actionType: 'FLY_TO_MOON' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('Seed Fixture Verification (Prompt 3)', () => {
    it('should successfully generate minimal seed dataset with all 4 user roles and entities', async () => {
      const seed = await createMinimalSeedData();

      expect(seed.platformAdmin.role).toBe('PLATFORM_ADMIN');
      expect(seed.platformAdmin.brokerageId).toBeNull();

      expect(seed.brokerageAdmin.role).toBe('BROKERAGE_ADMIN');
      expect(seed.brokerageAdmin.brokerageId).toEqual(seed.brokerageA._id);

      expect(seed.advisor.role).toBe('ADVISOR');
      expect(seed.advisor.brokerageId).toEqual(seed.brokerageA._id);

      expect(seed.clientUser.role).toBe('CLIENT');
      expect(seed.clientUser.brokerageId).toEqual(seed.brokerageA._id);

      expect(seed.client.userId).toEqual(seed.clientUser._id);
      expect(seed.document.type).toBe('PAYSLIP');
      expect(seed.task.assignedTo).toEqual(seed.advisor._id);
      expect(seed.lead.assignedTo).toEqual(seed.advisor._id);
    });
  });
});
