import { z } from 'zod'

/**
 * Standard formatted validation result for frontend form handling
 */
export type ValidationResult<T> =
  | { success: true; data: T; errors: Record<string, never> }
  | { success: false; data: null; errors: Record<string, string>; message: string }

/**
 * Extracts a flattened dictionary of field-level error messages from a ZodError.
 * Nested paths are joined with dots (e.g. "address.postalCode").
 */
export function formatZodError(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form'
    // Keep first error message for each field
    if (!errors[key]) {
      errors[key] = issue.message
    }
  }
  return errors
}

/**
 * Reusable frontend form / payload validator.
 * Validates untrusted input before mutating or submitting to API.
 * NOTE: Backend validation remains the ultimate authoritative security boundary.
 */
export function validateForm<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data)
  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: {},
    }
  }

  const errors = formatZodError(result.error)
  const firstErrorMessage =
    result.error.issues[0]?.message || 'Please check form input fields for validity'

  return {
    success: false,
    data: null,
    errors,
    message: firstErrorMessage,
  }
}

/**
 * Lightweight runtime validation for selected API responses.
 * Parses and verifies backend payload shape without crashing on minor extraneous keys.
 * Logs a console warning in non-production if payload does not conform to expectations.
 */
export function validateApiResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  contextName = 'API Response',
): T {
  const result = schema.safeParse(data)
  if (result.success) {
    return result.data
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `[LeadFlow Validation] Schema discrepancy in ${contextName}:`,
      result.error.issues,
    )
  }
  // Return parsed data or cast fallback so UI does not abruptly crash on safe schema extensions
  return data as T
}

/* =========================================================================
 * Reusable Core Domain Schemas (Client-Side)
 * ========================================================================= */

export const taskStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
  message: 'Invalid task status',
})

export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'], {
  message: 'Invalid task priority',
})

/**
 * Validates task status update payloads before sending PATCH /api/tasks/:id
 */
export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
})

export type UpdateTaskStatusPayload = z.infer<typeof updateTaskStatusSchema>

/**
 * Schema for frontend task query and filter states
 */
export const taskFilterSchema = z.object({
  search: z.string().trim().default(''),
  status: z.union([taskStatusSchema, z.literal('ALL')]).default('ALL'),
  priority: z.union([taskPrioritySchema, z.literal('ALL')]).default('ALL'),
  dueCategory: z.enum(['ALL', 'OVERDUE', 'DUE_TODAY', 'UPCOMING', 'NO_DUE_DATE']).default('ALL'),
  scope: z.enum(['ALL', 'MY_TASKS', 'LEADS_ONLY', 'CLIENTS_ONLY']).default('ALL'),
})

export type TaskFilterValues = z.infer<typeof taskFilterSchema>

/**
 * Safe client-side schema for Populated Task relations
 */
export const populatedUserSummarySchema = z.object({
  _id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
})

export const populatedLeadSummarySchema = z.object({
  _id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  status: z.string().optional(),
})

export const taskResponseItemSchema = z.object({
  _id: z.string(),
  brokerageId: z.string().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z.string().nullable().optional(),
  assignedTo: z.union([z.string(), populatedUserSummarySchema]).nullable().optional(),
  leadId: z.union([z.string(), populatedLeadSummarySchema]).nullable().optional(),
  clientId: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
  isOverdue: z.boolean().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const taskListResponseSchema = z.array(taskResponseItemSchema)

/* =========================================================================
 * Pipeline Trigger & Automation Schemas (Client-Side)
 * ========================================================================= */

export const triggerActionTypeSchema = z.enum(['CREATE_TASK', 'SEND_EMAIL', 'NOTIFICATION'], {
  message: 'Invalid trigger action type',
})

export const triggerRecipientTypeSchema = z.enum(['LEAD', 'AGENT', 'CUSTOM'], {
  message: 'Invalid recipient type',
})

export const triggerActionConfigSchema = z.object({
  taskTitle: z.string().trim().max(200).optional(),
  taskDescription: z.string().trim().max(5000).optional(),
  taskPriority: taskPrioritySchema.default('MEDIUM'),
  dueDaysOffset: z.coerce.number().int().min(0).default(1),
  dueHoursOffset: z.coerce.number().min(0).nullable().optional(),
  templateId: z.string().optional(),
  recipientType: triggerRecipientTypeSchema.default('LEAD'),
  customRecipientEmail: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
})

export const createTriggerFormSchema = z.object({
  name: z.string().trim().min(1, 'Trigger rule name is required').max(100),
  fromStage: z.string().trim().nullable().optional(),
  toStage: z.string().trim().min(1, 'Target stage is required'),
  actionType: triggerActionTypeSchema,
  actionConfig: triggerActionConfigSchema.default({
    taskPriority: 'MEDIUM',
    dueDaysOffset: 1,
    recipientType: 'LEAD',
  }),
  isActive: z.boolean().default(true),
})

export const updateTriggerStatusSchema = z.object({
  isActive: z.boolean(),
})

export const updateTriggerFormSchema = createTriggerFormSchema.partial()

export const triggerResponseItemSchema = z.object({
  _id: z.string(),
  brokerageId: z.string().optional(),
  name: z.string(),
  fromStage: z.string().nullable().optional(),
  toStage: z.string(),
  actionType: triggerActionTypeSchema,
  actionConfig: z.object({
    taskTitle: z.string().optional(),
    taskDescription: z.string().optional(),
    taskPriority: z.string().optional(),
    dueDaysOffset: z.number().optional(),
    dueHoursOffset: z.number().nullable().optional(),
    templateId: z.union([
      z.string(),
      z.object({
        _id: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        subject: z.string().optional(),
      }),
    ]).nullable().optional(),
    recipientType: z.string().optional(),
    customRecipientEmail: z.string().nullable().optional(),
  }),
  isActive: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const triggerListResponseSchema = z.array(triggerResponseItemSchema)

/* =========================================================================
 * Email Template Schemas (Client-Side)
 * ========================================================================= */

export const createEmailTemplateFormSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Template slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  subject: z.string().trim().min(1, 'Email subject is required').max(200),
  body: z.string().trim().min(1, 'Email body is required'),
  variables: z.array(z.string().trim()).default([]),
  isActive: z.boolean().default(true),
})

export const updateEmailTemplateFormSchema = createEmailTemplateFormSchema.partial()

export const emailTemplateResponseItemSchema = z.object({
  _id: z.string(),
  brokerageId: z.string().optional(),
  name: z.string(),
  slug: z.string(),
  subject: z.string(),
  body: z.string(),
  variables: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const emailTemplateListResponseSchema = z.array(emailTemplateResponseItemSchema)

