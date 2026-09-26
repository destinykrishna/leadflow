import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSocketEvent } from '@/lib/socket'
import type { DocumentStatus } from '@/types/document.types'
import { DOCUMENTS_QUERY_KEY } from '../api/documents.api'
import { CLIENT_DOCUMENTS_KEY } from '@/features/clients/api/clients.api'
import { LEAD_DOCUMENTS_KEY } from '@/features/leads/api/leads.api'

export interface DocumentStatusChangedPayload {
  documentId: string
  brokerageId: string
  clientId?: string
  leadId?: string
  uploadedBy?: string
  previousStatus: DocumentStatus
  newStatus: DocumentStatus
  type: string
  title: string
  updatedAt: string | Date
}

export function useDocumentSocket(options?: {
  clientId?: string
  leadId?: string
  enabled?: boolean
}) {
  const queryClient = useQueryClient()
  const enabled = options?.enabled ?? true

  const handleDocumentStatusChanged = React.useCallback(
    (payload: DocumentStatusChangedPayload) => {
      // 1. Invalidate global documents query
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY })

      // 2. Invalidate client-specific documents if matching or present
      if (payload.clientId) {
        queryClient.invalidateQueries({
          queryKey: CLIENT_DOCUMENTS_KEY(payload.clientId),
        })
      }
      if (options?.clientId) {
        queryClient.invalidateQueries({
          queryKey: CLIENT_DOCUMENTS_KEY(options.clientId),
        })
      }

      // 3. Invalidate lead-specific documents if matching or present
      if (payload.leadId) {
        queryClient.invalidateQueries({
          queryKey: LEAD_DOCUMENTS_KEY(payload.leadId),
        })
      }
      if (options?.leadId) {
        queryClient.invalidateQueries({
          queryKey: LEAD_DOCUMENTS_KEY(options.leadId),
        })
      }
    },
    [queryClient, options?.clientId, options?.leadId]
  )

  useSocketEvent<DocumentStatusChangedPayload>(
    'document:status_changed',
    handleDocumentStatusChanged,
    enabled
  )
}
