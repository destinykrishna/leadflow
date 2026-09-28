import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface HealthCheckData {
  status: string
  uptime: number
}

export interface HealthStatusResult {
  data: HealthCheckData
  latencyMs: number
  timestamp: string
}

export const healthApi = {
  getHealth: async (): Promise<HealthStatusResult> => {
    const startTime = performance.now()
    const response = await api.get<HealthCheckData>('/health')
    const latencyMs = Math.round(performance.now() - startTime)
    return {
      data: response.data,
      latencyMs,
      timestamp: new Date().toISOString(),
    }
  },
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: healthApi.getHealth,
    refetchInterval: 15000, // Poll every 15s for live status
    staleTime: 10000,
  })
}
