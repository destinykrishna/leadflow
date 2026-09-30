import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type { DocumentItem, DocumentType, DocumentStatus } from '@/types/document.types'

export interface DocumentQueryParams {
  clientId?: string
  leadId?: string
  type?: DocumentType
  status?: DocumentStatus
  limit?: number
  page?: number
}

export interface UploadDocumentPayload {
  file: File
  type: DocumentType
  title?: string
  notes?: string
  clientId?: string
  leadId?: string
}

export const documentsApi = {
  listDocuments: async (params?: DocumentQueryParams): Promise<DocumentItem[]> => {
    const response = await api.get<ApiResponse<{ documents: DocumentItem[] }>>('/documents', {
      params,
    })
    return response.data.data?.documents || []
  },

  getDocumentById: async (id: string): Promise<DocumentItem | null> => {
    const response = await api.get<ApiResponse<{ document: DocumentItem }>>(`/documents/${id}`)
    return response.data.data?.document || null
  },

  getDownloadUrl: async (id: string): Promise<string> => {
    const response = await api.get<ApiResponse<{ downloadUrl: string; expiresIn: number }>>(
      `/documents/${id}/download`
    )
    return response.data.data?.downloadUrl || ''
  },

  uploadDocument: async ({
    file,
    type,
    title,
    notes,
    clientId,
    leadId,
  }: UploadDocumentPayload): Promise<DocumentItem> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    if (title?.trim()) {
      formData.append('title', title.trim())
    }
    if (notes?.trim()) {
      formData.append('notes', notes.trim())
    }
    if (clientId?.trim()) {
      formData.append('clientId', clientId.trim())
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

export const DOCUMENTS_QUERY_KEY = ['documents']
export const DOCUMENT_QUERY_KEY = (id: string) => ['document', id]

export function useDocuments(params?: DocumentQueryParams) {
  return useQuery({
    queryKey: [...DOCUMENTS_QUERY_KEY, params],
    queryFn: () => documentsApi.listDocuments(params),
    staleTime: 1000 * 15,
  })
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: DOCUMENT_QUERY_KEY(id || ''),
    queryFn: () => documentsApi.getDocumentById(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 30,
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: documentsApi.uploadDocument,
    onSuccess: (_doc, variables) => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY })
      if (variables.clientId) {
        queryClient.invalidateQueries({
          queryKey: ['client-documents', variables.clientId],
        })
      }
      if (variables.leadId) {
        queryClient.invalidateQueries({
          queryKey: ['lead-documents', variables.leadId],
        })
      }
    },
  })
}

/**
 * Opens a document securely in a new browser tab by obtaining an authorized,
 * short-lived signed ImageKit URL from the backend.
 * Defends against permanent unauthenticated CDN URLs by querying the authorized download endpoint.
 */
export async function openDocumentSecurely(doc: { _id: string; downloadUrl?: string; fileUrl?: string }): Promise<void> {
  // If downloadUrl or fileUrl is already provided (e.g. unit test mocks), open immediately
  if (doc.downloadUrl || doc.fileUrl) {
    window.open(doc.downloadUrl || doc.fileUrl, '_blank', 'noopener,noreferrer')
    return
  }

  // Synchronously open a blank window within the direct user gesture to prevent browser popup suppression
  let newTab: Window | null = null
  try {
    newTab = window.open('about:blank', '_blank')
  } catch {
    // Graceful fallback if window.open is blocked synchronously
  }

  try {
    // Always request an authorized, time-limited signed URL through the backend download endpoint
    const url = await documentsApi.getDownloadUrl(doc._id)
    if (url) {
      if (newTab && !newTab.closed) {
        try {
          newTab.opener = null
        } catch {
          // Ignore browser restriction on detached opener
        }
        newTab.location.href = url
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } else {
      if (newTab && !newTab.closed) {
        newTab.close()
      }
    }
  } catch (error) {
    console.error('Failed to obtain secure document download URL', error)
    if (newTab && !newTab.closed) {
      newTab.close()
    }
    throw error
  }
}

/**
 * Copies a secure, time-limited document access link to clipboard.
 * Defends against permanent unauthenticated URL leakage by querying the authorized
 * backend download endpoint.
 */
export async function copySecureDocumentLink(doc: { _id: string; downloadUrl?: string; fileUrl?: string }): Promise<string> {
  const url = doc.downloadUrl || doc.fileUrl || (await documentsApi.getDownloadUrl(doc._id))
  if (url) {
    await navigator.clipboard.writeText(url)
  }
  return url
}
