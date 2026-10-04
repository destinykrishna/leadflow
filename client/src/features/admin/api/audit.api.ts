import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  PaginatedActivitiesResponse,
  ActivityAction,
  ActivityEntityType,
} from '@/types/activity.types';

export interface AuditLogsQueryParams {
  page?: number;
  limit?: number;
  action?: ActivityAction;
  entityType?: ActivityEntityType;
  brokerageId?: string;
}

export interface TimelineQueryParams {
  page?: number;
  limit?: number;
}

export const auditApi = {
  getAuditLogs: async (params?: AuditLogsQueryParams): Promise<PaginatedActivitiesResponse> => {
    const response = await api.get<PaginatedActivitiesResponse>('/audit-logs', { params });
    return response.data;
  },

  getLeadTimeline: async (
    leadId: string,
    params?: TimelineQueryParams
  ): Promise<PaginatedActivitiesResponse> => {
    const response = await api.get<PaginatedActivitiesResponse>(`/leads/${leadId}/timeline`, {
      params,
    });
    return response.data;
  },

  getClientTimeline: async (
    clientId: string,
    params?: TimelineQueryParams
  ): Promise<PaginatedActivitiesResponse> => {
    const response = await api.get<PaginatedActivitiesResponse>(`/clients/${clientId}/timeline`, {
      params,
    });
    return response.data;
  },
};

export function useAuditLogs(params?: AuditLogsQueryParams) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditApi.getAuditLogs(params),
    staleTime: 15_000,
  });
}

export function useLeadTimeline(leadId?: string, params?: TimelineQueryParams) {
  return useQuery({
    queryKey: ['lead-timeline', leadId, params],
    queryFn: () => auditApi.getLeadTimeline(leadId!, params),
    enabled: Boolean(leadId),
    staleTime: 10_000,
  });
}

export function useClientTimeline(clientId?: string, params?: TimelineQueryParams) {
  return useQuery({
    queryKey: ['client-timeline', clientId, params],
    queryFn: () => auditApi.getClientTimeline(clientId!, params),
    enabled: Boolean(clientId),
    staleTime: 10_000,
  });
}
