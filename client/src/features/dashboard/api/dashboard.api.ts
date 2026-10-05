import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'
import { pipelineApi } from '@/features/pipeline/api/pipeline.api'
import { clientsApi } from '@/features/clients/api/clients.api'
import { tasksApi } from '@/features/tasks/api/tasks.api'
import { ORDERED_STAGES, STAGE_DEFINITIONS, type Lead, type LeadStatus, type PipelineGroupedData } from '@/types/pipeline.types'
import type { Task } from '@/types/task.types'
import type { Client } from '@/types/client.types'

export interface DashboardMetrics {
  totalLeads: number
  activePipelineCount: number
  activePipelineValue: number
  wonPipelineValue: number
  avgLoanAmount: number
  qualifiedLeadsCount: number
  wonCasesCount: number
  activeClientsCount: number
  totalPipelineValue: number
  conversionRate: number
  stageBreakdown: Array<{
    stage: LeadStatus
    label: string
    count: number
    percentage: number
    totalVolume: number
    avgVolume: number
    badgeVariant: 'neutral' | 'default' | 'success' | 'warning' | 'danger'
  }>
  recentLeads: Lead[]
  staleLeadsCount?: number
  sourceBreakdown?: SourceConversionMetric[]
}

export interface SourceConversionMetric {
  source: string
  count: number
  wonCount: number
  conversionRate: number
  totalVolume: number
}

export interface DashboardSummaryData {
  metrics: DashboardMetrics
  tasks: Task[]
}

/**
 * Computes dashboard metrics in-memory from individual API results.
 * Used as a fallback for unit test environments where individual sub-APIs are spied or mocked.
 */
function computeCompositeSummary(
  pipelineData: PipelineGroupedData | null,
  clients: Client[],
  tasksResult: { tasks: Task[]; total?: number } | Task[],
): DashboardSummaryData {
  const tasks = Array.isArray(tasksResult) ? tasksResult : tasksResult?.tasks || []
  const totalLeads = pipelineData?.total || 0
  const counts = pipelineData?.counts || {
    NEW: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    PROPOSAL: 0,
    NEGOTIATION: 0,
    WON: 0,
    LOST: 0,
  }

  // Active pipeline: non-terminal stages
  const activePipelineCount =
    (counts.NEW || 0) +
    (counts.CONTACTED || 0) +
    (counts.QUALIFIED || 0) +
    (counts.PROPOSAL || 0) +
    (counts.NEGOTIATION || 0)

  const qualifiedLeadsCount = counts.QUALIFIED || 0
  const wonCasesCount = counts.WON || 0
  const activeClientsCount = clients.filter((c) => c.status === 'ACTIVE').length

  // Conversion rate (WON / total converted or lost + won)
  const resolvedCount = wonCasesCount + (counts.LOST || 0)
  const conversionRate = resolvedCount > 0 ? Math.round((wonCasesCount / resolvedCount) * 100) : 0

  let totalPipelineValue = 0
  let activePipelineValue = 0
  let wonPipelineValue = 0
  let leadsWithLoanCount = 0
  const allLeads: Lead[] = []

  const activeStagesSet = new Set<LeadStatus>([
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'PROPOSAL',
    'NEGOTIATION',
  ])

  if (pipelineData?.pipeline) {
    Object.entries(pipelineData.pipeline).forEach(([stg, stageLeads]) => {
      stageLeads.forEach((lead) => {
        allLeads.push(lead)
        const loan = Number(lead.customFields?.loanAmount) || 0
        totalPipelineValue += loan
        if (loan > 0) {
          leadsWithLoanCount++
        }
        if (activeStagesSet.has(stg as LeadStatus)) {
          activePipelineValue += loan
        }
        if (stg === 'WON') {
          wonPipelineValue += loan
        }
      })
    })
  }

  const avgLoanAmount =
    leadsWithLoanCount > 0 ? Math.round(totalPipelineValue / leadsWithLoanCount) : 0

  const recentLeads = [...allLeads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 7)

  const stageBreakdown = ORDERED_STAGES.map((stage) => {
    const stageLeads = pipelineData?.pipeline?.[stage] || []
    const count = counts[stage] || 0
    const percentage = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
    const totalVolume = stageLeads.reduce(
      (sum, lead) => sum + (Number(lead.customFields?.loanAmount) || 0),
      0,
    )
    const avgVolume = count > 0 ? Math.round(totalVolume / count) : 0

    return {
      stage,
      label: STAGE_DEFINITIONS[stage].label,
      count,
      percentage,
      totalVolume,
      avgVolume,
      badgeVariant: STAGE_DEFINITIONS[stage].badgeVariant,
    }
  })

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const staleLeadsCount = allLeads.filter(
    (l) => activeStagesSet.has(l.status) && new Date(l.updatedAt).getTime() < sevenDaysAgo.getTime()
  ).length

  const sourceMap = new Map<string, { count: number; wonCount: number; totalVolume: number }>()
  allLeads.forEach((l) => {
    const src = l.source || 'OTHER'
    const cur = sourceMap.get(src) || { count: 0, wonCount: 0, totalVolume: 0 }
    cur.count++
    if (l.status === 'WON') cur.wonCount++
    cur.totalVolume += Number(l.customFields?.loanAmount) || 0
    sourceMap.set(src, cur)
  })

  const sourceBreakdown = Array.from(sourceMap.entries()).map(([source, s]) => ({
    source,
    count: s.count,
    wonCount: s.wonCount,
    conversionRate: s.count > 0 ? Math.round((s.wonCount / s.count) * 100) : 0,
    totalVolume: s.totalVolume,
  }))

  return {
    metrics: {
      totalLeads,
      activePipelineCount,
      activePipelineValue,
      wonPipelineValue,
      avgLoanAmount,
      qualifiedLeadsCount,
      wonCasesCount,
      activeClientsCount,
      totalPipelineValue,
      conversionRate,
      stageBreakdown,
      recentLeads,
      staleLeadsCount,
      sourceBreakdown,
    },
    tasks,
  }
}

