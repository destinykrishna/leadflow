import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { Form, Brokerage, Lead } from '../../src/models/index.js';
import { formService } from '../../src/services/form.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/utils/errors.js';
import type { AuthUserContext } from '../../src/middleware/auth.middleware.js';

describe('FormService Unit Tests', () => {
  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let adminContextA: AuthUserContext;
  let adminContextB: AuthUserContext;

  beforeEach(async () => {
    await Form.deleteMany({});
    await Lead.deleteMany({});
    await Brokerage.deleteMany({});

    brokerageA = await Brokerage.create({
      name: 'Alpha Mortgages Berlin',
      slug: 'alpha-berlin',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Beta Loans Munich',
      slug: 'beta-munich',
      plan: 'STARTER',
      status: 'ACTIVE',
    });

    adminContextA = {
      id: new Types.ObjectId().toString(),
      email: 'admin@alpha-berlin.de',
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
      brokerageId: brokerageA._id.toString(),
      name: 'Alpha Admin',
    };

    adminContextB = {
      id: new Types.ObjectId().toString(),
      email: 'admin@beta-munich.de',
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
      brokerageId: brokerageB._id.toString(),
      name: 'Beta Admin',
    };
  });

  describe('Form Administration & Lifecycle', () => {
    it('creates a new form with default DRAFT status and tenant scoping', async () => {
      const form = await formService.createForm(adminContextA, {
        title: 'Mortgage Pre-Approval',
        slug: 'pre-approval',
        description: 'Initial intake questionnaire',
        status: 'DRAFT',
        fields: [
          { fieldKey: 'firstName', label: 'First Name', type: 'text', required: true, order: 0 },
          { fieldKey: 'email', label: 'Email Address', type: 'email', required: true, order: 1 },
          { fieldKey: 'loanAmount', label: 'Target Loan', type: 'number', required: false, order: 2 },
        ],
        submitButtonText: 'Apply Now',
        successMessage: 'Application received!',
      });

      expect(form).toBeDefined();
      expect(form.title).toBe('Mortgage Pre-Approval');
      expect(form.slug).toBe('pre-approval');
      expect(form.status).toBe('DRAFT');
      expect(form.brokerageId.toString()).toBe(brokerageA._id.toString());
      expect(form.fields).toHaveLength(3);
      expect(form.submissionCount).toBe(0);
    });

    it('rejects duplicate slugs within the same brokerage with ConflictError', async () => {
      await formService.createForm(adminContextA, {
        title: 'Form 1',
        slug: 'intake',
        status: 'DRAFT',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      await expect(
        formService.createForm(adminContextA, {
          title: 'Form 2',
          slug: 'intake',
          status: 'DRAFT',
          fields: [],
          submitButtonText: 'Submit',
          successMessage: 'Done',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('permits identical slugs across different brokerages without collision', async () => {
      const formA = await formService.createForm(adminContextA, {
        title: 'Brokerage A Intake',
        slug: 'intake',
        status: 'DRAFT',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      const formB = await formService.createForm(adminContextB, {
        title: 'Brokerage B Intake',
        slug: 'intake',
        status: 'DRAFT',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      expect(formA.slug).toBe('intake');
      expect(formB.slug).toBe('intake');
      expect(formA.brokerageId.toString()).not.toBe(formB.brokerageId.toString());
    });

    it('enforces anti-IDOR protection when fetching by ID across tenants', async () => {
      const formA = await formService.createForm(adminContextA, {
        title: 'Private Form A',
        slug: 'private-a',
        status: 'DRAFT',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      // Brokerage B admin querying formA returns NotFoundError
      await expect(
        formService.getFormById(adminContextB, formA._id.toString())
      ).rejects.toThrow(NotFoundError);
    });

    it('updates form configuration and status to PUBLISHED or ARCHIVED', async () => {
      const form = await formService.createForm(adminContextA, {
        title: 'Draft Form',
        slug: 'draft-form',
        status: 'DRAFT',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      const updated = await formService.updateForm(adminContextA, form._id.toString(), {
        title: 'Published Form',
        status: 'PUBLISHED',
      });

      expect(updated.title).toBe('Published Form');
      expect(updated.status).toBe('PUBLISHED');

      const archived = await formService.archiveForm(adminContextA, form._id.toString());
      expect(archived.status).toBe('ARCHIVED');
    });
  });

  describe('Public Form Resolution (Anti-Enumeration & Concealment)', () => {
    it('returns public view for PUBLISHED form using brokerage slug or ID', async () => {
      await formService.createForm(adminContextA, {
        title: 'Public Questionnaire',
        slug: 'questionnaire',
        status: 'PUBLISHED',
        fields: [
          { fieldKey: 'email', label: 'Email', type: 'email', required: true, order: 1 },
          { fieldKey: 'firstName', label: 'First Name', type: 'text', required: true, order: 0 },
        ],
        submitButtonText: 'Send Request',
        successMessage: 'Thank you!',
      });

      // Lookup by brokerage slug
      const bySlug = await formService.resolvePublicForm('alpha-berlin', 'questionnaire');
      expect(bySlug.publicView.title).toBe('Public Questionnaire');
      expect(bySlug.publicView.fields[0]?.fieldKey).toBe('firstName'); // ordered
      expect(bySlug.publicView.fields[1]?.fieldKey).toBe('email');

      // Lookup by brokerage ObjectId
      const byId = await formService.resolvePublicForm(brokerageA._id.toString(), 'questionnaire');
      expect(byId.publicView.title).toBe('Public Questionnaire');
    });

    it('conceals DRAFT forms with NotFoundError (404)', async () => {
      await formService.createForm(adminContextA, {
        title: 'Draft Intake',
        slug: 'draft-intake',
        status: 'DRAFT',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      await expect(
        formService.resolvePublicForm('alpha-berlin', 'draft-intake')
      ).rejects.toThrow(NotFoundError);
    });

    it('conceals ARCHIVED forms with NotFoundError (404)', async () => {
      await formService.createForm(adminContextA, {
        title: 'Archived Intake',
        slug: 'archived-intake',
        status: 'ARCHIVED',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      await expect(
        formService.resolvePublicForm('alpha-berlin', 'archived-intake')
      ).rejects.toThrow(NotFoundError);
    });

    it('conceals forms belonging to SUSPENDED brokerages with NotFoundError (404)', async () => {
      await Brokerage.findByIdAndUpdate(brokerageA._id, { status: 'SUSPENDED' });

      await formService.createForm(adminContextA, {
        title: 'Suspended Tenant Form',
        slug: 'tenant-form',
        status: 'PUBLISHED',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      await expect(
        formService.resolvePublicForm('alpha-berlin', 'tenant-form')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Public Submission & Lead Ingestion Flow', () => {
    beforeEach(async () => {
      await formService.createForm(adminContextA, {
        title: 'Home Loan Application',
        slug: 'apply',
        status: 'PUBLISHED',
        fields: [
          { fieldKey: 'firstName', label: 'First Name', type: 'text', required: true, order: 0 },
          { fieldKey: 'lastName', label: 'Last Name', type: 'text', required: false, order: 1 },
          { fieldKey: 'email', label: 'Email Address', type: 'email', required: true, order: 2 },
          { fieldKey: 'phone', label: 'Phone', type: 'phone', required: false, order: 3 },
          { fieldKey: 'loanAmount', label: 'Requested Loan', type: 'number', required: false, order: 4 },
        ],
        submitButtonText: 'Apply',
        successMessage: 'Your application has been received.',
      });
    });

    it('drops honeypot submissions silently without database writes', async () => {
      const result = await formService.submitPublicForm('alpha-berlin', 'apply', {
        responses: {
          firstName: 'SpamBot',
          email: 'bot@spam.com',
        },
        _hp: 'gotcha-bot',
      });

      expect(result.success).toBe(true);

      const leads = await Lead.find({ brokerageId: brokerageA._id });
      expect(leads).toHaveLength(0);
    });

    it('validates required fields and throws ValidationError if missing', async () => {
      await expect(
        formService.submitPublicForm('alpha-berlin', 'apply', {
          responses: {
            email: 'test@example.com',
            // firstName is missing
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects disposable email addresses with ValidationError', async () => {
      await expect(
        formService.submitPublicForm('alpha-berlin', 'apply', {
          responses: {
            firstName: 'Temp',
            email: 'tempuser@mailinator.com',
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('converts valid submission to Lead and increments form submissionCount', async () => {
      const result = await formService.submitPublicForm('alpha-berlin', 'apply', {
        responses: {
          firstName: 'Hans',
          lastName: 'Gruber',
          email: 'hans.gruber@example.de',
          phone: '+491512345678',
          loanAmount: 450000,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Your application has been received.');

      // Verify Lead was created in DB via leadIngestionService
      const lead = await Lead.findOne({
        brokerageId: brokerageA._id,
        email: 'hans.gruber@example.de',
      });

      expect(lead).toBeDefined();
      expect(lead?.firstName).toBe('Hans');
      expect(lead?.lastName).toBe('Gruber');
      expect(lead?.status).toBe('NEW');
      expect(lead?.source).toBe('WEBSITE');
      const custom = lead?.customFields as any;
      const getCustomVal = (key: string) => (typeof custom?.get === 'function' ? custom.get(key) : custom?.[key]);
      expect(getCustomVal('loanAmount')).toBe(450000);
      expect(getCustomVal('formSlug')).toBe('apply');

      // Verify form submission count incremented
      const updatedForm = await Form.findOne({ brokerageId: brokerageA._id, slug: 'apply' });
      expect(updatedForm?.submissionCount).toBe(1);
    });
  });
});
