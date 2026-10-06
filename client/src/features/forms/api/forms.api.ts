import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type {
  IForm,
  CreateFormPayload,
  UpdateFormPayload,
  FormQueryParams,
} from '@/types/form.types'
import {
  validateForm,
  createFormClientSchema,
  updateFormClientSchema,
} from '@/lib/validation'

export const formQueryKeys = {
  all: ['forms'] as const,
  lists: (query?: FormQueryParams) => [...formQueryKeys.all, 'list', query] as const,
  detail: (id: string) => [...formQueryKeys.all, 'detail', id] as const,
}

/**
 * Fetches forms for the authenticated user's brokerage.
 */
export async function getForms(query?: FormQueryParams): Promise<IForm[]> {
  const params: Record<string, string | number> = {}
  if (query?.status && query.status !== 'ALL') params.status = query.status
  if (query?.search?.trim()) params.search = query.search.trim()
  if (query?.page) params.page = query.page
  if (query?.limit) params.limit = query.limit
  if (query?.sort) params.sort = query.sort
  if (query?.order) params.order = query.order

  const res = await api.get<ApiResponse<IForm[]>>('/forms', { params })
  const rawData = res.data.data

  if (Array.isArray(rawData)) {
    return rawData
  }

  // Handle potential nested wrapper
  const wrapped = rawData as unknown as { forms?: IForm[] }
  if (wrapped?.forms && Array.isArray(wrapped.forms)) {
    return wrapped.forms
  }

  return []
}

/**
 * Fetches a single form by ID.
 */
export async function getFormById(id: string): Promise<IForm> {
  const res = await api.get<ApiResponse<IForm>>(`/forms/${id}`)
  if (!res.data.data) {
    throw new Error(res.data.message || 'Form not found')
  }
  return res.data.data
}

/**
 * Creates a new form in the brokerage.
 */
export async function createForm(payload: CreateFormPayload): Promise<IForm> {
  const validation = validateForm(createFormClientSchema, payload)
  if (!validation.success) {
    throw new Error(validation.message)
  }

  const res = await api.post<ApiResponse<IForm>>('/forms', validation.data)
  if (!res.data.data) {
    throw new Error(res.data.message || 'Failed to create form')
  }
  return res.data.data
}

/**
 * Updates form details, fields, or lifecycle status.
 */
export async function updateForm(
  id: string,
  payload: UpdateFormPayload,
): Promise<IForm> {
  const validation = validateForm(updateFormClientSchema, payload)
  if (!validation.success) {
    throw new Error(validation.message)
  }

  const res = await api.patch<ApiResponse<IForm>>(`/forms/${id}`, validation.data)
  if (!res.data.data) {
    throw new Error(res.data.message || 'Failed to update form')
  }
  return res.data.data
}

/**
 * Archives a form (DELETE /api/forms/:id transitions to ARCHIVED).
 */
export async function archiveForm(id: string): Promise<IForm> {
  const res = await api.delete<ApiResponse<IForm>>(`/forms/${id}`)
  if (!res.data.data) {
    throw new Error(res.data.message || 'Failed to archive form')
  }
  return res.data.data
}

export const formsApi = {
  getForms,
  getFormById,
  createForm,
  updateForm,
  archiveForm,
}

/* =========================================================================
 * TanStack Query Hooks
 * ========================================================================= */

export function useForms(query?: FormQueryParams) {
  return useQuery({
    queryKey: formQueryKeys.lists(query),
    queryFn: () => formsApi.getForms(query),
    staleTime: 60 * 1000,
  })
}

export function useForm(id: string) {
  return useQuery({
    queryKey: formQueryKeys.detail(id),
    queryFn: () => formsApi.getFormById(id),
    enabled: Boolean(id),
  })
}

export function useCreateForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateFormPayload) => formsApi.createForm(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formQueryKeys.all })
    },
  })
}

export function useUpdateForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFormPayload }) =>
      formsApi.updateForm(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formQueryKeys.all })
    },
  })
}

export function useArchiveForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formsApi.archiveForm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formQueryKeys.all })
    },
  })
}
