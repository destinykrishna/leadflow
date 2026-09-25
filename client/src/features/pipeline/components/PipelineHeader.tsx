import { Search, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/format'

interface PipelineHeaderProps {
  totalLeads: number
  totalVolume: number
  search: string
  onSearchChange: (search: string) => void
  onRefresh: () => void
  isLoading?: boolean
}

export function PipelineHeader({
  totalLeads,
  totalVolume,
  search,
  onSearchChange,
  onRefresh,
  isLoading,
}: PipelineHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-border/70">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Pipeline Board</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {totalLeads} {totalLeads === 1 ? 'Lead' : 'Leads'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          7-stage linear qualification workflow from intake to bank funding
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {totalVolume > 0 && (
          <div className="hidden lg:flex flex-col text-right pr-2">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Total Volume
            </span>
            <span className="text-sm font-bold text-slate-900">
              {formatCurrency(totalVolume)}
            </span>
          </div>
        )}

        {/* Search input */}
        <div className="relative flex items-center min-w-[200px] sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search borrower or email..."
            className="h-8.5 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8.5 gap-1.5 text-xs text-slate-600"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    </div>
  )
}
