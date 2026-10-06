import { Types } from 'mongoose';
import { Brokerage } from '../models/brokerage.model.js';
import { Form, type IFormDocument } from '../models/form.model.js';
import { formRepository } from '../repositories/form.repository.js';
import { leadIngestionService } from './lead-ingestion.service.js';
import { isDisposableEmail } from '../validators/lead.validators.js';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  BrokerageIsolationError,
} from '../utils/errors.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import type {
  CreateFormInput,
  UpdateFormInput,
  FormQuery,
  PublicFormSubmissionInput,
} from '../validators/form.validators.js';

export interface PublicFormView {
  id: string;
  brokerageId: string;
  brokerageName: string;
  title: string;
  slug: string;
  description?: string;
  fields: Array<{
    fieldKey: string;
    label: string;
    type: string;
    required: boolean;
    order: number;
    placeholder?: string;
    helpText?: string;
    options?: string[];
  }>;
  submitButtonText: string;
}

export interface PublicSubmissionResult {
  success: boolean;
  message: string;
}

export class FormService {
  /**
   * Creates a new brokerage-owned form.
   */
  async createForm(
    userContext: AuthUserContext,
    input: CreateFormInput
  ): Promise<IFormDocument> {
    const targetBrokerageId =
      userContext.role === 'PLATFORM_ADMIN'
        ? userContext.brokerageId
        : userContext.brokerageId;

    if (!targetBrokerageId) {
      throw new BrokerageIsolationError('Brokerage context missing for form creation');
    }

    const brokerageObjectId = new Types.ObjectId(targetBrokerageId);

    // Verify slug uniqueness within the brokerage
    const existing = await formRepository.findBySlug(brokerageObjectId, input.slug);
    if (existing) {
      throw new ConflictError(
        `A form with slug '${input.slug}' already exists for this brokerage`
      );
    }

    return formRepository.create(userContext, {
      ...input,
      brokerageId: brokerageObjectId,
      submissionCount: 0,
    });
  }

  /**
   * Retrieves a form by ID with anti-IDOR tenant boundary enforcement.
   */
  async getFormById(
    userContext: AuthUserContext,
    id: string
  ): Promise<IFormDocument> {
    const form = await formRepository.findById(userContext, id);
    if (!form) {
      throw new NotFoundError('Form not found');
    }
    return form;
  }

  /**
   * Lists forms for the authenticated brokerage.
   */
  async listForms(
    userContext: AuthUserContext,
    query: FormQuery
  ): Promise<{
    forms: IFormDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return formRepository.listForms(userContext, query);
  }

  /**
   * Updates an existing form configuration, lifecycle status, or fields.
   */
  async updateForm(
    userContext: AuthUserContext,
    id: string,
    input: UpdateFormInput
  ): Promise<IFormDocument> {
    const form = await this.getFormById(userContext, id);

    // If slug is changing, verify no collision within this brokerage
    if (input.slug && input.slug !== form.slug) {
      const existing = await formRepository.findBySlug(form.brokerageId, input.slug);
      if (existing && existing._id.toString() !== form._id.toString()) {
        throw new ConflictError(
          `A form with slug '${input.slug}' already exists for this brokerage`
        );
      }
    }

    const updatePayload: Record<string, unknown> = { ...input };

    const updated = await Form.findOneAndUpdate(
      { _id: form._id, brokerageId: form.brokerageId },
      { $set: updatePayload },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new NotFoundError('Form not found');
    }

    return updated;
  }

  /**
   * Archives a form (lifecycle transition to ARCHIVED).
   */
  async archiveForm(
    userContext: AuthUserContext,
    id: string
  ): Promise<IFormDocument> {
    return this.updateForm(userContext, id, { status: 'ARCHIVED' });
  }

