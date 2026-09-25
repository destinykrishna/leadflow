import { z } from 'zod';
import { CLIENT_TYPES, type ClientType } from '../models/client.model.js';
import { objectIdSchema } from './common.validators.js';

export const clientTypeEnum = z.enum(CLIENT_TYPES);

/**
 * Stages in which a lead is eligible to be converted into a Client.
 * Raw 'NEW' and 'CONTACTED' leads must be qualified before becoming a client.
 * Terminal 'LOST' leads cannot be converted.
 */
export const ELIGIBLE_CONVERSION_STAGES = [
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
] as const;

export type EligibleConversionStage = (typeof ELIGIBLE_CONVERSION_STAGES)[number];

export function isEligibleForConversion(status: string): status is EligibleConversionStage {
  return ELIGIBLE_CONVERSION_STAGES.includes(status as EligibleConversionStage);
}

/**
 * Validation schema for converting a lead into a client case.
 */
export const convertLeadSchema = z.object({
  password: z
    .string()
    .min(8, 'Portal password must be at least 8 characters long')
    .optional(),
  type: clientTypeEnum.optional(),
  assignedTo: objectIdSchema.optional(),
  notes: z.string().max(5000, 'Notes cannot exceed 5000 characters').optional(),
  address: z
    .object({
      street: z.string().trim().max(100).optional(),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(100).optional(),
      postalCode: z.string().trim().max(20).optional(),
    })
    .optional(),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

/**
 * Schema validating route params containing a clientId (:id).
 */
export const clientIdParamSchema = z.object({
  id: objectIdSchema,
});

export type ClientIdParam = z.infer<typeof clientIdParamSchema>;
