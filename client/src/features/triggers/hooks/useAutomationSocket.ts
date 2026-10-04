import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSocketEvent } from '@/lib/socket'
import { useToast } from '@/components/ui/Toast'

export interface AutomationTaskCreatedPayload {
  brokerageId: string
  leadId: string
  taskId: string
  taskTitle: string
  assignedToName: string
  message: string
}

export interface AutomationEmailQueuedPayload {
  brokerageId: string
  leadId: string
  triggerId: string
  recipient: string
  message: string
}

export interface AutomationEmailSentPayload {
  brokerageId: string
  leadId: string
  jobId: string
  recipient: string
  messageId: string
  message: string
}

export interface AutomationEmailFailedPayload {
  brokerageId: string
  leadId: string
  jobId: string
  recipient: string
  error: string
  message: string
}

export interface AutomationEmailDeliveredPayload {
  brokerageId: string
  leadId?: string
  messageId: string
  recipient: string
  message: string
}

export interface AutomationEmailBouncedPayload {
  brokerageId: string
  leadId?: string
  messageId: string
  recipient: string
  reason?: string
  message: string
}

/**
 * Listens for real-time automation feedback from background trigger execution,
 * BullMQ email worker delivery confirmations, and Resend delivery/bounce webhooks,
 * showing live toast notices and invalidating task/email queries.
 */
export function useAutomationSocket(enabled: boolean = true) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const handleTaskCreated = React.useCallback(
    (payload: AutomationTaskCreatedPayload) => {
      showToast({
        type: 'success',
        title: 'Task Automation',
        message: payload.message,
      })

      // Invalidate tasks cache to immediately reflect the new task in the UI
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (payload.leadId) {
        queryClient.invalidateQueries({ queryKey: ['lead-tasks', payload.leadId] })
      }
    },
    [queryClient, showToast],
  )

  const handleEmailQueued = React.useCallback(
    (payload: AutomationEmailQueuedPayload) => {
      showToast({
        type: 'info',
        title: 'Email Automation',
        message: payload.message,
      })
    },
    [showToast],
  )

  const handleEmailSent = React.useCallback(
    (payload: AutomationEmailSentPayload) => {
      showToast({
        type: 'success',
        title: 'Email Confirmed',
        message: payload.message,
      })

      if (payload.leadId) {
        queryClient.invalidateQueries({ queryKey: ['lead-emails', payload.leadId] })
      }
    },
    [queryClient, showToast],
  )

  const handleEmailFailed = React.useCallback(
    (payload: AutomationEmailFailedPayload) => {
      showToast({
        type: 'error',
        title: 'Email Delivery Failed',
        message: payload.message,
      })

      if (payload.leadId) {
        queryClient.invalidateQueries({ queryKey: ['lead-emails', payload.leadId] })
      }
    },
    [queryClient, showToast],
  )

  const handleEmailDelivered = React.useCallback(
    (payload: AutomationEmailDeliveredPayload) => {
      showToast({
        type: 'success',
        title: 'Email Delivered',
        message: payload.message,
      })

      if (payload.leadId) {
        queryClient.invalidateQueries({ queryKey: ['lead-emails', payload.leadId] })
      }
    },
    [queryClient, showToast],
  )

  const handleEmailBounced = React.useCallback(
    (payload: AutomationEmailBouncedPayload) => {
      showToast({
        type: 'error',
        title: 'Email Bounced',
        message: payload.message,
      })

      if (payload.leadId) {
        queryClient.invalidateQueries({ queryKey: ['lead-emails', payload.leadId] })
      }
    },
    [queryClient, showToast],
  )

  useSocketEvent<AutomationTaskCreatedPayload>(
    'automation:task_created',
    handleTaskCreated,
    enabled,
  )

  useSocketEvent<AutomationEmailQueuedPayload>(
    'automation:email_queued',
    handleEmailQueued,
    enabled,
  )

  useSocketEvent<AutomationEmailSentPayload>(
    'automation:email_sent',
    handleEmailSent,
    enabled,
  )

  useSocketEvent<AutomationEmailFailedPayload>(
    'automation:email_failed',
    handleEmailFailed,
    enabled,
  )

  useSocketEvent<AutomationEmailDeliveredPayload>(
    'automation:email_delivered',
    handleEmailDelivered,
    enabled,
  )

  useSocketEvent<AutomationEmailBouncedPayload>(
    'automation:email_bounced',
    handleEmailBounced,
    enabled,
  )
}
