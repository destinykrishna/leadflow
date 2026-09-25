import { z } from 'zod';
import { LEAD_SOURCES, type LeadSource } from '../models/lead.model.js';
import { ValidationError } from '../utils/errors.js';

export const leadSourceEnum = z.enum(LEAD_SOURCES);

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

    // Extract email
    const emailAnswer = answers.find(
      (a) =>
        a.type === 'email' ||
        a.field.type === 'email' ||
        a.field.id.toLowerCase().includes('email') ||
        a.field.ref?.toLowerCase().includes('email')
    );
    const email = emailAnswer?.email || emailAnswer?.text;
    if (!email) {
      throw new ValidationError('Typeform payload missing required email answer');
    }

    // Extract names
    const firstNameAnswer = answers.find(
      (a) =>
        a.field.id.toLowerCase().includes('first') ||
        a.field.ref?.toLowerCase().includes('first')
    );
    const lastNameAnswer = answers.find(
      (a) =>
        a.field.id.toLowerCase().includes('last') ||
        a.field.ref?.toLowerCase().includes('last')
    );
    const fullNameAnswer = answers.find(
      (a) =>
        a.field.id.toLowerCase().includes('name') ||
        a.field.ref?.toLowerCase().includes('name')
    );

    let firstName = firstNameAnswer?.text?.trim() || '';
    let lastName = lastNameAnswer?.text?.trim() || '';

    if (!firstName && !lastName && fullNameAnswer?.text) {
      const parts = fullNameAnswer.text.trim().split(/\s+/);
      firstName = parts[0] || 'Unknown';
      lastName = parts.slice(1).join(' ') || 'Lead';
    } else {
      if (!firstName) firstName = fullNameAnswer?.text?.trim() || 'Unknown';
      if (!lastName) lastName = 'Lead';
    }

    // Extract phone
    const phoneAnswer = answers.find(
      (a) =>
        a.type === 'phone_number' ||
        a.field.type === 'phone_number' ||
        a.field.id.toLowerCase().includes('phone') ||
        a.field.ref?.toLowerCase().includes('phone')
    );
    const phone = phoneAnswer?.phone_number || phoneAnswer?.text;

    // Collect customFields
    const customFields: Record<string, unknown> = {
      provider: 'TYPEFORM',
      eventId: event_id,
      formId: form_response.form_id,
      submittedAt: form_response.submitted_at,
    };

    for (const answer of answers) {
      const key = answer.field.ref || answer.field.id;
      const value =
        answer.text ??
        answer.email ??
        answer.phone_number ??
        answer.number ??
        answer.boolean ??
        answer.choice?.label ??
        answer.choices?.labels;
      if (value !== undefined) {
        customFields[key] = value;
      }
    }

    if (form_response.hidden) {
      customFields.hidden = form_response.hidden;
    }

    // Map source
    let source: LeadSource = 'WEBSITE';
    if (form_response.hidden && typeof form_response.hidden.utm_source === 'string') {
      const utm = form_response.hidden.utm_source.toUpperCase();
      if (LEAD_SOURCES.includes(utm as LeadSource)) {
        source = utm as LeadSource;
      } else {
        source = 'CAMPAIGN';
      }
    }

    // Re-validate using standard constraints
    const validated = standardLeadPayloadSchema.safeParse({
      firstName,
      lastName,
      email,
      phone,
      source,
      score: 0,
      notes: `Ingested from Typeform (Form ID: ${form_response.form_id || 'unknown'})`,
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
