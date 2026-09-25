import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type { PipelineGroupedData, Lead, LeadStatus } from '@/types/pipeline.types'

export interface PipelineQueryParams {
  stage?: LeadStatus
  assignedTo?: string
  search?: string
}

export const pipelineApi = {
  getPipeline: async (params?: PipelineQueryParams): Promise<PipelineGroupedData> => {
    const response = await api.get<ApiResponse<PipelineGroupedData>>('/leads/pipeline', {
      params,
    })
    return (
      response.data.data || {
        pipeline: {
          NEW: [],
          CONTACTED: [],
          QUALIFIED: [],
          PROPOSAL: [],
          NEGOTIATION: [],
          WON: [],
          LOST: [],
        },
        counts: {
          NEW: 0,
          CONTACTED: 0,
          QUALIFIED: 0,
          PROPOSAL: 0,
          NEGOTIATION: 0,
          WON: 0,
          LOST: 0,
        },
        total: 0,
      }
    )
  },

  getLeads: async (params?: PipelineQueryParams): Promise<{ leads: Lead[]; total: number }> => {
    const response = await api.get<ApiResponse<{ leads: Lead[]; total: number }>>('/leads', {
      params,
    })
    return response.data.data || { leads: [], total: 0 }
  },

  getLeadById: async (id: string): Promise<Lead> => {
    const response = await api.get<ApiResponse<{ lead: Lead }>>(`/leads/${id}`)
    return response.data.data!.lead
  },

  updateLeadStage: async ({
    id,
    stage,
    version,
  }: {
    id: string
    stage: LeadStatus
    version?: number
  }): Promise<{ lead: Lead; previousStage: LeadStatus; currentStage: LeadStatus }> => {
    const response = await api.patch<
      ApiResponse<{ lead: Lead; previousStage: LeadStatus; currentStage: LeadStatus }>
    >(`/leads/${id}/stage`, {
      stage,
      version,
    })
    return response.data.data!
  },
}

export const PIPELINE_QUERY_KEY = ['pipeline']
export const LEADS_QUERY_KEY = ['leads']

export function usePipeline(params?: PipelineQueryParams) {
  return useQuery({
    queryKey: [...PIPELINE_QUERY_KEY, params],
    queryFn: () => pipelineApi.getPipeline(params),
    staleTime: 1000 * 30, // 30 seconds
  })
}

export function useLeads(params?: PipelineQueryParams) {
  return useQuery({
    queryKey: [...LEADS_QUERY_KEY, params],
    queryFn: () => pipelineApi.getLeads(params),
    staleTime: 1000 * 30,
  })
}

export function useUpdateLeadStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: pipelineApi.updateLeadStage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY })
    },
  })
}
