import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/Toast'
import { useAutomationSocket } from '@/features/triggers/hooks/useAutomationSocket'
import * as SocketLib from '@/lib/socket'

function TestAutomationConsumer() {
  useAutomationSocket(true)
  return <div>Automation Feedback Listener Active</div>
}

describe('Automation Execution Feedback — Live Toasts & Query Invalidation', () => {
  let queryClient: QueryClient
  let socketEventHandlers: Record<string, (payload: unknown) => void>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    socketEventHandlers = {}

    // Mock useSocketEvent to capture registered listeners
    vi.spyOn(SocketLib, 'useSocketEvent').mockImplementation((eventName, handler) => {
      socketEventHandlers[eventName] = handler as (payload: unknown) => void
    })
  })

  it('displays a success toast and invalidates tasks cache when automation:task_created fires', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TestAutomationConsumer />
        </ToastProvider>
      </QueryClientProvider>,
    )

    expect(screen.getByText('Automation Feedback Listener Active')).toBeInTheDocument()

    // Simulate backend automation:task_created event
    act(() => {
      socketEventHandlers['automation:task_created']?.({
        brokerageId: 'brok-1',
        leadId: 'lead-123',
        taskId: 'task-456',
        taskTitle: 'Verify CIBIL score',
        assignedToName: 'Priya Patel',
        message: 'Task created and assigned to Priya Patel.',
      })
    })

    // Assert toast appears
    expect(screen.getByText('Task Automation')).toBeInTheDocument()
    expect(screen.getByText('Task created and assigned to Priya Patel.')).toBeInTheDocument()

    // Assert query invalidation triggered for tasks
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tasks'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['lead-tasks', 'lead-123'] })
  })

  it('displays an info toast when automation:email_queued fires', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TestAutomationConsumer />
        </ToastProvider>
      </QueryClientProvider>,
    )

    act(() => {
      socketEventHandlers['automation:email_queued']?.({
        brokerageId: 'brok-1',
        leadId: 'lead-123',
        triggerId: 'trig-1',
        recipient: 'Rahul Sharma (r***a@example.com)',
        message: 'Email queued to Rahul Sharma (r***a@example.com).',
      })
    })

    expect(screen.getByText('Email Automation')).toBeInTheDocument()
    expect(
      screen.getByText('Email queued to Rahul Sharma (r***a@example.com).'),
    ).toBeInTheDocument()
  })

  it('displays a success toast with delivery confirmation when automation:email_sent fires', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TestAutomationConsumer />
        </ToastProvider>
      </QueryClientProvider>,
    )

    act(() => {
      socketEventHandlers['automation:email_sent']?.({
        brokerageId: 'brok-1',
        leadId: 'lead-123',
        jobId: 'job-999',
        recipient: 'Rahul Sharma (r***a@example.com)',
        messageId: 'msg-id-12345',
        message: 'Email sent to Rahul Sharma (r***a@example.com).',
      })
    })

    expect(screen.getByText('Email Confirmed')).toBeInTheDocument()
    expect(
      screen.getByText('Email sent to Rahul Sharma (r***a@example.com).'),
    ).toBeInTheDocument()
  })

  it('displays an error toast when automation:email_failed fires', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TestAutomationConsumer />
        </ToastProvider>
      </QueryClientProvider>,
    )

    act(() => {
      socketEventHandlers['automation:email_failed']?.({
        brokerageId: 'brok-1',
        leadId: 'lead-123',
        jobId: 'job-999',
        recipient: 'Rahul Sharma (r***a@example.com)',
        error: 'SMTP Connection timeout',
        message: 'Email delivery failed to Rahul Sharma (r***a@example.com).',
      })
    })

    expect(screen.getByText('Email Delivery Failed')).toBeInTheDocument()
    expect(
      screen.getByText('Email delivery failed to Rahul Sharma (r***a@example.com).'),
    ).toBeInTheDocument()
  })
})
