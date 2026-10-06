import * as React from 'react'
import {
  FileSpreadsheet,
  Eye,
  Edit2,
  Copy,
  Check,
  Send,
  Archive,
  Layers,
  Clock,
  Globe,
  Lock,
} from 'lucide-react'
import type { IForm } from '@/types/form.types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatRelativeTime } from '@/lib/format'

interface FormCardProps {
  form: IForm
  canMutate: boolean
  brokerageIdentifier?: string
  onPreview: (form: IForm) => void
  onEdit?: (form: IForm) => void
  onArchive?: (form: IForm) => void
  onToggleStatus?: (form: IForm) => void
}

export function FormCard({
  form,
  canMutate,
  brokerageIdentifier,
  onPreview,
  onEdit,
  onArchive,
  onToggleStatus,
}: FormCardProps) {
  const { showToast } = useToast()
  const [copiedLink, setCopiedLink] = React.useState(false)

  const identifier = brokerageIdentifier || form.brokerageId || 'brokerage'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const publicLink = `${origin}/forms/${identifier}/${form.slug}`

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(publicLink)
    setCopiedLink(true)
    showToast({
      type: 'success',
      title: 'Link Copied',
      message: `Public link for "${form.title}" copied to clipboard.`,
    })
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const isPublished = form.status === 'PUBLISHED'
  const isArchived = form.status === 'ARCHIVED'
  const isDraft = form.status === 'DRAFT'

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm">
      {/* Top Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <FileSpreadsheet className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 truncate tracking-tight">
                  {form.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                <span className="font-mono text-slate-500">/{form.slug}</span>
              </div>
            </div>
          </div>

          <Badge
            variant={
              isPublished
                ? 'success'
                : isDraft
                ? 'warning'
                : 'neutral'
            }
            size="sm"
            className="shrink-0"
          >
            {form.status}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed min-h-[2rem]">
          {form.description || 'No description provided for this intake questionnaire.'}
        </p>

        {/* Metrics Row */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/60 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5 font-medium">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <span>{form.fields.length} {form.fields.length === 1 ? 'Field' : 'Fields'}</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <Send className="h-3.5 w-3.5 text-slate-400" />
            <span>{form.submissionCount} Submissions</span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Updated {formatRelativeTime(form.updatedAt)}</span>
          </div>
        </div>

        {/* Quick Field Summary Tags */}
        {form.fields && form.fields.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {form.fields.slice(0, 4).map((f) => (
              <span
                key={f.fieldKey}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/70"
              >
                {f.label}
              </span>
            ))}
            {form.fields.length > 4 && (
              <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                +{form.fields.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t border-border">
        <div className="flex items-center gap-1.5">
          {/* Copy Public Link */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 text-xs gap-1.5"
            title="Copy public questionnaire link"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-500" />
                <span>Copy Link</span>
              </>
            )}
          </Button>

          {/* Preview */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPreview(form)}
            className="h-8 text-xs gap-1.5"
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            <span>Preview</span>
          </Button>
        </div>

        {/* Admin Mutation Actions */}
        {canMutate && (
          <div className="flex items-center gap-1">
            {/* Quick Publish / Unpublish Toggle */}
            {onToggleStatus && !isArchived && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggleStatus(form)}
                className={`h-8 text-xs gap-1 ${
                  isPublished
                    ? 'text-amber-700 hover:bg-amber-50'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
                title={isPublished ? 'Unpublish form to Draft' : 'Publish form for live intake'}
              >
                {isPublished ? (
                  <>
                    <Lock className="h-3 w-3" />
                    <span>Unpublish</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3 w-3" />
                    <span>Publish</span>
                  </>
                )}
              </Button>
            )}

            {/* Edit Builder */}
            {onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(form)}
                className="h-8 text-xs gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </Button>
            )}

            {/* Archive Action */}
            {onArchive && !isArchived && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onArchive(form)}
                className="h-8 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                title="Archive Form"
              >
                <Archive className="h-3.5 w-3.5" />
                <span className="sr-only">Archive</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
