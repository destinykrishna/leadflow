import { z } from 'zod';

export const translateRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Text to translate cannot be empty')
    .max(2000, 'Text to translate cannot exceed 2000 characters'),
  targetLang: z.enum(['en', 'de'], {
    message: 'targetLang must be either "en" or "de"',
  }),
  sourceLang: z.enum(['en', 'de']).optional(),
  context: z
    .enum(['lead_note', 'document_note', 'task_description', 'email_preview', 'general_note'])
    .optional(),
});

export type TranslateRequestInput = z.infer<typeof translateRequestSchema>;
