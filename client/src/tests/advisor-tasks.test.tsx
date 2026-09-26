import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Task } from '@/types/task.types'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'
import * as AuthHook from '@/hooks/useAuth'
import * as TasksApi from '@/features/tasks/api/tasks.api'
import { TasksPage } from '@/features/tasks/TasksPage'
import {
  validateForm,
  validateApiResponse,
  updateTaskStatusSchema,
  taskFilterSchema,
  taskListResponseSchema,
  formatZodError,
} from '@/lib/validation'
import { z } from 'zod'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}))

describe('Phase 5 — Prompt 1: Advisor Tasks + Frontend Zod', () => {
  let queryClient: QueryClient

  const mockAdvisor: AuthUser = {
    id: 'advisor-1',
    email: 'rajesh@leadflow.in',
    name: 'Rajesh Sharma',
    role: 'ADVISOR',
    status: 'ACTIVE',
    brokerageId: 'brokerage-1',
  }

  const createMockAuth = (user: AuthUser | null): AuthContextValue => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  })

  // Reference dates for testing due calculations
  const now = new Date()
  const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0).toISOString()
  const yesterdayIso = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
  const nextWeekIso = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString()

  const sampleTasks: Task[] = [
    {
      _id: 'task-1',
      brokerageId: 'brokerage-1',
      title: 'Verify Aadhaar & PAN KYC for Vikram Malhotra',
      description: 'Check government ID credentials and CIBIL score verification before bank loan application.',
      status: 'PENDING',
      priority: 'URGENT',
      dueDate: yesterdayIso,
      isOverdue: true,
      assignedTo: {
        _id: 'advisor-1',
        name: 'Rajesh Sharma',
        email: 'rajesh@leadflow.in',
        role: 'ADVISOR',
      },
      leadId: {
        _id: 'lead-1',
        firstName: 'Vikram',
        lastName: 'Malhotra',
        email: 'vikram@example.in',
        status: 'QUALIFIED',
      },
      createdAt: new Date(now.getTime() - 48 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 48 * 3600 * 1000).toISOString(),
    },
    {
      _id: 'task-2',
      brokerageId: 'brokerage-1',
      title: 'Follow up on SBI Home Loan Sanction Letter',
      description: 'Contact HDFC / SBI loan processing officer regarding rate discount.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: todayIso,
      isOverdue: false,
      assignedTo: {
        _id: 'advisor-1',
        name: 'Rajesh Sharma',
        email: 'rajesh@leadflow.in',
        role: 'ADVISOR',
      },
      clientId: {
        _id: 'client-1',
        firstName: 'Priya',
        lastName: 'Patel',
        email: 'priya@example.in',
      },
      createdAt: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 12 * 3600 * 1000).toISOString(),
    },
    {
      _id: 'task-3',
      brokerageId: 'brokerage-1',
      title: 'Collect Salary Slips & Form 16 from Amit Verma',
      description: 'Need last 3 months payslips and 2 years ITR for loan underwriting.',
      status: 'PENDING',
      priority: 'MEDIUM',
      dueDate: nextWeekIso,
      isOverdue: false,
      assignedTo: {
        _id: 'advisor-2',
        name: 'Ananya Verma',
        email: 'ananya@leadflow.in',
        role: 'ADVISOR',
      },
      leadId: {
        _id: 'lead-2',
        firstName: 'Amit',
        lastName: 'Verma',
        email: 'amit@example.in',
        status: 'CONTACTED',
      },
      createdAt: new Date(now.getTime() - 10 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 10 * 3600 * 1000).toISOString(),
    },
    {
      _id: 'task-4',
      brokerageId: 'brokerage-1',
      title: 'Brokerage internal audit of loan portfolio',
      description: 'Monthly reconciliation of disbursed loans and bank commissions.',
      status: 'COMPLETED',
      priority: 'LOW',
      dueDate: yesterdayIso,
      isOverdue: false,
      assignedTo: {
        _id: 'advisor-1',
        name: 'Rajesh Sharma',
        email: 'rajesh@leadflow.in',
        role: 'ADVISOR',
      },
      completedAt: new Date().toISOString(),
      createdAt: new Date(now.getTime() - 72 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
  })

  describe('1. Frontend Zod Validation Utility & Reusable Schemas', () => {
    it('validates valid task status mutation payload successfully', () => {
      const validPending = validateForm(updateTaskStatusSchema, { status: 'PENDING' })
      expect(validPending.success).toBe(true)
      if (validPending.success) {
        expect(validPending.data.status).toBe('PENDING')
      }

      const validCompleted = validateForm(updateTaskStatusSchema, { status: 'COMPLETED' })
      expect(validCompleted.success).toBe(true)
      if (validCompleted.success) {
        expect(validCompleted.data.status).toBe('COMPLETED')
      }
    })

    it('rejects invalid task status with clear field errors', () => {
      const invalid = validateForm(updateTaskStatusSchema, { status: 'INVALID_STATUS' })
      expect(invalid.success).toBe(false)
      if (!invalid.success) {
        expect(invalid.errors.status).toBeDefined()
        expect(invalid.message).toBeTruthy()
      }
    })

    it('validates task filter query schema with defaults and boundary checks', () => {
      const res = validateForm(taskFilterSchema, {
        search: '  SBI Home Loan  ',
        status: 'PENDING',
        priority: 'HIGH',
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.search).toBe('SBI Home Loan')
        expect(res.data.status).toBe('PENDING')
        expect(res.data.dueCategory).toBe('ALL') // Default applied
      }
    })

    it('validates API response against taskListResponseSchema', () => {
      const parsed = validateApiResponse(taskListResponseSchema, sampleTasks, 'Test Tasks')
      expect(parsed).toBeDefined()
      expect(parsed.length).toBe(sampleTasks.length)
      expect(parsed[0].title).toBe('Verify Aadhaar & PAN KYC for Vikram Malhotra')
    })

    it('formats nested Zod errors with flattened path keys', () => {
      const nestedSchema = z.object({
        user: z.object({
          email: z.string().email('Invalid email address'),
        }),
      })
      const result = nestedSchema.safeParse({ user: { email: 'not-an-email' } })
      expect(result.success).toBe(false)
      if (!result.success) {
        const formatted = formatZodError(result.error)
        expect(formatted['user.email']).toBe('Invalid email address')
      }
    })
  })

  describe('2. Tasks Workspace Rendering & Real Data Metrics Strip', () => {
    it('renders task list header, KPI metric strip, and automated scheduling banner', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      // Header title and count
      await waitFor(() => {
        expect(screen.getByText('Advisor Action Items & Tasks')).toBeInTheDocument()
        expect(screen.getByText(/^4 Tasks$/i)).toBeInTheDocument()
      })

      // Automated scheduling banner
      expect(screen.getByText(/Automated Pipeline Scheduling:/i)).toBeInTheDocument()

      // KPI Metric Cards
      expect(screen.getByText('Total Tasks')).toBeInTheDocument()
      expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Due Today').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1)

      // Task items
      expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      expect(screen.getByText('Follow up on SBI Home Loan Sanction Letter')).toBeInTheDocument()
      expect(screen.getByText('Collect Salary Slips & Form 16 from Amit Verma')).toBeInTheDocument()
      expect(screen.getByText('Brokerage internal audit of loan portfolio')).toBeInTheDocument()
    })

    it('displays assigned advisors with "You" badge when matching current user', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getAllByText('Rajesh Sharma').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Ananya Verma')).toBeInTheDocument()
      })

      // "You" badge for currently logged-in advisor (Rajesh Sharma)
      const youBadges = screen.getAllByText('You')
      expect(youBadges.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('3. Timeline & Due Date Classification (Overdue, Due Today, Upcoming)', () => {
    it('clearly distinguishes overdue tasks with prominent warning badges', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        const overdueBadges = screen.getAllByTestId('badge-overdue')
        expect(overdueBadges.length).toBeGreaterThanOrEqual(1)
        expect(overdueBadges[0]).toHaveTextContent(/Overdue/i)
      })
    })

    it('clearly distinguishes due-today tasks with amber clock badges', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        const dueTodayBadges = screen.getAllByTestId('badge-due-today')
        expect(dueTodayBadges.length).toBeGreaterThanOrEqual(1)
        expect(dueTodayBadges[0]).toHaveTextContent('Due Today')
      })
    })

    it('clearly distinguishes upcoming tasks with upcoming due badges', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        const upcomingBadges = screen.getAllByTestId('badge-upcoming')
        expect(upcomingBadges.length).toBeGreaterThanOrEqual(1)
        expect(upcomingBadges[0]).toHaveTextContent(/Due/i)
      })
    })
  })

  describe('4. Search & Multi-Dimensional Filtering', () => {
    it('filters tasks by text search across title, description, borrower name, and advisor', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search by task title/i)

      // Search by borrower name "Vikram"
      fireEvent.change(searchInput, { target: { value: 'Vikram' } })
      expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      expect(screen.queryByText('Follow up on SBI Home Loan Sanction Letter')).not.toBeInTheDocument()

      // Search by bank keyword "SBI"
      fireEvent.change(searchInput, { target: { value: 'SBI' } })
      expect(screen.getByText('Follow up on SBI Home Loan Sanction Letter')).toBeInTheDocument()
      expect(screen.queryByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).not.toBeInTheDocument()
    })

    it('filters tasks by due category dropdown (Overdue Only)', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      })

      const dueSelect = screen.getByLabelText(/Filter by due timeline/i)
      fireEvent.change(dueSelect, { target: { value: 'OVERDUE' } })

      // Only the overdue task should be shown
      expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      expect(screen.queryByText('Follow up on SBI Home Loan Sanction Letter')).not.toBeInTheDocument()
      expect(screen.queryByText('Collect Salary Slips & Form 16 from Amit Verma')).not.toBeInTheDocument()
    })

    it('filters tasks by scope (Assigned to Me)', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Collect Salary Slips & Form 16 from Amit Verma')).toBeInTheDocument()
      })

      const scopeSelect = screen.getByLabelText(/Filter by task assignment scope/i)
      fireEvent.change(scopeSelect, { target: { value: 'MY_TASKS' } })

      // Tasks assigned to Rajesh Sharma should show; Amit Verma's task (assigned to Ananya) should hide
      expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      expect(screen.getByText('Follow up on SBI Home Loan Sanction Letter')).toBeInTheDocument()
      expect(screen.queryByText('Collect Salary Slips & Form 16 from Amit Verma')).not.toBeInTheDocument()
    })

    it('resets all filters when Reset Filters button is clicked', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search by task title/i)
      fireEvent.change(searchInput, { target: { value: 'Nonexistent query' } })

      // Shows empty filter state with clear button
      expect(screen.getByText('No Tasks Match Your Filters')).toBeInTheDocument()

      const clearBtn = screen.getByRole('button', { name: /Clear Active Filters/i })
      fireEvent.click(clearBtn)

      // All tasks restored
      expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      expect(screen.getByText('Follow up on SBI Home Loan Sanction Letter')).toBeInTheDocument()
    })
  })

  describe('5. Entity Workspace Navigation', () => {
    it('navigates to associated lead workspace on clicking lead button', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/app/tasks']}>
            <Routes>
              <Route path="/app/tasks" element={<TasksPage />} />
              <Route path="/app/leads/:id" element={<div>Lead Workspace Page for Lead-1</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Lead: Vikram Malhotra')).toBeInTheDocument()
      })

      const leadBtn = screen.getByTitle('Open Lead: Vikram Malhotra')
      fireEvent.click(leadBtn)

      await waitFor(() => {
        expect(screen.getByText('Lead Workspace Page for Lead-1')).toBeInTheDocument()
      })
    })

    it('navigates to associated client case workspace on clicking client button', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/app/tasks']}>
            <Routes>
              <Route path="/app/tasks" element={<TasksPage />} />
              <Route path="/app/clients/:id" element={<div>Client Case Workspace for Client-1</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Case: Priya Patel')).toBeInTheDocument()
      })

      const caseBtn = screen.getByTitle('Open Case: Priya Patel')
      fireEvent.click(caseBtn)

      await waitFor(() => {
        expect(screen.getByText('Client Case Workspace for Client-1')).toBeInTheDocument()
      })
    })
  })

  describe('6. Task Status Mutations & Detail Modal Actions', () => {
    it('toggles task completion with 1-click checkbox calling updateTaskStatus', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })
      const updateSpy = vi.spyOn(TasksApi.tasksApi, 'updateTaskStatus').mockResolvedValue({
        ...sampleTasks[0],
        status: 'COMPLETED',
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      })

      const completeBtn = screen.getByLabelText(/Complete task Verify Aadhaar & PAN KYC/i)
      fireEvent.click(completeBtn)

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith('task-1', 'COMPLETED')
      })
    })

    it('updates status directly from row dropdown selector', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })
      const updateSpy = vi.spyOn(TasksApi.tasksApi, 'updateTaskStatus').mockResolvedValue({
        ...sampleTasks[0],
        status: 'IN_PROGRESS',
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      })

      const statusSelect = screen.getByLabelText(/Update status for Verify Aadhaar & PAN KYC/i)
      fireEvent.change(statusSelect, { target: { value: 'IN_PROGRESS' } })

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith('task-1', 'IN_PROGRESS')
      })
    })

    it('opens TaskDetailModal on row click and supports modal action buttons', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: sampleTasks,
        total: sampleTasks.length,
      })
      const updateSpy = vi.spyOn(TasksApi.tasksApi, 'updateTaskStatus').mockResolvedValue({
        ...sampleTasks[0],
        status: 'COMPLETED',
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Verify Aadhaar & PAN KYC for Vikram Malhotra')).toBeInTheDocument()
      })

      // Click row to open modal
      const taskRow = screen.getByTestId('task-row-task-1')
      fireEvent.click(taskRow)

      // Verify modal content directly in dialog portal
      await waitFor(() => {
        const dialog = document.querySelector('[role="dialog"]')
        expect(dialog).not.toBeNull()
        expect(dialog?.textContent).toContain('Verify Aadhaar & PAN KYC for Vikram Malhotra')
        expect(dialog?.textContent).toContain('Check government ID credentials')
        expect(dialog?.textContent).toContain('Associated Inbound Lead')
      })

      const dialog = document.querySelector('[role="dialog"]') as HTMLElement
      const markCompletedBtn = within(dialog).getByRole('button', { name: /Mark Completed/i })
      fireEvent.click(markCompletedBtn)

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith('task-1', 'COMPLETED')
      })
    })
  })

  describe('7. Empty and Error States', () => {
    it('renders empty state when brokerage has 0 tasks', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockResolvedValue({
        tasks: [],
        total: 0,
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('No Operational Tasks Scheduled')).toBeInTheDocument()
        expect(screen.getByText('Go to Pipeline Board')).toBeInTheDocument()
      })
    })

    it('renders error state with retry on network failure', async () => {
      vi.spyOn(TasksApi.tasksApi, 'getTasks').mockRejectedValue(new Error('Network error 500'))

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Tasks')).toBeInTheDocument()
        expect(screen.getByText('Network error 500')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      })
    })
  })
})
