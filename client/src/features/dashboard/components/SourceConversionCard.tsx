import * as React from 'react'
import { PieChart, Globe, UserCheck, Share2, Layers, Cpu, FileUp } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { SourceConversionMetric } from '../api/dashboard.api'

interface SourceConversionCardProps {
  sourceBreakdown?: SourceConversionMetric[]
}

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  WEBSITE: { label: 'Website Webhooks', icon: Globe },
  MANUAL: { label: 'Direct Intake', icon: UserCheck },
  REFERRAL: { label: 'Partner Referral', icon: Share2 },
  BROKER_PORTAL: { label: 'Broker Portal', icon: Layers },
  EXTERNAL_API: { label: 'External API', icon: Cpu },
  IMPORT: { label: 'File Import', icon: FileUp },
}

export function SourceConversionCard({ sourceBreakdown = [] }: SourceConversionCardProps) {
  const sortedBreakdown = React.useMemo(() => {
    return [...sourceBreakdown].sort((a, b) => (b.count || 0) - (a.count || 0))
  }, [sourceBreakdown])

  const totalInquiries = sortedBreakdown.reduce((acc, curr) => acc + (curr.count || 0), 0)
  const totalWon = sortedBreakdown.reduce((acc, curr) => acc + (curr.wonCount || 0), 0)
  const overallRate = totalInquiries > 0 ? Math.round((totalWon / totalInquiries) * 100) : 0

  return (
    <Card className="transition-all duration-150">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PieChart className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">
                Source Conversion Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Conversion yield and won cases segmented by inbound channel
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Overall Channel Yield:</span>
            <Badge variant="success" size="sm" className="font-semibold">
              {overallRate}% Win Rate
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-2">
        {sortedBreakdown.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No source conversion data recorded yet.
          </div>
        ) : (
          <div className="space-y-3.5">
            {sortedBreakdown.map((item) => {
              const config = SOURCE_CONFIG[item.source] || {
                label: item.source,
                icon: Globe,
              }
              const Icon = config.icon

              return (
                <div key={item.source} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="font-medium text-slate-900 truncate">{config.label}</span>
                      <span className="text-[11px] text-muted-foreground">
                        ({item.wonCount} won / {item.count} total)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900 text-xs">
                        {item.conversionRate}%
                      </span>
                      <Badge
                        variant={item.conversionRate >= 25 ? 'success' : item.conversionRate > 0 ? 'neutral' : 'outline'}
                        size="sm"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {item.wonCount} Converted
                      </Badge>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.conversionRate >= 30
                          ? 'bg-emerald-500'
                          : item.conversionRate >= 15
                          ? 'bg-primary'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(Math.max(item.conversionRate, item.wonCount > 0 ? 5 : 0), 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
