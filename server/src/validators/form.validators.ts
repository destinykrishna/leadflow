import { z } from 'zod';
import {
  FORM_STATUSES,
  FORM_FIELD_TYPES,
  type FormStatus,
  type FormFieldType,
} from '../models/form.model.js';
import { objectIdSchema } from './common.validators.js';

export const formStatusEnum = z.enum(FORM_STATUSES);
export const formFieldTypeEnum = z.enum(FORM_FIELD_TYPES);

/**
 * Individual form field schema with bounded lengths and options.
 */
export const formFieldValidator = z.object({
  fieldKey: z
    .string()
    .trim()
    .min(1, 'fieldKey is required')
    .max(50, 'fieldKey cannot exceed 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'fieldKey may only contain alphanumeric characters, underscores, and hyphens'
    ),
  label: z
    .string()
    .trim()
    .min(1, 'label is required')
    .max(100, 'label cannot exceed 100 characters'),
  type: formFieldTypeEnum.default('text'),
  required: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  placeholder: z.string().trim().max(100).optional(),
  helpText: z.string().trim().max(200).optional(),
  options: z
    .array(z.string().trim().min(1).max(100))
    .max(50, 'Cannot exceed 50 options per select field')
    .optional(),
});

export type FormFieldInput = z.infer<typeof formFieldValidator>;

/**
 * Helper to ensure fieldKey values are unique within a form.
 */
function hasUniqueFieldKeys(fields: FormFieldInput[]): boolean {
  const keys = new Set<string>();
  for (const field of fields) {
    const lower = field.fieldKey.toLowerCase();
    if (keys.has(lower)) {
      return false;
    }
    keys.add(lower);
  }
  return true;
}

/**
 * Schema for creating a new form.
 */
export const createFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(100, 'Title cannot exceed 100 characters'),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Slug is required')
      .max(100, 'Slug cannot exceed 100 characters')
      .regex(
        /^[a-z0-9-]+$/,
        'Slug must be lowercase alphanumeric and may contain hyphens'
      ),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .optional(),
    status: formStatusEnum.default('DRAFT'),
    fields: z
      .array(formFieldValidator)
      .max(30, 'Forms cannot exceed 30 fields')
      .default([]),
    submitButtonText: z
      .string()
      .trim()
      .max(50, 'Submit button text cannot exceed 50 characters')
      .default('Submit'),
    successMessage: z
      .string()
      .trim()
      .max(200, 'Success message cannot exceed 200 characters')
      .default('Thank you for your submission.'),
  })
  .refine((data) => hasUniqueFieldKeys(data.fields), {
    message: 'Field keys within a form must be unique',
    path: ['fields'],
  });

export type CreateFormInput = z.infer<typeof createFormSchema>;

/**
 * Schema for updating an existing form.
 */
export const updateFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .max(100, 'Title cannot exceed 100 characters')
      .optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Slug cannot be empty')
      .max(100, 'Slug cannot exceed 100 characters')
      .regex(
        /^[a-z0-9-]+$/,
        'Slug must be lowercase alphanumeric and may contain hyphens'
      )
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .optional(),
    status: formStatusEnum.optional(),
    fields: z
      .array(formFieldValidator)
      .max(30, 'Forms cannot exceed 30 fields')
      .optional(),
    submitButtonText: z
      .string()
      .trim()
      .max(50, 'Submit button text cannot exceed 50 characters')
      .optional(),
    successMessage: z
      .string()
      .trim()
      .max(200, 'Success message cannot exceed 200 characters')
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be provided for update'
  )
  .refine(
    (data) => (data.fields ? hasUniqueFieldKeys(data.fields) : true),
    {
      message: 'Field keys within a form must be unique',
      path: ['fields'],
    }
  );

export type UpdateFormInput = z.infer<typeof updateFormSchema>;

/**
 * Route parameter validation for form ID.
 */
export const formIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Query schema for listing forms.
 */
export const formQuerySchema = z.object({
  status: formStatusEnum.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'updatedAt', 'title', 'submissionCount']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type FormQuery = z.infer<typeof formQuerySchema>;

/**
 * Public form submission payload schema with strict bounds against payload bloat.
 */
export const publicFormSubmissionSchema = z.object({
  // Key-value responses mapped to form fieldKey
  responses: z
    .record(
      z.string().max(50),
      z.union([
        z.string().max(5000),
        z.number().finite(),
        z.boolean(),
        z.null(),
      ])
    )
    .refine(
      (responses) => Object.keys(responses).length <= 40,
      'Submission cannot contain more than 40 response keys'
    ),
  // Silent bot honeypot fields
  _hp: z.string().optional(),
  hp_website: z.string().optional(),
});

export type PublicFormSubmissionInput = z.infer<typeof publicFormSubmissionSchema>;
