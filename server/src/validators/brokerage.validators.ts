import { z } from 'zod';
import { BROKERAGE_PLANS, BROKERAGE_STATUSES } from '../models/brokerage.model.js';

export const createBrokerageAdminSchema = z.object({
  name: z.string().trim().min(2, 'Admin name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  phone: z.string().trim().optional(),
});

export const createBrokerageSchema = z
  .object({
    name: z.string().trim().min(2, 'Brokerage name must be at least 2 characters').max(100),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be alphanumeric with optional hyphens')
      .max(100)
      .optional(),
    plan: z.enum(BROKERAGE_PLANS).default('STARTER').optional(),
    status: z.enum(BROKERAGE_STATUSES).default('ACTIVE').optional(),
    // Support nested admin object
    admin: createBrokerageAdminSchema.optional(),
    // Or flat admin fields
    adminName: z.string().trim().min(2).max(100).optional(),
    adminEmail: z.string().trim().email().toLowerCase().optional(),
    adminPassword: z.string().min(8).max(100).optional(),
    adminPhone: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      const hasNested = Boolean(data.admin?.name && data.admin?.email && data.admin?.password);
      const hasFlat = Boolean(data.adminName && data.adminEmail && data.adminPassword);
      return hasNested || hasFlat;
    },
    {
      message: 'Initial brokerage admin details (name, email, password) are required',
      path: ['admin'],
    }
  );

export type CreateBrokerageInput = z.infer<typeof createBrokerageSchema>;

export const updateBrokerageSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be alphanumeric with optional hyphens')
    .max(100)
    .optional(),
  plan: z.enum(BROKERAGE_PLANS).optional(),
  status: z.enum(BROKERAGE_STATUSES).optional(),
});

export type UpdateBrokerageInput = z.infer<typeof updateBrokerageSchema>;
