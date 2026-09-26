import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type { Task, TaskStatus } from '@/types/task.types'
import {
  validateForm,
  validateApiResponse,
  updateTaskStatusSchema,
  taskListResponseSchema,
} from '@/lib/validation'

export interface TaskQueryParams {
  status?: TaskStatus
  assignedTo?: string
  leadId?: string
  clientId?: string
  isOverdue?: boolean | string
  limit?: number
  page?: number
}

export interface TasksListResult {
  tasks: Task[]
  total: number
}

export const tasksApi = {
  getTasks: async (params?: TaskQueryParams): Promise<TasksListResult> => {
    const response = await api.get<ApiResponse<Task[] | { tasks: Task[]; total?: number }>>('/tasks', {
      params,
    })

    const rawData = response.data.data

    // Handle both array response (real backend format) and legacy object envelope
    if (Array.isArray(rawData)) {
      const validatedTasks = validateApiResponse(taskListResponseSchema, rawData, 'tasksApi.getTasks')
      return {
        tasks: validatedTasks as Task[],
        total: response.data.count ?? validatedTasks.length,
      }
    }

    if (rawData && typeof rawData === 'object' && 'tasks' in rawData && Array.isArray(rawData.tasks)) {
      const validatedTasks = validateApiResponse(taskListResponseSchema, rawData.tasks, 'tasksApi.getTasks')
      return {
        tasks: validatedTasks as Task[],
        total: rawData.total ?? validatedTasks.length,
      }
    }

    return { tasks: [], total: 0 }
  },

  getTaskById: async (id: string): Promise<Task> => {
    const response = await api.get<ApiResponse<Task>>(`/tasks/${id}`)
    return response.data.data!
  },

  updateTaskStatus: async (taskId: string, status: TaskStatus): Promise<Task> => {
    // 1. Frontend Zod validation on mutation payload
    const validation = validateForm(updateTaskStatusSchema, { status })
    if (!validation.success) {
      throw new Error(validation.message || 'Invalid task status update payload')
    }

    // 2. Transmit to backend
    const response = await api.patch<ApiResponse<Task>>(`/tasks/${taskId}`, {
      status: validation.data.status,
    })

    return response.data.data!
  },
}

export const TASKS_QUERY_KEY = ['tasks']
export const TASK_DETAIL_QUERY_KEY = (id: string) => ['tasks', id]

export function useTasks(params?: TaskQueryParams) {
  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, params],
    queryFn: () => tasksApi.getTasks(params),
    staleTime: 1000 * 30, // 30s
  })
}

export function useTask(id?: string) {
  return useQuery({
    queryKey: id ? TASK_DETAIL_QUERY_KEY(id) : ['tasks', 'none'],
    queryFn: () => tasksApi.getTaskById(id!),
    enabled: Boolean(id),
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      tasksApi.updateTaskStatus(taskId, status),
    onSuccess: (updatedTask) => {
      // Invalidate tasks lists and specific task query
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: TASK_DETAIL_QUERY_KEY(updatedTask._id) })
      // Invalidate dashboard and lead details so task cards update
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}
