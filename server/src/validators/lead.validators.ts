import { z } from 'zod';
import { Types } from 'mongoose';
import { LEAD_SOURCES, LEAD_STATUSES, type LeadSource, type LeadStatus } from '../models/lead.model.js';
import { ValidationError } from '../utils/errors.js';
import { objectIdSchema } from './common.validators.js';

export const leadSourceEnum = z.enum(LEAD_SOURCES);
export const leadStatusEnum = z.enum(LEAD_STATUSES);

/**
 * Valid stage transitions for LeadFlow sales pipeline:
 * NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON / LOST
 *
 * Terminal stages: WON and LOST permit no transitions.
 * Active stages can advance to the next linear stage or transition to LOST.
 * Backward transitions and stage skipping are strictly forbidden.
 */
export const VALID_STAGE_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['NEGOTIATION', 'LOST'],
  NEGOTIATION: ['WON', 'LOST'],
  WON: [],
  LOST: [],
} as const;

/**
 * Returns true if moving from currentStatus to nextStatus is a valid stage transition.
 */
export function isValidStageTransition(
  currentStatus: LeadStatus,
  nextStatus: LeadStatus
): boolean {
  if (currentStatus === nextStatus) return false;
  const allowed = VALID_STAGE_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

/**
 * Schema for updating a lead's stage.
 * Accepts 'stage' or 'status' for ergonomics, with optional optimistic concurrency version.
 */
export const updateLeadStageSchema = z
  .object({
    stage: leadStatusEnum.optional(),
    status: leadStatusEnum.optional(),
    version: z
      .number()
      .int('Version must be an integer')
      .min(0, 'Version cannot be negative')
      .optional(),
  })
  .refine((data) => data.stage !== undefined || data.status !== undefined, {
    message: "Either 'stage' or 'status' must be provided",
    path: ['stage'],
  });

export type UpdateLeadStageInput = z.infer<typeof updateLeadStageSchema>;

/**
 * Schema validating lead ID URL route parameters.
 */
export const leadIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Schema for querying and filtering pipeline leads.
 */
export const pipelineQuerySchema = z.object({
  stage: leadStatusEnum.optional(),
  status: leadStatusEnum.optional(),
  groupBy: z.enum(['stage', 'status']).optional(),
  assignedTo: z
    .string()
    .trim()
    .refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid assignedTo ObjectId format',
    })
    .optional(),
  brokerageId: z
    .string()
    .trim()
    .refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid brokerageId ObjectId format',
    })
    .optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(['createdAt', 'updatedAt', 'score', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PipelineQuery = z.infer<typeof pipelineQuerySchema>;

/**
 * Standard LeadFlow Webhook Payload Schema.
 * Strips client-supplied brokerageId so client input cannot dictate tenant assignment.
 */
export const standardLeadPayloadSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name cannot be empty')
    .max(60, 'First name cannot exceed 60 characters'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name cannot be empty')
    .max(60, 'Last name cannot exceed 60 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .max(255, 'Email cannot exceed 255 characters'),
  phone: z
    .string()
    .trim()
    .max(30, 'Phone number cannot exceed 30 characters')
    .optional(),
  source: leadSourceEnum.default('WEBSITE'),
  score: z
    .number()
    .min(0, 'Score must be at least 0')
    .max(100, 'Score cannot exceed 100')
    .default(0),
  notes: z
    .string()
    .trim()
    .max(5000, 'Notes cannot exceed 5000 characters')
    .optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  brokerageId: z.unknown().optional(), // Allowed in raw input but explicitly stripped/ignored
});

export type StandardLeadPayload = z.infer<typeof standardLeadPayloadSchema>;

/**
 * Documented External Provider: Typeform Webhook Schema
 */
export const typeformAnswerSchema = z.object({
  field: z.object({
    id: z.string(),
    type: z.string(),
    ref: z.string().optional(),
  }),
  type: z.string(),
  text: z.string().optional(),
  email: z.string().optional(),
  phone_number: z.string().optional(),
  number: z.number().optional(),
  boolean: z.boolean().optional(),
  choice: z.object({ label: z.string() }).optional(),
  choices: z.object({ labels: z.array(z.string()) }).optional(),
});

export const typeformWebhookSchema = z.object({
  event_id: z.string().optional(),
  event_type: z.string().optional(),
  form_response: z.object({
    form_id: z.string().optional(),
    submitted_at: z.string().optional(),
    definition: z
      .object({
        id: z.string().optional(),
        title: z.string().optional(),
        fields: z
          .array(
            z.object({
              id: z.string(),
              ref: z.string().optional(),
              type: z.string().optional(),
              title: z.string().optional(),
            })
          )
          .optional(),
      })
      .optional(),
    answers: z.array(typeformAnswerSchema).min(1, 'Typeform answers cannot be empty'),
    hidden: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type TypeformWebhookPayload = z.infer<typeof typeformWebhookSchema>;

export interface NormalizedLeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | undefined;
  source: LeadSource;
  score: number;
  notes?: string | undefined;
  customFields?: Record<string, unknown> | undefined;
}

/**
 * Normalizes incoming lead payloads across standard webhooks and external providers (Typeform).
 * Throws structured ValidationError if payload is invalid.
 */
export function normalizeIncomingLeadPayload(payload: unknown): NormalizedLeadData {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Webhook payload must be a non-empty JSON object');
  }

  // 1. Detect and parse Typeform webhook payload
  if ('form_response' in payload && typeof (payload as any).form_response === 'object') {
    const typeformParsed = typeformWebhookSchema.safeParse(payload);
    if (!typeformParsed.success) {
      throw new ValidationError('Invalid Typeform webhook payload', typeformParsed.error.format());
    }

    const { form_response, event_id } = typeformParsed.data;
    const answers = form_response.answers;

    // Build lookup map from field definition if provided by Typeform
    const definitionMap = new Map<string, { title?: string | undefined; ref?: string | undefined }>();
    if (form_response.definition?.fields) {
      for (const f of form_response.definition.fields) {
        definitionMap.set(f.id, { title: f.title, ref: f.ref });
      }
    }

    const getFieldInfo = (field: { id: string; ref?: string | undefined }) => {
      const def = definitionMap.get(field.id);
      const title = (def?.title || '').toLowerCase();
      const id = field.id.toLowerCase();
      const ref = (field.ref || def?.ref || '').toLowerCase();
      return { title, id, ref };
    };

    // Extract email
    const emailAnswer = answers.find((a) => {
      const { title, id, ref } = getFieldInfo(a.field);
      return (
        a.type === 'email' ||
        a.field.type === 'email' ||
        id.includes('email') ||
        ref.includes('email') ||
        title.includes('email')
      );
    });
    const email = emailAnswer?.email || emailAnswer?.text;
    if (!email) {
      throw new ValidationError('Typeform payload missing required email answer');
    }

    // Extract names
    const firstNameAnswer = answers.find((a) => {
      const { title, id, ref } = getFieldInfo(a.field);
      return id.includes('first') || ref.includes('first') || title.includes('first');
    });
    const lastNameAnswer = answers.find((a) => {
      const { title, id, ref } = getFieldInfo(a.field);
      return id.includes('last') || ref.includes('last') || title.includes('last');
    });
    const fullNameAnswer = answers.find((a) => {
      const { title, id, ref } = getFieldInfo(a.field);
      return (
        id.includes('name') ||
        ref.includes('name') ||
        title.includes('name') ||
        (a.type === 'text' && !title.includes('city') && !title.includes('comment'))
      );
    });

    let firstName = firstNameAnswer?.text?.trim() || '';
    let lastName = lastNameAnswer?.text?.trim() || '';

    if (!firstName && !lastName && fullNameAnswer?.text) {
      const parts = fullNameAnswer.text.trim().split(/\s+/);
      firstName = parts[0] || 'Unknown';
      lastName = parts.slice(1).join(' ') || 'Applicant';
    } else {
      if (!firstName) firstName = fullNameAnswer?.text?.trim() || 'Unknown';
      if (!lastName) lastName = 'Applicant';
    }

    // Extract phone
    const phoneAnswer = answers.find((a) => {
      const { title, id, ref } = getFieldInfo(a.field);
      return (
        a.type === 'phone_number' ||
        a.field.type === 'phone_number' ||
        id.includes('phone') ||
        ref.includes('phone') ||
        title.includes('phone')
      );
    });
    const phone = phoneAnswer?.phone_number || phoneAnswer?.text;

    // Collect customFields with intelligent semantic mapping for mortgage fields
    const customFields: Record<string, unknown> = {
      provider: 'TYPEFORM',
      eventId: event_id,
      formId: form_response.form_id,
      submittedAt: form_response.submitted_at,
    };

    for (const answer of answers) {
      const { title, id, ref } = getFieldInfo(answer.field);
      let key = answer.field.ref || answer.field.id;

      // Map common mortgage questionnaire questions to standard LeadFlow customField keys
      if (title.includes('loan amount') || title.includes('target home loan') || ref.includes('loan')) {
        key = 'loanAmount';
      } else if (title.includes('property value') || title.includes('valuation') || ref.includes('property')) {
        key = 'propertyValue';
      } else if (title.includes('monthly income') || title.includes('gross monthly') || ref.includes('income')) {
        key = 'monthlyGrossIncome';
      } else if (title.includes('down payment') || ref.includes('downpayment')) {
        key = 'downPayment';
      } else if (title.includes('city') || ref.includes('city')) {
        key = 'propertyCity';
      }

      const value =
        answer.number ??
        answer.text ??
        answer.email ??
        answer.phone_number ??
        answer.boolean ??
        answer.choice?.label ??
        answer.choices?.labels;

      if (value !== undefined) {
        customFields[key] = value;
        // Dual-populate monthlyGrossIncome and monthlyIncome for universal UI compatibility
        if (key === 'monthlyGrossIncome' || key === 'monthlyIncome') {
          customFields.monthlyGrossIncome = value;
          customFields.monthlyIncome = value;
        }
      }
    }

    if (form_response.hidden) {
      customFields.hidden = form_response.hidden;
      if (typeof form_response.hidden.utm_source === 'string') {
        customFields.utm_source = form_response.hidden.utm_source;
      }
      if (typeof form_response.hidden.utm_medium === 'string') {
        customFields.utm_medium = form_response.hidden.utm_medium;
      }
      if (typeof form_response.hidden.utm_campaign === 'string') {
        customFields.utm_campaign = form_response.hidden.utm_campaign;
      }
    }

    // Map source and build descriptive notes
    let source: LeadSource = 'WEBSITE';
    const utmSource = typeof form_response.hidden?.utm_source === 'string'
      ? (form_response.hidden.utm_source as string).trim()
      : undefined;
    const utmCampaign = typeof form_response.hidden?.utm_campaign === 'string'
      ? (form_response.hidden.utm_campaign as string).trim()
      : undefined;

    if (utmSource) {
      const upper = utmSource.toUpperCase();
      if (LEAD_SOURCES.includes(upper as LeadSource)) {
        source = upper as LeadSource;
      } else if (upper.includes('WHATSAPP') || upper.includes('REFERRAL') || upper.includes('FRIEND')) {
        source = 'REFERRAL';
      } else {
        source = 'CAMPAIGN';
      }
    }

    let notes = `Ingested from Typeform (Form ID: ${form_response.form_id || 'unknown'})`;
    if (utmSource) {
      notes += ` • Channel: ${utmSource}`;
    }
    if (utmCampaign) {
      notes += ` • Campaign: ${utmCampaign}`;
    }

    // Calculate smart lead qualification score (0-100)
    let score = 10; // Baseline for completed form
    if (email && email.includes('@')) score += 20;
    if (phone && phone.trim().length >= 8) score += 20;
    const loanAmt = Number(customFields.loanAmount) || 0;
    if (loanAmt > 0) score += 20;
    const grossIncome = Number(customFields.monthlyGrossIncome || customFields.monthlyIncome) || 0;
    if (grossIncome > 0) score += 15;
    const propVal = Number(customFields.propertyValue) || 0;
    if (propVal > 0) score += 15;
    score = Math.min(100, Math.max(0, score));

    // Re-validate using standard constraints
    const validated = standardLeadPayloadSchema.safeParse({
      firstName,
      lastName,
      email,
      phone,
      source,
      score,
      notes,
      customFields,
    });

    if (!validated.success) {
      throw new ValidationError('Normalized Typeform data failed validation', validated.error.format());
    }

    return {
      firstName: validated.data.firstName,
      lastName: validated.data.lastName,
      email: validated.data.email,
      phone: validated.data.phone,
      source: validated.data.source,
      score: validated.data.score,
      notes: validated.data.notes,
      customFields: validated.data.customFields,
    };
  }

  // 2. Standard LeadFlow Webhook Payload
  const parsed = standardLeadPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid lead payload', parsed.error.format());
  }

  // Note: brokerageId is explicitly omitted from returned normalized data
  return {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    source: parsed.data.source,
    score: parsed.data.score,
    notes: parsed.data.notes,
    customFields: parsed.data.customFields,
  };
}
