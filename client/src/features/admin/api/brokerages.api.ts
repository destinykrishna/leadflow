import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type {
  BrokerageItem,
  CreateBrokeragePayload,
  UpdateBrokeragePayload,
  OnboardingResult,
  RotateWebhookSecretResult,
  SafeBrokerageResult,
} from '@/types/brokerage.types'

export const brokeragesApi = {
  getBrokerages: async (): Promise<BrokerageItem[]> => {
    const response = await api.get<ApiResponse<{ brokerages: BrokerageItem[] }>>('/brokerages')
    return response.data.data?.brokerages || []
  },

  getBrokerageById: async (brokerageId: string): Promise<BrokerageItem | null> => {
    const response = await api.get<ApiResponse<{ brokerage: BrokerageItem }>>(`/brokerages/${brokerageId}`)
    return response.data.data?.brokerage || null
  },

  createBrokerage: async (payload: CreateBrokeragePayload): Promise<OnboardingResult> => {
    const response = await api.post<ApiResponse<OnboardingResult>>('/brokerages', payload)
    if (!response.data.data) {
      throw new Error(response.data.message || 'Failed to create brokerage')
    }
    return response.data.data
  },

  updateBrokerage: async ({
    brokerageId,
    payload,
  }: {
    brokerageId: string
    payload: UpdateBrokeragePayload
  }): Promise<SafeBrokerageResult> => {
    const response = await api.patch<ApiResponse<{ brokerage: SafeBrokerageResult }>>(
      `/brokerages/${brokerageId}`,
      payload
    )
    if (!response.data.data?.brokerage) {
      throw new Error(response.data.message || 'Failed to update brokerage')
    }
    return response.data.data.brokerage
  },

  rotateWebhookSecret: async (brokerageId: string): Promise<RotateWebhookSecretResult> => {
    const response = await api.post<ApiResponse<RotateWebhookSecretResult>>(
      `/brokerages/${brokerageId}/webhook-secret/rotate`
    )
    if (!response.data.data) {
      throw new Error(response.data.message || 'Failed to rotate webhook secret')
    }
    return response.data.data
  },

  getBrokerageAdvisors: async (
    brokerageId: string
  ): Promise<{ advisors: any[]; total: number }> => {
    const response = await api.get<
      ApiResponse<{ advisors: any[]; total: number; page: number; limit: number }>
    >(`/brokerages/${brokerageId}/advisors`)
    return {
      advisors: response.data.data?.advisors || [],
      total: response.data.data?.total || 0,
    }
  },
}

export function useBrokeragesList() {
  return useQuery({
    queryKey: ['brokerages'],
    queryFn: brokeragesApi.getBrokerages,
    staleTime: 30000,
  })
}

export function useBrokerage(brokerageId: string | null) {
  return useQuery({
    queryKey: ['brokerage', brokerageId],
    queryFn: () => (brokerageId ? brokeragesApi.getBrokerageById(brokerageId) : null),
    enabled: Boolean(brokerageId),
  })
}

export function useCreateBrokerage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: brokeragesApi.createBrokerage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brokerages'] })
    },
  })
}

export function useUpdateBrokerage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: brokeragesApi.updateBrokerage,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brokerages'] })
      queryClient.invalidateQueries({ queryKey: ['brokerage', data.id] })
    },
  })
}

export function useRotateWebhookSecret() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: brokeragesApi.rotateWebhookSecret,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brokerages'] })
      queryClient.invalidateQueries({ queryKey: ['brokerage', data.id] })
    },
  })
}

export function useBrokerageAdvisors(brokerageId: string | null) {
  return useQuery({
    queryKey: ['brokerage', brokerageId, 'advisors'],
    queryFn: () => (brokerageId ? brokeragesApi.getBrokerageAdvisors(brokerageId) : null),
    enabled: Boolean(brokerageId),
  })
}
