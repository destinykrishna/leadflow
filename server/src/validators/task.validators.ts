import { z } from 'zod';
import { TASK_STATUSES, TASK_PRIORITIES } from '../models/task.model.js';
import { objectIdSchema } from './common.validators.js';

export const taskQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  assignedTo: objectIdSchema.optional(),
  leadId: objectIdSchema.optional(),
  clientId: objectIdSchema.optional(),
  isOverdue: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(TASK_STATUSES).default('PENDING'),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  dueDate: z.coerce.date().optional(),
  assignedTo: objectIdSchema,
  leadId: objectIdSchema.optional(),
  clientId: objectIdSchema.optional(),
});
