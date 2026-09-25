import { useNavigate } from 'react-router-dom'
import {
  Users,
  TrendingUp,
  CheckCircle2,
  Award,
  Briefcase,
  RotateCw,
  ArrowRight,
  PlusCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDashboardData } from './api/dashboard.api'
import { KpiCard } from './components/KpiCard'
import { PipelineDistributionCard } from './components/PipelineDistributionCard'
import { RecentActivityCard } from './components/RecentActivityCard'
import { PendingTasksCard } from './components/PendingTasksCard'

export function DashboardPage() {
  const navigate = useNavigate()
  const { metrics, tasks, isLoading, isError, error, refetch } = useDashboardData()

  if (isError) {
    return (
      <div className="py-8">
        <ErrorState
          title="Operations Metrics Unavailable"
          message={
            error instanceof Error
              ? error.message
              : 'Failed to retrieve live dashboard metrics. Please check network connectivity and try again.'
          }
          onRetry={refetch}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Page Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Operations Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time pipeline health, borrower qualification volume, and operational tasks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-1.5 text-xs text-slate-600"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/app/pipeline')}
            className="gap-1.5 text-xs font-semibold"
          >
            <span>Open Pipeline</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-border bg-card p-6 space-y-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="rounded-lg border border-border bg-card p-6 space-y-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      ) : metrics.totalLeads === 0 && metrics.activeClientsCount === 0 ? (
        /* Empty State when no data exists */
        <EmptyState
          icon={<PlusCircle className="h-8 w-8 text-slate-400" />}
          title="No Pipeline Records Yet"
          description="Your brokerage pipeline is currently empty. Leads ingested from website webhooks, campaigns, or manual entries will appear here with real-time stage tracking."
          action={
            <Button onClick={() => navigate('/app/pipeline')} size="sm">
              Go to Pipeline Board
            </Button>
          }
        />
      ) : (
        /* Real Operational Dashboard */
        <div className="space-y-6">
          {/* 5 Core KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <KpiCard
              title="Total Leads"
              value={metrics.totalLeads}
              subtitle="All registered inquiries"
              icon={Users}
            />

            <KpiCard
              title="Active Pipeline"
              value={metrics.activePipelineCount}
              subtitle="In advisory workflow"
              icon={TrendingUp}
            />

            <KpiCard
              title="Pre-Qualified"
              value={metrics.qualifiedLeadsCount}
              subtitle="Verified for proposals"
              icon={CheckCircle2}
            />

            <KpiCard
              title="Won Cases"
              value={metrics.wonCasesCount}
              subtitle="Approved & converted"
              icon={Award}
              badgeText={`${metrics.conversionRate}% rate`}
            />

            <KpiCard
              title="Active Clients"
              value={metrics.activeClientsCount}
              subtitle="Case profiles open"
              icon={Briefcase}
            />
          </div>

          {/* Pipeline Stage Distribution Card */}
          <PipelineDistributionCard metrics={metrics} />

          {/* Lower Two-Column Section: Recent Inquiries + Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentActivityCard recentLeads={metrics.recentLeads} />
            <PendingTasksCard tasks={tasks} />
          </div>
        </div>
      )}
    </div>
  )
}
