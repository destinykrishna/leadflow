import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type {
  AdvisorItem,
  CreateAdvisorPayload,
  UpdateAdvisorPayload,
  ListAdvisorsQuery,
  PaginatedAdvisorsResponse,
} from '@/types/advisor.types'
import type { BrokerageItem } from '@/types/brokerage.types'
import type { PipelineGroupedData } from '@/types/pipeline.types'

export const teamApi = {
  getAdvisors: async (query?: ListAdvisorsQuery): Promise<PaginatedAdvisorsResponse> => {
    const response = await api.get<ApiResponse<PaginatedAdvisorsResponse>>('/advisors', {
      params: query,
    })
    return (
      response.data.data || {
        advisors: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 1,
      }
    )
  },

  getAdvisorById: async (id: string): Promise<AdvisorItem | null> => {
    const response = await api.get<ApiResponse<{ advisor: AdvisorItem }>>(`/advisors/${id}`)
    return response.data.data?.advisor || null
  },

  createAdvisor: async (payload: CreateAdvisorPayload): Promise<AdvisorItem> => {
    const response = await api.post<ApiResponse<{ advisor: AdvisorItem }>>('/advisors', payload)
    if (!response.data.data?.advisor) {
      throw new Error(response.data.message || 'Failed to create advisor')
    }
    return response.data.data.advisor
  },

  updateAdvisor: async ({
    id,
    payload,
  }: {
    id: string
    payload: UpdateAdvisorPayload
  }): Promise<AdvisorItem> => {
    const response = await api.patch<ApiResponse<{ advisor: AdvisorItem }>>(
      `/advisors/${id}`,
      payload
    )
    if (!response.data.data?.advisor) {
      throw new Error(response.data.message || 'Failed to update advisor')
    }
    return response.data.data.advisor
  },

  getBrokerageDetails: async (brokerageId: string): Promise<BrokerageItem | null> => {
    const response = await api.get<ApiResponse<{ brokerage: BrokerageItem }>>(
      `/brokerages/${brokerageId}`
    )
    return response.data.data?.brokerage || null
  },

  getAdvisorWorkload: async (): Promise<AdvisorWorkloadResponse> => {
    const response = await api.get<ApiResponse<AdvisorWorkloadResponse>>('/advisors/workload')
    return (
      response.data.data || {
        advisors: [],
        summary: {
          totalAdvisors: 0,
          activeAdvisors: 0,
          totalActiveAssignedLeads: 0,
          totalPendingTasks: 0,
          totalOverdueTasks: 0,
          totalWonCases: 0,
        },
      }
    )
  },

  getPipelineSummary: async (): Promise<PipelineGroupedData | null> => {
    try {
      const response = await api.get<ApiResponse<PipelineGroupedData>>('/leads/pipeline')
      return response.data.data || null
    } catch {
      return null
    }
  },
}

export interface AdvisorWorkloadItem {
  advisorId: string
  name: string
  email: string
  status: string
  phone?: string
  workload: {
    activeLeadsCount: number
    wonCasesCount: number
    totalLeadsCount: number
    pendingTasksCount: number
    overdueTasksCount: number
    completedTasksCount: number
    activeLoanVolume: number
  }
}

export interface AdvisorWorkloadResponse {
  advisors: AdvisorWorkloadItem[]
  summary: {
    totalAdvisors: number
    activeAdvisors: number
    totalActiveAssignedLeads: number
    totalPendingTasks: number
    totalOverdueTasks: number
    totalWonCases: number
  }
}

export function useAdvisorWorkload() {
  return useQuery({
    queryKey: ['advisors', 'workload'],
    queryFn: teamApi.getAdvisorWorkload,
    staleTime: 30000,
  })
}

export function useAdvisorsList(query?: ListAdvisorsQuery) {
  return useQuery({
    queryKey: ['advisors', query],
    queryFn: () => teamApi.getAdvisors(query),
    staleTime: 30000,
  })
}

export function useCreateAdvisor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: teamApi.createAdvisor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advisors'] })
    },
  })
}

export function useUpdateAdvisor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: teamApi.updateAdvisor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advisors'] })
    },
  })
}

export function useBrokerageDetails(brokerageId?: string | null) {
  return useQuery({
    queryKey: ['brokerage-details', brokerageId],
    queryFn: () => (brokerageId ? teamApi.getBrokerageDetails(brokerageId) : null),
    enabled: Boolean(brokerageId),
    staleTime: 60000,
  })
}

export function usePipelineSummary() {
  return useQuery({
    queryKey: ['team-pipeline-summary'],
    queryFn: teamApi.getPipelineSummary,
    staleTime: 45000,
  })
}
