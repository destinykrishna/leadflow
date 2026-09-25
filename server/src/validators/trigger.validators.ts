import { z } from 'zod';
import { TRIGGER_ACTION_TYPES, TRIGGER_RECIPIENT_TYPES } from '../models/pipeline-trigger.model.js';
import { objectIdSchema } from './common.validators.js';

export const triggerActionConfigSchema = z.object({
  taskTitle: z.string().trim().max(200).optional(),
  taskDescription: z.string().trim().max(5000).optional(),
  taskPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDaysOffset: z.coerce.number().int().min(0).optional(),
  dueHoursOffset: z.coerce.number().min(0).optional(),
  templateId: objectIdSchema.optional(),
  recipientType: z.enum(TRIGGER_RECIPIENT_TYPES).default('LEAD'),
  customRecipientEmail: z.string().email().optional(),
});

export const createTriggerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  fromStage: z.string().trim().nullable().optional(),
  toStage: z.string().trim().min(1),
  actionType: z.enum(TRIGGER_ACTION_TYPES),
  actionConfig: triggerActionConfigSchema.default({
    taskPriority: 'MEDIUM',
    recipientType: 'LEAD',
  }),
  isActive: z.boolean().default(true),
});

export const updateTriggerSchema = createTriggerSchema.partial();