  /**
   * Resolves a public, published form by brokerage identifier and form slug.
   * Conceals DRAFT/ARCHIVED forms and suspended brokerages with a uniform 404.
   */
  async resolvePublicForm(
    brokerageIdentifier: string,
    formSlug: string
  ): Promise<{ form: IFormDocument; brokerage: any; publicView: PublicFormView }> {
    const cleanSlug = formSlug.toLowerCase().trim();

    // 1. Resolve brokerage by slug or ObjectId
    let brokerage: any = null;
    if (Types.ObjectId.isValid(brokerageIdentifier)) {
      brokerage = await Brokerage.findById(new Types.ObjectId(brokerageIdentifier));
    }

    if (!brokerage) {
      brokerage = await Brokerage.findOne({
        slug: brokerageIdentifier.toLowerCase().trim(),
      });
    }

    // Conceal non-existent or suspended brokerages
    if (!brokerage || brokerage.status !== 'ACTIVE') {
      throw new NotFoundError('Form not found');
    }

    // 2. Resolve published form
    const form = await formRepository.findPublishedBySlug(brokerage._id, cleanSlug);

    // Conceal non-existent, DRAFT, or ARCHIVED forms
    if (!form || form.status !== 'PUBLISHED') {
      throw new NotFoundError('Form not found');
    }

    const sortedFields = [...form.fields].sort((a, b) => a.order - b.order);

    const publicView: PublicFormView = {
      id: form._id.toString(),
      brokerageId: brokerage._id.toString(),
      brokerageName: brokerage.name,
      title: form.title,
      slug: form.slug,
      ...(form.description ? { description: form.description } : {}),
      fields: sortedFields.map((f) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        type: f.type,
        required: f.required,
        order: f.order,
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        ...(f.helpText ? { helpText: f.helpText } : {}),
        ...(f.options ? { options: f.options } : {}),
      })),
      submitButtonText: form.submitButtonText || 'Submit',
    };

    return { form, brokerage, publicView };
  }

  /**
   * Processes a public form submission and converts it into a Lead inquiry.
   * Strictly pipes through existing leadIngestionService to reuse deduplication,
   * re-inquiry handling, client recognition, activity logs, realtime events, and stage automation.
   */
  async submitPublicForm(
    brokerageIdentifier: string,
    formSlug: string,
    input: PublicFormSubmissionInput
  ): Promise<PublicSubmissionResult> {
    // 1. Silent Honeypot Defense: drop bot spam silently
    if (input._hp || input.hp_website) {
      return {
        success: true,
        message: 'Thank you for your submission.',
      };
    }

    // 2. Resolve form and brokerage (404 if not found/draft/archived/suspended)
    const { form, brokerage } = await this.resolvePublicForm(
      brokerageIdentifier,
      formSlug
    );

    const responses = input.responses || {};

    // 3. Validate responses against the form's defined fields
    for (const field of form.fields) {
      const rawValue = responses[field.fieldKey];
      const hasValue =
        rawValue !== undefined &&
        rawValue !== null &&
        (typeof rawValue === 'string' ? rawValue.trim().length > 0 : true);

      if (field.required && !hasValue) {
        throw new ValidationError(`Field '${field.label}' is required`);
      }

      if (hasValue) {
        if (field.type === 'email') {
          const emailStr = String(rawValue).trim().toLowerCase();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailStr)) {
            throw new ValidationError(`Field '${field.label}' must be a valid email address`);
          }
          if (isDisposableEmail(emailStr)) {
            throw new ValidationError(
              'Disposable or temporary email addresses are not accepted for lead inquiries'
            );
          }
        } else if (field.type === 'number') {
          const num = Number(rawValue);
          if (isNaN(num) || !isFinite(num)) {
            throw new ValidationError(`Field '${field.label}' must be a valid number`);
          }
        } else if (field.type === 'select' && field.options && field.options.length > 0) {
          const strVal = String(rawValue).trim();
          if (!field.options.includes(strVal)) {
            throw new ValidationError(
              `Invalid option selected for field '${field.label}'`
            );
          }
        }
      }
    }

    // 4. Map dynamic responses into StandardLeadPayload
    // Locate email
    let email: string | undefined = undefined;
    const emailField = form.fields.find(
      (f) => f.type === 'email' || f.fieldKey.toLowerCase() === 'email'
    );
    if (emailField && responses[emailField.fieldKey]) {
      email = String(responses[emailField.fieldKey]).trim().toLowerCase();
    } else if (responses['email']) {
      email = String(responses['email']).trim().toLowerCase();
    }

    if (!email) {
      throw new ValidationError('An email address is required for lead submission');
    }

    // Locate names
    let firstName = 'Inquiry';
    let lastName = '';

    const firstNameField = form.fields.find(
      (f) => f.fieldKey.toLowerCase() === 'firstname' || f.fieldKey.toLowerCase() === 'first_name'
    );
    const lastNameField = form.fields.find(
      (f) => f.fieldKey.toLowerCase() === 'lastname' || f.fieldKey.toLowerCase() === 'last_name'
    );
    const fullNameField = form.fields.find(
      (f) => f.fieldKey.toLowerCase() === 'name' || f.fieldKey.toLowerCase() === 'fullname'
    );

    if (firstNameField && responses[firstNameField.fieldKey]) {
      firstName = String(responses[firstNameField.fieldKey]).trim().slice(0, 60);
    }
    if (lastNameField && responses[lastNameField.fieldKey]) {
      lastName = String(responses[lastNameField.fieldKey]).trim().slice(0, 60);
    }

    if (!firstNameField && fullNameField && responses[fullNameField.fieldKey]) {
      const full = String(responses[fullNameField.fieldKey]).trim();
      const parts = full.split(/\s+/);
      firstName = parts[0]?.slice(0, 60) || 'Inquiry';
      lastName = parts.slice(1).join(' ').slice(0, 60);
    }

    // Locate phone
    let phone: string | undefined = undefined;
    const phoneField = form.fields.find(
      (f) => f.type === 'phone' || f.fieldKey.toLowerCase() === 'phone'
    );
    if (phoneField && responses[phoneField.fieldKey]) {
      phone = String(responses[phoneField.fieldKey]).trim().slice(0, 30);
    } else if (responses['phone']) {
      phone = String(responses['phone']).trim().slice(0, 30);
    }

    // Locate notes
    let notes: string | undefined = undefined;
    const notesField = form.fields.find(
      (f) =>
        f.type === 'textarea' ||
        f.fieldKey.toLowerCase() === 'notes' ||
        f.fieldKey.toLowerCase() === 'message' ||
        f.fieldKey.toLowerCase() === 'comments'
    );
    if (notesField && responses[notesField.fieldKey]) {
      notes = String(responses[notesField.fieldKey]).trim().slice(0, 5000);
    } else if (responses['notes'] || responses['message']) {
      notes = String(responses['notes'] || responses['message']).trim().slice(0, 5000);
    }

    // Map custom fields and mortgage attributes
    const customFields: Record<string, unknown> = {
      formId: form._id.toString(),
      formSlug: form.slug,
      formTitle: form.title,
    };

    for (const [key, val] of Object.entries(responses)) {
      if (val === undefined || val === null) continue;

      // Extract recognized mortgage financial fields
      if (key === 'loanAmount' || key === 'loan_amount') {
        customFields.loanAmount = Number(val);
      } else if (key === 'propertyValue' || key === 'property_value') {
        customFields.propertyValue = Number(val);
      } else if (key === 'monthlyGrossIncome' || key === 'monthly_income' || key === 'monthlyIncome') {
        customFields.monthlyGrossIncome = Number(val);
        customFields.monthlyIncome = Number(val);
      } else if (key === 'downPayment' || key === 'down_payment') {
        customFields.downPayment = Number(val);
      } else if (
        key !== 'firstName' &&
        key !== 'first_name' &&
        key !== 'lastName' &&
        key !== 'last_name' &&
        key !== 'email' &&
        key !== 'phone' &&
        key !== 'notes' &&
        key !== 'message'
      ) {
        customFields[key] = val;
      }
    }

    const leadPayload = {
      firstName,
      lastName,
      email,
      phone,
      source: 'WEBSITE' as const,
      notes: notes ? `${notes}\n\n[Submitted via Form: ${form.title}]` : `[Submitted via Form: ${form.title}]`,
      customFields,
    };

    // 5. Pipe into existing lead ingestion service (orchestrates deduplication, stage triggers, activity logs, websocket broadcast)
    await leadIngestionService.processIngestion(brokerage._id, leadPayload);

    // 6. Increment form submission counter
    await formRepository.incrementSubmissionCount(brokerage._id, form._id);

    // 7. Return sanitized public response (zero internal lead details exposed)
    return {
      success: true,
      message: form.successMessage || 'Thank you for your submission.',
    };
  }
}

export const formService = new FormService();
