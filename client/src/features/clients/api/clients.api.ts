import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type { Client } from '@/types/client.types'

export const clientsApi = {
  getClients: async (): Promise<Client[]> => {
    const response = await api.get<ApiResponse<{ clients: Client[] }>>('/clients')
    return response.data.data?.clients || []
  },

  getMyCase: async (): Promise<Client | null> => {
    const response = await api.get<ApiResponse<{ client: Client }>>('/clients/me')
    return response.data.data?.client || null
  },

  getClientById: async (id: string): Promise<Client | null> => {
    const response = await api.get<ApiResponse<{ client: Client }>>(`/clients/${id}`)
    return response.data.data?.client || null
  },
}

export const CLIENTS_QUERY_KEY = ['clients']

export function useClients() {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: clientsApi.getClients,
    staleTime: 1000 * 30,
  })
}
