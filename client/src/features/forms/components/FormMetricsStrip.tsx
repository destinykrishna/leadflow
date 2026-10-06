import { ClipboardList, CheckCircle2, FileEdit, Send } from 'lucide-react'
import type { IForm } from '@/types/form.types'

interface FormMetricsStripProps {
  forms: IForm[]
}

export function FormMetricsStrip({ forms }: FormMetricsStripProps) {
  const total = forms.length
  const publishedCount = forms.filter((f) => f.status === 'PUBLISHED').length
  const draftCount = forms.filter((f) => f.status === 'DRAFT').length
  const totalSubmissions = forms.reduce((acc, f) => acc + (f.submissionCount || 0), 0)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
      {/* 1. Total Forms */}
      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Total Forms</span>
          <ClipboardList className="h-4 w-4 text-slate-500" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{total}</div>
        <span className="text-[10px] text-muted-foreground mt-0.5">Lead intake library</span>
      </div>

      {/* 2. Published */}
      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-emerald-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Published</span>
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{publishedCount}</div>
        <span className="text-[10px] text-emerald-600/80 mt-0.5">Accepting live leads</span>
      </div>

      {/* 3. Drafts */}
      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-amber-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Drafts</span>
          <FileEdit className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-amber-700">{draftCount}</div>
        <span className="text-[10px] text-amber-600/80 mt-0.5">In configuration</span>
      </div>

      {/* 4. Total Submissions */}
      <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between text-blue-600">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Submissions</span>
          <Send className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-blue-700">{totalSubmissions}</div>
        <span className="text-[10px] text-blue-600/80 mt-0.5">Total captured leads</span>
      </div>
    </div>
  )
}
