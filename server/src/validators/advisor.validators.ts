import { z } from 'zod';
import { objectIdSchema } from './common.validators.js';

export const createAdvisorSchema = z.object({
  name: z.string().trim().min(2, 'Advisor name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  brokerageId: objectIdSchema.optional(),
});

export type CreateAdvisorInput = z.infer<typeof createAdvisorSchema>;

export const updateAdvisorSchema = z.object({
  name: z.string().trim().min(2, 'Advisor name must be at least 2 characters').max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type UpdateAdvisorInput = z.infer<typeof updateAdvisorSchema>;

export const listAdvisorsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  brokerageId: objectIdSchema.optional(),
});

export type ListAdvisorsQuery = z.infer<typeof listAdvisorsQuerySchema>;
