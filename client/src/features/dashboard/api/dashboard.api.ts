import { usePipeline } from '@/features/pipeline/api/pipeline.api'
import { useClients } from '@/features/clients/api/clients.api'
import { useTasks } from '@/features/tasks/api/tasks.api'
import { ORDERED_STAGES, STAGE_DEFINITIONS, type Lead, type LeadStatus } from '@/types/pipeline.types'

export interface DashboardMetrics {
  totalLeads: number
  activePipelineCount: number
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
    badgeVariant: 'neutral' | 'default' | 'success' | 'warning' | 'danger'
  }>
  recentLeads: Lead[]
}

export function useDashboardData() {
  const pipelineQuery = usePipeline()
  const clientsQuery = useClients()
  const tasksQuery = useTasks()

  const isLoading = pipelineQuery.isLoading || clientsQuery.isLoading || tasksQuery.isLoading
  const isError = pipelineQuery.isError || clientsQuery.isError
  const error = pipelineQuery.error || clientsQuery.error

  const refetch = () => {
    pipelineQuery.refetch()
    clientsQuery.refetch()
    tasksQuery.refetch()
  }

  // Calculate KPIs and stage breakdown from real backend data
  const pipelineData = pipelineQuery.data
  const clients = clientsQuery.data || []
  const tasks = tasksQuery.data?.tasks || []

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

  // Calculate total pipeline value and stage breakdowns
  let totalPipelineValue = 0
  const allLeads: Lead[] = []

  if (pipelineData?.pipeline) {
    Object.values(pipelineData.pipeline).forEach((stageLeads) => {
      stageLeads.forEach((lead) => {
        allLeads.push(lead)
        const loan = Number(lead.customFields?.loanAmount) || 0
        totalPipelineValue += loan
      })
    })
  }

  // Sort leads by newest first for recent activity
  const recentLeads = [...allLeads].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ).slice(0, 7)

  // Stage breakdown
  const stageBreakdown = ORDERED_STAGES.map((stage) => {
    const stageLeads = pipelineData?.pipeline?.[stage] || []
    const count = counts[stage] || 0
    const percentage = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
    const totalVolume = stageLeads.reduce(
      (sum, lead) => sum + (Number(lead.customFields?.loanAmount) || 0),
      0,
    )

    return {
      stage,
      label: STAGE_DEFINITIONS[stage].label,
      count,
      percentage,
      totalVolume,
      badgeVariant: STAGE_DEFINITIONS[stage].badgeVariant,
    }
  })

  const metrics: DashboardMetrics = {
    totalLeads,
    activePipelineCount,
    qualifiedLeadsCount,
    wonCasesCount,
    activeClientsCount,
    totalPipelineValue,
    conversionRate,
    stageBreakdown,
    recentLeads,
  }

  return {
    metrics,
    tasks,
    isLoading,
    isError,
    error,
    refetch,
  }
}