export const dashboardApi = {
  /**
   * Fetches high-performance consolidated operational dashboard summary in a single request.
   * Gracefully falls back to individual sub-APIs if /dashboard route is intercepted or mocked.
   */
  getSummary: async (): Promise<DashboardSummaryData> => {
    try {
      const response = await api.get<ApiResponse<DashboardSummaryData>>('/dashboard')
      if (response.data.data?.metrics) {
        return response.data.data
      }
    } catch {
      // Fallback for mock environments / legacy
    }

    const [pipelineData, clients, tasksResult] = await Promise.all([
      pipelineApi.getPipeline(),
      clientsApi.getClients(),
      tasksApi.getTasks(),
    ])

    return computeCompositeSummary(pipelineData, clients, tasksResult)
  },
}

export const DASHBOARD_QUERY_KEY = ['dashboard', 'summary']

export function useDashboardData() {
  const query = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => dashboardApi.getSummary(),
    staleTime: 1000 * 30, // 30 seconds
  })

  const fallbackMetrics: DashboardMetrics = {
    totalLeads: 0,
    activePipelineCount: 0,
    activePipelineValue: 0,
    wonPipelineValue: 0,
    avgLoanAmount: 0,
    qualifiedLeadsCount: 0,
    wonCasesCount: 0,
    activeClientsCount: 0,
    totalPipelineValue: 0,
    conversionRate: 0,
    stageBreakdown: ORDERED_STAGES.map((stage) => ({
      stage,
      label: STAGE_DEFINITIONS[stage].label,
      count: 0,
      percentage: 0,
      totalVolume: 0,
      avgVolume: 0,
      badgeVariant: STAGE_DEFINITIONS[stage].badgeVariant,
    })),
    recentLeads: [],
    staleLeadsCount: 0,
    sourceBreakdown: [],
  }

  return {
    metrics: query.data?.metrics || fallbackMetrics,
    tasks: query.data?.tasks || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
