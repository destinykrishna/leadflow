import { Search, RotateCw, X, Filter, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/format'
import { ORDERED_STAGES, STAGE_DEFINITIONS, type LeadStatus } from '@/types/pipeline.types'

interface PipelineHeaderProps {
  totalLeads: number
  totalVolume: number
  search: string
  onSearchChange: (search: string) => void
  sourceFilter: string
  onSourceFilterChange: (source: string) => void
  minLoanFilter: number
  onMinLoanFilterChange: (minLoan: number) => void
  sortBy: string
  onSortByChange: (sort: string) => void
  onClearFilters: () => void
  isFiltered: boolean
  stageCounts?: Record<LeadStatus, number>
  onJumpToStage: (stage: LeadStatus) => void
  onRefresh: () => void
  isLoading?: boolean
}

export function PipelineHeader({
  totalLeads,
  totalVolume,
  search,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  minLoanFilter,
  onMinLoanFilterChange,
  sortBy,
  onSortByChange,
  onClearFilters,
  isFiltered,
  stageCounts,
  onJumpToStage,
  onRefresh,
  isLoading,
}: PipelineHeaderProps) {
  return (
    <div className="space-y-2.5 pb-2 border-b border-border/70">
      {/* Top row: Title, Total Volume & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Pipeline Board</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {totalLeads} {totalLeads === 1 ? 'Lead' : 'Leads'}
          </span>
          {isFiltered && (
            <span className="rounded-full bg-blue-50 text-primary border border-blue-200 px-2 py-0.5 text-[11px] font-medium">
              Filtered
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {totalVolume > 0 && (
            <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1 border border-slate-200/80">
              <span className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
                Volume:
              </span>
              <span className="text-xs font-bold text-slate-900">
                {formatCurrency(totalVolume)}
              </span>
            </div>
          )}

          {/* Search input */}
          <div className="relative flex items-center min-w-[180px] sm:min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search borrower or email..."
              className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Source filter */}
          <div className="relative flex items-center">
            <Filter className="pointer-events-none absolute left-2.5 h-3 w-3 text-slate-400" />
            <select
              value={sourceFilter}
              onChange={(e) => onSourceFilterChange(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card pl-7 pr-6 text-xs text-foreground font-medium transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
            >
              <option value="">All Sources</option>
              <option value="WEBSITE">Website</option>
              <option value="REFERRAL">Referral</option>
              <option value="ZILLOW">Zillow</option>
              <option value="REALTOR">Realtor</option>
              <option value="CAMPAIGN">Campaign</option>
              <option value="MANUAL">Manual</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Loan Volume threshold filter */}
          <select
            value={minLoanFilter}
            onChange={(e) => onMinLoanFilterChange(Number(e.target.value))}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground font-medium transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="0">All Loan Sizes</option>
            <option value="250000">≥ ₹2,50,000</option>
            <option value="500000">≥ ₹5,00,000 (Jumbo)</option>
          </select>

          {/* Sort By selector */}
          <div className="relative flex items-center">
            <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3 w-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card pl-7 pr-6 text-xs text-foreground font-medium transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
            >
              <option value="default">Newest Inquiries</option>
              <option value="loan-desc">Highest Loan</option>
              <option value="score-desc">Highest Score</option>
              <option value="oldest">Oldest Inquiries</option>
            </select>
          </div>

          {/* Clear Filters Reset */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-9 px-2 text-xs text-slate-500 hover:text-slate-800"
            >
              Reset
            </Button>
          )}

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs text-slate-600"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stage Quick-Jump Strip for rapid keyboard/mouse navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs scrollbar-none">
        <span className="text-[11px] font-semibold text-muted-foreground mr-1 shrink-0">
          Jump to:
        </span>
        {ORDERED_STAGES.map((stg) => {
          const count = stageCounts?.[stg] ?? 0
          return (
            <button
              key={stg}
              type="button"
              onClick={() => onJumpToStage(stg)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0 border border-transparent hover:border-slate-200"
            >
              <span>{STAGE_DEFINITIONS[stg].label}</span>
              <span className="rounded-full bg-slate-200/80 px-1.5 py-0.1 text-[10px] font-semibold text-slate-700">
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
