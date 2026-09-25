import { useNavigate } from 'react-router-dom'
import { Clock, User } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatRelativeTime } from '@/lib/format'
import { STAGE_DEFINITIONS, type Lead } from '@/types/pipeline.types'

interface RecentActivityCardProps {
  recentLeads: Lead[]
}

export function RecentActivityCard({ recentLeads }: RecentActivityCardProps) {
  const navigate = useNavigate()

  return (
    <Card className="h-full">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Recent Inquiries & Leads
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Latest borrower submissions and stage progressions
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/pipeline')}
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-1">
        {recentLeads.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No recent lead activity recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {recentLeads.map((lead) => {
              const stageDef = STAGE_DEFINITIONS[lead.status] || {
                label: lead.status,
                badgeVariant: 'neutral',
              }
              const loanAmount = Number(lead.customFields?.loanAmount)

              return (
                <div
                  key={lead._id}
                  onClick={() => navigate('/app/pipeline')}
                  className="flex items-center justify-between py-3 cursor-pointer group transition-colors hover:bg-slate-50/70 px-2 rounded-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900 group-hover:text-primary transition-colors truncate">
                          {lead.firstName} {lead.lastName}
                        </span>
                        {lead.source && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-medium text-slate-600 uppercase">
                            {lead.source.toLowerCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {lead.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {loanAmount > 0 && (
                      <span className="hidden sm:inline-block text-xs font-bold text-slate-800">
                        {formatCurrency(loanAmount)}
                      </span>
                    )}

                    <Badge variant={stageDef.badgeVariant} size="sm">
                      {stageDef.label}
                    </Badge>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 min-w-[55px] justify-end">
                      <Clock className="h-3 w-3" />
                      <span>{formatRelativeTime(lead.createdAt)}</span>
                    </div>
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
