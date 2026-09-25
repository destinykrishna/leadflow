import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Briefcase, Kanban } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ClientDetailView } from './components/ClientDetailView'

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    navigate('/app/clients')
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
            onClick={() => navigate('/app/clients')}
            className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Cases
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
            onClick={() => navigate('/app/clients')}
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Clients & Cases</span>
          </button>

          <ChevronRight className="h-3 w-3 text-slate-400" />

          <span className="font-semibold text-slate-900 truncate max-w-[180px] sm:max-w-xs">
            Case Details
          </span>
        </div>
      </div>

      {/* Main Dedicated Workspace */}
      <ClientDetailView clientId={id} />
    </div>
  )
}
