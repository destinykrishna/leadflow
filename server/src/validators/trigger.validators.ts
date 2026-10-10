import { z } from 'zod';
import {
  TRIGGER_ACTION_TYPES,
  TRIGGER_RECIPIENT_TYPES,
  TRIGGER_DELAY_UNITS,
} from '../models/pipeline-trigger.model.js';
import { objectIdSchema } from './common.validators.js';

export const triggerActionConfigSchema = z
  .object({
    taskTitle: z.string().trim().max(200).optional(),
    taskDescription: z.string().trim().max(5000).optional(),
    taskPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    dueDaysOffset: z.coerce.number().int().min(0).optional(),
    dueHoursOffset: z.coerce.number().min(0).optional(),
    templateId: objectIdSchema.optional(),
    recipientType: z.enum(TRIGGER_RECIPIENT_TYPES).default('LEAD'),
    customRecipientEmail: z.string().email().optional(),
    delayAmount: z.coerce.number().int().min(0).default(0),
    delayUnit: z.enum(TRIGGER_DELAY_UNITS).default('IMMEDIATE'),
    cancelOnStageChange: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.delayUnit && data.delayUnit !== 'IMMEDIATE') {
      if (!data.delayAmount || data.delayAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'delayAmount must be greater than 0 when delayUnit is specified',
          path: ['delayAmount'],
        });
      }
      if (data.delayUnit === 'DAYS' && data.delayAmount > 30) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'delayAmount cannot exceed 30 days',
          path: ['delayAmount'],
        });
      }
    }
  });

export const createTriggerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  fromStage: z.string().trim().nullable().optional(),
  toStage: z.string().trim().min(1),
  actionType: z.enum(TRIGGER_ACTION_TYPES),
  actionConfig: triggerActionConfigSchema.default({
    taskPriority: 'MEDIUM',
    recipientType: 'LEAD',
    delayAmount: 0,
    delayUnit: 'IMMEDIATE',
    cancelOnStageChange: true,
  }),
  isActive: z.boolean().default(true),
});

export const updateTriggerSchema = createTriggerSchema.partial();
