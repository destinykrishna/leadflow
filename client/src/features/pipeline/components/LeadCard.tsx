import { User, Phone, Mail, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatRelativeTime } from '@/lib/format'
import type { Lead } from '@/types/pipeline.types'

interface LeadCardProps {
  lead: Lead
  onClick?: () => void
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const loanAmount = Number(lead.customFields?.loanAmount)
  const isHighValue = loanAmount >= 500000

  return (
    <Card
      onClick={onClick}
      className="group relative cursor-pointer border border-border/80 bg-card p-3.5 shadow-2xs transition-all duration-150 hover:border-slate-400 hover:shadow-xs select-none"
    >
      <div className="space-y-2.5">
        {/* Borrower Name & Source Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-900 group-hover:text-primary transition-colors truncate">
              {lead.firstName} {lead.lastName}
            </span>
          </div>

          {lead.source && (
            <Badge variant="neutral" size="sm" className="text-[10px] shrink-0 font-normal">
              {lead.source.toLowerCase()}
            </Badge>
          )}
        </div>

        {/* Loan Amount & Financial Metrics */}
        {loanAmount > 0 && (
          <div className="flex items-baseline justify-between rounded-md bg-slate-50/80 px-2.5 py-1.5 border border-slate-100">
            <span className="text-[11px] text-muted-foreground">Target Loan</span>
            <span
              className={`text-xs font-bold ${
                isHighValue ? 'text-primary' : 'text-slate-900'
              }`}
            >
              {formatCurrency(loanAmount)}
            </span>
          </div>
        )}

        {/* Contact info snippets */}
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 truncate">
            <Mail className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate">{lead.email}</span>
          </div>
          {lead.phone && (
            <div className="flex items-center gap-1.5 truncate">
              <Phone className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{lead.phone}</span>
            </div>
          )}
        </div>

        {/* Footer: Score & Age */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-medium text-slate-600">Score:</span>
            <span
              className={`font-semibold ${
                lead.score >= 70
                  ? 'text-emerald-600'
                  : lead.score >= 40
                  ? 'text-amber-600'
                  : 'text-slate-500'
              }`}
            >
              {lead.score}
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <Clock className="h-3 w-3" />
            <span>{formatRelativeTime(lead.createdAt)}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
