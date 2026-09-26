import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type {
  IEmailTemplate,
  CreateEmailTemplatePayload,
  UpdateEmailTemplatePayload,
} from '@/types/template.types'
import {
  validateForm,
  validateApiResponse,
  createEmailTemplateFormSchema,
  updateEmailTemplateFormSchema,
  emailTemplateListResponseSchema,
} from '@/lib/validation'

export const templateQueryKeys = {
  all: ['email-templates'] as const,
  lists: () => [...templateQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...templateQueryKeys.all, 'detail', id] as const,
}

/**
 * Fetches all email templates for the current brokerage.
 */
export async function getEmailTemplates(): Promise<IEmailTemplate[]> {
  const res = await api.get<ApiResponse<IEmailTemplate[]>>('/email-templates')
  const rawData = res.data.data

  if (Array.isArray(rawData)) {
    validateApiResponse(emailTemplateListResponseSchema, rawData, 'EmailTemplatesList')
    return rawData
  }

  // Fallback for wrapped responses
  const wrapped = rawData as unknown as { templates?: IEmailTemplate[] }
  if (wrapped?.templates && Array.isArray(wrapped.templates)) {
    validateApiResponse(emailTemplateListResponseSchema, wrapped.templates, 'EmailTemplatesList')
    return wrapped.templates
  }

  return []
}

/**
 * Fetches a single email template by ID.
 */
export async function getEmailTemplateById(id: string): Promise<IEmailTemplate> {
  const res = await api.get<ApiResponse<IEmailTemplate>>(`/email-templates/${id}`)
  return res.data.data!
}

/**
 * Creates an email template (Brokerage Admin / Platform Admin).
 */
export async function createEmailTemplate(
  payload: CreateEmailTemplatePayload,
): Promise<IEmailTemplate> {
  const validation = validateForm(createEmailTemplateFormSchema, payload)
  if (!validation.success) {
    throw new Error(validation.message)
  }

  const res = await api.post<ApiResponse<IEmailTemplate>>('/email-templates', validation.data)
  return res.data.data!
}

/**
 * Updates an email template.
 */
export async function updateEmailTemplate(
  id: string,
  payload: UpdateEmailTemplatePayload,
): Promise<IEmailTemplate> {
  const validation = validateForm(updateEmailTemplateFormSchema, payload)
  if (!validation.success) {
    throw new Error(validation.message)
  }

  const res = await api.patch<ApiResponse<IEmailTemplate>>(`/email-templates/${id}`, validation.data)
  return res.data.data!
}

/* =========================================================================
 * TanStack Query Hooks
 * ========================================================================= */

export function useEmailTemplates() {
  return useQuery({
    queryKey: templateQueryKeys.lists(),
    queryFn: getEmailTemplates,
    staleTime: 60 * 1000,
  })
}

export function useEmailTemplate(id: string) {
  return useQuery({
    queryKey: templateQueryKeys.detail(id),
    queryFn: () => getEmailTemplateById(id),
    enabled: Boolean(id),
  })
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createEmailTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.all })
    },
  })
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEmailTemplatePayload }) =>
      updateEmailTemplate(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateQueryKeys.all })
    },
  })
}
