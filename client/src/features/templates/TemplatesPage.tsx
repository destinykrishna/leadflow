import * as React from 'react'
import {
  Mail,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useEmailTemplates } from './api/templates.api'
import { useTriggers } from '@/features/triggers/api/triggers.api'
import { TriggerNavigationTabs } from '@/features/triggers/components/TriggerNavigationTabs'
import { TemplateMetricsStrip } from './components/TemplateMetricsStrip'
import { TemplateCard } from './components/TemplateCard'
import { EmailPreviewModal } from './components/EmailPreviewModal'
import { TemplateEditorModal } from './components/TemplateEditorModal'
import type { IEmailTemplate } from '@/types/template.types'

export function TemplatesPage() {
  const { user } = useAuth()
  const canMutate = user?.role === 'BROKERAGE_ADMIN' || user?.role === 'PLATFORM_ADMIN'

  const {
    data: templates = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useEmailTemplates()

  const { data: triggers = [] } = useTriggers()

  const [search, setSearch] = React.useState('')
  const [selectedPreview, setSelectedPreview] = React.useState<IEmailTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = React.useState<IEmailTemplate | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)

  // Filter templates by search term
  const filteredTemplates = React.useMemo(() => {
    if (!search.trim()) return templates
    const query = search.toLowerCase()
    return templates.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes(query) ||
        tpl.slug.toLowerCase().includes(query) ||
        tpl.subject.toLowerCase().includes(query) ||
        tpl.body.toLowerCase().includes(query),
    )
  }, [templates, search])

  return (
    <div className="space-y-4">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Email Templates
            </h1>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
              {templates.length} {templates.length === 1 ? 'Template' : 'Templates'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Standardized client communication templates for automated pipeline notifications
          </p>
        </div>

        {canMutate && (
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 self-start sm:self-auto shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Template</span>
          </Button>
        )}
      </div>

      {/* Unified Tab Switcher */}
      <TriggerNavigationTabs triggersCount={triggers.length} templatesCount={templates.length} />

      {/* KPI Metrics Strip */}
      <TemplateMetricsStrip templates={templates} triggers={triggers} />

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name, slug, subject, or placeholder..."
            className="w-full rounded-lg border border-border bg-slate-50/60 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-hidden"
          />
        </div>

        {search && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSearch('')}
            className="h-8 text-xs text-slate-500 hover:text-slate-900"
          >
            Clear Search
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-48 rounded-xl border border-border bg-card p-4 animate-pulse space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-slate-200" />
                <div className="space-y-1">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-20 rounded bg-slate-100" />
                </div>
              </div>
              <div className="h-10 w-full rounded bg-slate-100" />
              <div className="h-12 w-full rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
          <h3 className="text-sm font-bold text-rose-900">Failed to Load Email Templates</h3>
          <p className="text-xs text-rose-600 mt-1">
            {error instanceof Error ? error.message : 'An error occurred while fetching templates.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-3 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            {search ? <SlidersHorizontal className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900">
            {search ? 'No Matching Email Templates' : 'No Email Templates Found'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {search
              ? 'Try searching with a different term or clear the search query.'
              : 'Standardize client notifications with dynamic templates that can be triggered on pipeline moves.'}
          </p>
          {search ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearch('')}
              className="mt-4 text-xs"
            >
              Clear Search
            </Button>
          ) : canMutate ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create First Template</span>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template._id}
              template={template}
              triggers={triggers}
              canMutate={canMutate}
              onPreview={setSelectedPreview}
              onEdit={setEditingTemplate}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <EmailPreviewModal
        isOpen={Boolean(selectedPreview)}
        onClose={() => setSelectedPreview(null)}
        template={selectedPreview}
      />

      {/* Create Modal */}
      {canMutate && (
        <TemplateEditorModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {/* Edit Modal */}
      {canMutate && (
        <TemplateEditorModal
          isOpen={Boolean(editingTemplate)}
          onClose={() => setEditingTemplate(null)}
          template={editingTemplate}
        />
      )}
    </div>
  )
}
