import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Kanban, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LeadDetailView } from './components/LeadDetailView'

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    navigate('/app/pipeline')
    return null
  }

  return (
    <div className="space-y-4">
      {/* Navigation Breadcrumbs & Back Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>

          <span className="text-slate-300">|</span>

          <button
            type="button"
            onClick={() => navigate('/app/pipeline')}
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            <Kanban className="h-3.5 w-3.5" />
            <span>Pipeline</span>
          </button>

          <ChevronRight className="h-3 w-3 text-slate-400" />

          <button
            type="button"
            onClick={() => navigate('/app/leads')}
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Leads</span>
          </button>

          <ChevronRight className="h-3 w-3 text-slate-400" />

          <span className="font-semibold text-slate-900 truncate max-w-[180px] sm:max-w-xs">
            Lead Details
          </span>
        </div>
      </div>

      {/* Main Dedicated Workspace */}
      <LeadDetailView leadId={id} />
    </div>
  )
}
