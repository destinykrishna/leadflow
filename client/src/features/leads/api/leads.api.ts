import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type { Lead, LeadStatus } from '@/types/pipeline.types'
import type { Task } from '@/types/task.types'
import type { DocumentItem } from '@/types/document.types'
import type { ClientType } from '@/types/client.types'
import { PIPELINE_QUERY_KEY } from '@/features/pipeline/api/pipeline.api'

export interface ConvertLeadPayload {
  password?: string
  type?: ClientType
  notes?: string
  assignedTo?: string
  address?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
  }
}

export interface ConvertLeadResponseData {
  client: {
    _id: string
    brokerageId: string
    userId?: string
    firstName: string
    lastName: string
    email: string
    phone?: string
    status: string
    type: string
  }
  user: {
    id: string
    email: string
    name: string
    role: string
    isNew: boolean
  }
  lead: Lead
  temporaryPassword?: string
}

export interface LeadsQueryParams {
  status?: LeadStatus
  search?: string
  page?: number
  limit?: number
}

export const leadsApi = {
  getLeadById: async (id: string): Promise<Lead> => {
    const response = await api.get<ApiResponse<{ lead: Lead }>>(`/leads/${id}`)
    return response.data.data!.lead
  },

  listLeads: async (params?: LeadsQueryParams): Promise<{ leads: Lead[]; total: number }> => {
    const response = await api.get<ApiResponse<{ leads: Lead[]; total: number }>>('/leads', {
      params,
    })
    return response.data.data || { leads: [], total: 0 }
  },

  getLeadTasks: async (leadId: string): Promise<Task[]> => {
    const response = await api.get<ApiResponse<Task[]>>('/tasks', {
      params: { leadId },
    })
    return response.data.data || []
  },

  getLeadDocuments: async (leadId: string): Promise<DocumentItem[]> => {
    const response = await api.get<ApiResponse<{ documents: DocumentItem[] }>>('/documents', {
      params: { leadId },
    })
    return response.data.data?.documents || []
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

  convertLeadToClient: async ({
    leadId,
    payload,
  }: {
    leadId: string
    payload: ConvertLeadPayload
  }): Promise<ConvertLeadResponseData> => {
    const response = await api.post<ApiResponse<ConvertLeadResponseData>>(
      `/leads/${leadId}/convert`,
      payload,
    )
    return response.data.data!
  },
}

export const LEAD_QUERY_KEY = (id: string) => ['lead', id]
export const LEAD_TASKS_KEY = (id: string) => ['lead-tasks', id]
export const LEAD_DOCUMENTS_KEY = (id: string) => ['lead-documents', id]
export const LEADS_LIST_KEY = ['leads-list']

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: LEAD_QUERY_KEY(id || ''),
    queryFn: () => leadsApi.getLeadById(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 15,
  })
}

export function useLeadTasks(leadId: string | undefined) {
  return useQuery({
    queryKey: LEAD_TASKS_KEY(leadId || ''),
    queryFn: () => leadsApi.getLeadTasks(leadId!),
    enabled: Boolean(leadId),
    staleTime: 1000 * 15,
  })
}

export function useLeadDocuments(leadId: string | undefined) {
  return useQuery({
    queryKey: LEAD_DOCUMENTS_KEY(leadId || ''),
    queryFn: () => leadsApi.getLeadDocuments(leadId!),
    enabled: Boolean(leadId),
    staleTime: 1000 * 15,
  })
}

export function useLeadsList(params?: LeadsQueryParams) {
  return useQuery({
    queryKey: [...LEADS_LIST_KEY, params],
    queryFn: () => leadsApi.listLeads(params),
    staleTime: 1000 * 30,
  })
}

export function useConvertLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: leadsApi.convertLeadToClient,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: LEAD_QUERY_KEY(variables.leadId) })
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: LEADS_LIST_KEY })
    },
  })
}

export function useUpdateLeadWorkspaceStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: leadsApi.updateLeadStage,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(LEAD_QUERY_KEY(variables.id), data.lead)
      queryClient.invalidateQueries({ queryKey: LEAD_QUERY_KEY(variables.id) })
      queryClient.invalidateQueries({ queryKey: LEAD_TASKS_KEY(variables.id) })
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: LEADS_LIST_KEY })
    },
  })
}
