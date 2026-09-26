import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type { Client } from '@/types/client.types'
import type { DocumentItem, DocumentType } from '@/types/document.types'

export interface UploadClientDocumentPayload {
  clientId: string
  file: File
  type: DocumentType
  title?: string
  notes?: string
  leadId?: string
}

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

  getClientDocuments: async (clientId: string): Promise<DocumentItem[]> => {
    const response = await api.get<ApiResponse<{ documents: DocumentItem[] }>>('/documents', {
      params: { clientId },
    })
    return response.data.data?.documents || []
  },

  uploadClientDocument: async ({
    clientId,
    file,
    type,
    title,
    notes,
    leadId,
  }: UploadClientDocumentPayload): Promise<DocumentItem> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('clientId', clientId)
    formData.append('type', type)
    if (title?.trim()) {
      formData.append('title', title.trim())
    }
    if (notes?.trim()) {
      formData.append('notes', notes.trim())
    }
    if (leadId?.trim()) {
      formData.append('leadId', leadId.trim())
    }

    const response = await api.post<ApiResponse<{ document: DocumentItem }>>(
      '/documents/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data.data!.document
  },
}

export const CLIENTS_QUERY_KEY = ['clients']
export const CLIENT_QUERY_KEY = (id: string) => ['client', id]
export const CLIENT_DOCUMENTS_KEY = (clientId: string) => ['client-documents', clientId]
export const MY_CASE_QUERY_KEY = ['my-client-case']

export function useMyCase() {
  return useQuery({
    queryKey: MY_CASE_QUERY_KEY,
    queryFn: clientsApi.getMyCase,
    staleTime: 1000 * 30,
  })
}

export function useClients() {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: clientsApi.getClients,
    staleTime: 1000 * 30,
  })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: CLIENT_QUERY_KEY(id || ''),
    queryFn: () => clientsApi.getClientById(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 30,
  })
}

export function useClientDocuments(clientId: string | undefined) {
  return useQuery({
    queryKey: CLIENT_DOCUMENTS_KEY(clientId || ''),
    queryFn: () => clientsApi.getClientDocuments(clientId!),
    enabled: Boolean(clientId),
    staleTime: 1000 * 15,
  })
}

export function useUploadClientDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: clientsApi.uploadClientDocument,
    onSuccess: (_newDoc, variables) => {
      queryClient.invalidateQueries({
        queryKey: CLIENT_DOCUMENTS_KEY(variables.clientId),
      })
      if (variables.leadId) {
        queryClient.invalidateQueries({
          queryKey: ['lead-documents', variables.leadId],
        })
      }
    },
  })
}
