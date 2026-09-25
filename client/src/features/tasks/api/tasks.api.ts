import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import type { Task } from '@/types/task.types'

export const tasksApi = {
  getTasks: async (): Promise<{ tasks: Task[]; total: number }> => {
    const response = await api.get<ApiResponse<{ tasks: Task[]; total: number }>>('/tasks')
    return response.data.data || { tasks: [], total: 0 }
  },
}

export const TASKS_QUERY_KEY = ['tasks']

export function useTasks() {
  return useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: tasksApi.getTasks,
    staleTime: 1000 * 30,
  })
}
