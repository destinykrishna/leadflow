import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type {
  IPipelineTrigger,
  CreateTriggerPayload,
  UpdateTriggerPayload,
} from '@/types/trigger.types'
import {
  validateForm,
  validateApiResponse,
  createTriggerFormSchema,
  updateTriggerStatusSchema,
  triggerListResponseSchema,
} from '@/lib/validation'

export interface TriggersResponseData {
  triggers: IPipelineTrigger[]
  total: number
}

/**
 * Fetches all pipeline triggers for the current brokerage.
 */
export async function getTriggers(): Promise<IPipelineTrigger[]> {
  const res = await api.get<ApiResponse<IPipelineTrigger[]>>('/triggers')
  const rawData = res.data.data

  if (Array.isArray(rawData)) {
    validateApiResponse(triggerListResponseSchema, rawData, 'TriggersList')
    return rawData
  }

  // Fallback for wrapped responses
  const wrapped = rawData as unknown as { triggers?: IPipelineTrigger[] }
  if (wrapped?.triggers && Array.isArray(wrapped.triggers)) {
    validateApiResponse(triggerListResponseSchema, wrapped.triggers, 'TriggersList')
    return wrapped.triggers
  }

  return []
}

/**
 * Fetches a single trigger by ID.
 */
export async function getTriggerById(id: string): Promise<IPipelineTrigger> {
  const res = await api.get<ApiResponse<IPipelineTrigger>>(`/triggers/${id}`)
  return res.data.data!
}

/**
 * Creates a new pipeline trigger (Brokerage Admin / Platform Admin).
 */
export async function createTrigger(payload: CreateTriggerPayload): Promise<IPipelineTrigger> {
  const validation = validateForm(createTriggerFormSchema, payload)
  if (!validation.success) {
    throw new Error(validation.message)
  }

  const res = await api.post<ApiResponse<IPipelineTrigger>>('/triggers', validation.data)
  return res.data.data!
}

/**
 * Updates a pipeline trigger.
 */
export async function updateTrigger(
  id: string,
  payload: UpdateTriggerPayload,
): Promise<IPipelineTrigger> {
  const res = await api.patch<ApiResponse<IPipelineTrigger>>(`/triggers/${id}`, payload)
  return res.data.data!
}

/**
 * Toggles a trigger's active/paused state.
 */
export async function toggleTriggerStatus(
  id: string,
  isActive: boolean,
): Promise<IPipelineTrigger> {
  const validation = validateForm(updateTriggerStatusSchema, { isActive })
  if (!validation.success) {
    throw new Error(validation.message)
  }

  const res = await api.patch<ApiResponse<IPipelineTrigger>>(`/triggers/${id}`, validation.data)
  return res.data.data!
}

/**
 * Deletes a pipeline trigger.
 */
export async function deleteTrigger(id: string): Promise<void> {
  await api.delete(`/triggers/${id}`)
}

/* =========================================================================
 * TanStack Query Hooks
 * ========================================================================= */

export const triggerQueryKeys = {
  all: ['triggers'] as const,
  lists: () => [...triggerQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...triggerQueryKeys.all, 'detail', id] as const,
}

export function useTriggers() {
  return useQuery({
    queryKey: triggerQueryKeys.lists(),
    queryFn: getTriggers,
    staleTime: 30 * 1000,
  })
}

export function useTrigger(id: string) {
  return useQuery({
    queryKey: triggerQueryKeys.detail(id),
    queryFn: () => getTriggerById(id),
    enabled: Boolean(id),
  })
}

export function useCreateTrigger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTrigger,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: triggerQueryKeys.all })
    },
  })
}

export function useUpdateTrigger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTriggerPayload }) =>
      updateTrigger(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: triggerQueryKeys.all })
    },
  })
}

export function useToggleTrigger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleTriggerStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: triggerQueryKeys.all })
    },
  })
}

export function useDeleteTrigger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTrigger,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: triggerQueryKeys.all })
    },
  })
}
