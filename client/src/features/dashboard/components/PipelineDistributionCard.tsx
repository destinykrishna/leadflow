import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/format'
import type { DashboardMetrics } from '../api/dashboard.api'

interface PipelineDistributionCardProps {
  metrics: DashboardMetrics
}

const STAGE_BAR_COLORS: Record<string, string> = {
  NEW: 'bg-slate-300',
  CONTACTED: 'bg-blue-400',
  QUALIFIED: 'bg-blue-600',
  PROPOSAL: 'bg-amber-400',
  NEGOTIATION: 'bg-indigo-500',
  WON: 'bg-emerald-500',
  LOST: 'bg-rose-400',
}

export function PipelineDistributionCard({ metrics }: PipelineDistributionCardProps) {
  const navigate = useNavigate()

  return (
    <Card className="transition-all duration-150">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Pipeline Stage Distribution
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Current borrower volume across all 7 linear qualification stages
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Total Pipeline:</span>
            <span className="text-xs font-bold text-slate-900">
              {formatCurrency(metrics.totalPipelineValue)}
            </span>
            <Badge variant="success" size="sm" className="font-semibold">
              {metrics.conversionRate}% Won Rate
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-2 space-y-5">
        {/* Segmented Progress Bar */}
        {metrics.totalLeads > 0 ? (
          <div className="space-y-1.5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 shadow-2xs gap-0.5">
              {metrics.stageBreakdown.map((item) => {
                if (item.count === 0) return null
                return (
                  <div
                    key={item.stage}
                    style={{ width: `${Math.max(item.percentage, 3)}%` }}
                    className={`h-full rounded-sm transition-all duration-300 ${
                      STAGE_BAR_COLORS[item.stage] || 'bg-slate-400'
                    }`}
                    title={`${item.label}: ${item.count} leads (${item.percentage}%)`}
                  />
                )
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
              <span>Intake (New)</span>
              <span>Linear Advisory Stages</span>
              <span>Outcome (Won / Lost)</span>
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-slate-50 py-3 text-center text-xs text-muted-foreground">
            No pipeline leads recorded yet.
          </div>
        )}

        {/* Detailed Stage Table / Breakdown */}
        <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
          {metrics.stageBreakdown.map((item) => (
            <div
              key={item.stage}
              className="flex items-center justify-between p-3 text-xs transition-colors hover:bg-slate-50/80"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    STAGE_BAR_COLORS[item.stage] || 'bg-slate-400'
                  }`}
                />
                <div className="flex flex-col truncate">
                  <span className="font-semibold text-slate-900 truncate">{item.label}</span>
                  <span className="text-[11px] text-muted-foreground">Stage ID: {item.stage}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                <div className="text-right">
                  <span className="font-semibold text-slate-900">{item.count}</span>
                  <span className="text-[11px] text-muted-foreground ml-1">
                    ({item.percentage}%)
                  </span>
                </div>

                <div className="hidden sm:block text-right min-w-[90px]">
                  <span className="font-semibold text-slate-700">
                    {formatCurrency(item.totalVolume)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/app/pipeline')}
                  className="rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
                  title={`View ${item.label} leads in Pipeline`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
