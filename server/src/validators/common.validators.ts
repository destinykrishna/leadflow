import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationError } from '../utils/errors.js';

/**
 * Validates a 24-character hexadecimal MongoDB ObjectId string.
 */
export const objectIdSchema = z
  .string()
  .trim()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId format',
  });

/**
 * Schema validating route params containing a brokerageId.
 */
export const brokerageIdParamSchema = z.object({
  brokerageId: objectIdSchema,
});

/**
 * Common pagination query parameters schema.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Validates data against a Zod schema and throws a structured ValidationError if invalid.
 */
export function validateData<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }
  return result.data;
}
