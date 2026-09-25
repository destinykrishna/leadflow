import { z } from 'zod';

export const createEmailTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().toLowerCase().min(1).max(100),
  subject: z.string().trim().min(1).max(200),
  body: z.string().min(1),
  variables: z.array(z.string().trim()).default([]),
  isActive: z.boolean().default(true),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();
