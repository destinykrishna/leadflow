import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
  brokerageId: z.string().trim().optional(),
  brokerageSlug: z.string().trim().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required').optional(),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
