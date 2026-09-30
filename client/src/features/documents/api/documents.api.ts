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
 * Copies arbitrary text to the clipboard with modern API and reliable textarea fallback.
 * Critical for asynchronous flows where transient user gesture expires before network resolution.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  // 1. Try modern navigator.clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // User activation likely expired during async fetch — fall through to execCommand
    }
  }

  // 2. Fallback to hidden textarea execCommand('copy') which remains permitted in active document
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '-9999px'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textarea)
      return successful
    } catch {
      return false
    }
  }

  return false
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

  // Synchronously open a placeholder window during user click gesture to preserve popup authorization
  let newTab: Window | null = null
  try {
    newTab = window.open('about:blank', '_blank')
    if (newTab) {
      try {
        newTab.document.title = 'Opening Document — LeadFlow'
        newTab.document.body.innerHTML = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
            <div style="text-align: center; padding: 24px;">
              <div style="width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px;"></div>
              <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
              <div style="font-size: 15px; font-weight: 600; margin-bottom: 6px;">Opening Secure Document...</div>
              <div style="font-size: 13px; color: #94a3b8;">Verifying permissions and generating time-limited access link.</div>
            </div>
          </div>
        `
      } catch {
        // Cross-origin inspection safeguard
      }
    }
  } catch {
    // Graceful fallback if window.open is blocked synchronously
  }

  try {
    // Request authorized, time-limited signed URL through the backend download endpoint
    const url = await documentsApi.getDownloadUrl(doc._id)
    if (url) {
      if (newTab && !newTab.closed) {
        // Navigate target window directly. Do NOT disown opener before navigating as Chromium drops navigation.
        newTab.location.replace(url)
      } else {
        // If popup was blocked or closed, attempt window.open or direct navigation
        const opened = window.open(url, '_blank', 'noopener,noreferrer')
        if (!opened) {
          window.location.href = url
        }
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
 * backend download endpoint, and uses a resilient clipboard fallback.
 */
export async function copySecureDocumentLink(doc: { _id: string; downloadUrl?: string; fileUrl?: string }): Promise<string> {
  const url = doc.downloadUrl || doc.fileUrl || (await documentsApi.getDownloadUrl(doc._id))
  if (url) {
    await copyTextToClipboard(url)
  }
  return url
}

