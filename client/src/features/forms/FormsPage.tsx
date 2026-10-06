import * as React from 'react'
import {
  FileSpreadsheet,
  Plus,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import {
  useForms,
  useUpdateForm,
  useArchiveForm,
} from './api/forms.api'
import { useBrokerageDetails } from '@/features/team/api/team.api'
import { FormMetricsStrip } from './components/FormMetricsStrip'
import { FormCard } from './components/FormCard'
import { FormBuilderModal } from './components/FormBuilderModal'
import { FormPreviewModal } from './components/FormPreviewModal'
import type { IForm, FormStatus } from '@/types/form.types'

export function FormsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const canMutate = user?.role === 'BROKERAGE_ADMIN' || user?.role === 'PLATFORM_ADMIN'

  // Brokerage details for clean slug-based public link
  const { data: brokerage } = useBrokerageDetails(user?.brokerageId)
  const brokerageIdentifier = brokerage?.slug || user?.brokerageId || ''

  // Search and status filter state
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [selectedStatus, setSelectedStatus] = React.useState<FormStatus | 'ALL'>('ALL')

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 200)
    return () => clearTimeout(timer)
  }, [search])

  const {
    data: forms = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useForms({
    status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
    search: debouncedSearch.trim() || undefined,
  })

  // Mutations
  const updateMutation = useUpdateForm()
  const archiveMutation = useArchiveForm()

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [editingForm, setEditingForm] = React.useState<IForm | null>(null)
  const [previewingForm, setPreviewingForm] = React.useState<IForm | null>(null)
  const [formToArchive, setFormToArchive] = React.useState<IForm | null>(null)

  // Toggle publish / unpublish status
  const handleToggleStatus = async (form: IForm) => {
    const newStatus: FormStatus = form.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    try {
      await updateMutation.mutateAsync({
        id: form._id,
        payload: { status: newStatus },
      })
      showToast({
        type: 'success',
        title: newStatus === 'PUBLISHED' ? 'Form Published' : 'Form Unpublished',
        message:
          newStatus === 'PUBLISHED'
            ? `Form "${form.title}" is now published and accepting live leads.`
            : `Form "${form.title}" has been moved to draft status.`,
      })
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err instanceof Error ? err.message : 'Could not change form status',
      })
    }
  }

  // Handle archive confirmation
  const handleConfirmArchive = async () => {
    if (!formToArchive) return
    try {
      await archiveMutation.mutateAsync(formToArchive._id)
      showToast({
        type: 'info',
        title: 'Form Archived',
        message: `Form "${formToArchive.title}" has been archived.`,
      })
      setFormToArchive(null)
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Archive Failed',
        message: err instanceof Error ? err.message : 'Could not archive form',
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Lead Capture Forms
            </h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
              {forms.length} {forms.length === 1 ? 'Form' : 'Forms'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Build custom intake questionnaires with automated lead scoring and pipeline ingestion
          </p>
        </div>

        {canMutate && (
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 self-start sm:self-auto shadow-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>Create Form</span>
          </Button>
        )}
      </div>

      {/* KPI Metrics Strip */}
      <FormMetricsStrip forms={forms} />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search forms by title, slug, or description..."
            className="w-full rounded-lg border border-border bg-slate-50/60 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Status Filter */}
          <div className="w-36">
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as FormStatus | 'ALL')}
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Drafts</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </div>

          {(search || selectedStatus !== 'ALL') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setSelectedStatus('ALL')
              }}
              className="h-8 text-xs text-slate-500 hover:text-slate-900"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-52 rounded-xl border border-border bg-card p-5 animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-36 rounded bg-slate-200" />
                    <div className="h-3 w-20 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-5 w-16 rounded-full bg-slate-100" />
              </div>
              <div className="h-8 w-full rounded bg-slate-100" />
              <div className="h-6 w-3/4 rounded bg-slate-100" />
              <div className="pt-2 flex justify-between border-t border-slate-100">
                <div className="h-8 w-24 rounded bg-slate-100" />
                <div className="h-8 w-16 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Forms"
          message={error instanceof Error ? error.message : 'An error occurred while fetching forms.'}
          onRetry={() => refetch()}
        />
      ) : forms.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-6 w-6" />}
          title={search || selectedStatus !== 'ALL' ? 'No Matching Forms' : 'No Forms Created Yet'}
          description={
            search || selectedStatus !== 'ALL'
              ? 'Try adjusting your search criteria or resetting the status filter.'
              : 'Create customized lead intake questionnaires to capture borrowers and automatically feed leads into your mortgage pipeline.'
          }
          action={
            search || selectedStatus !== 'ALL' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setSelectedStatus('ALL')
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            ) : canMutate ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Form</span>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forms.map((form) => (
            <FormCard
              key={form._id}
              form={form}
              canMutate={canMutate}
              brokerageIdentifier={brokerageIdentifier}
              onPreview={setPreviewingForm}
              onEdit={setEditingForm}
              onArchive={setFormToArchive}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <FormPreviewModal
        isOpen={Boolean(previewingForm)}
        onClose={() => setPreviewingForm(null)}
        form={previewingForm}
        brokerageIdentifier={brokerageIdentifier}
      />

      {/* Create Modal */}
      {canMutate && (
        <FormBuilderModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {/* Edit Modal */}
      {canMutate && (
        <FormBuilderModal
          isOpen={Boolean(editingForm)}
          onClose={() => setEditingForm(null)}
          form={editingForm}
        />
      )}

      {/* Archive Confirmation Modal */}
      {canMutate && (
        <ConfirmModal
          isOpen={Boolean(formToArchive)}
          onClose={() => setFormToArchive(null)}
          onConfirm={handleConfirmArchive}
          title="Archive Form"
          description={`Are you sure you want to archive "${formToArchive?.title}"? The public questionnaire will stop accepting new submissions, but all historical lead entries will be preserved.`}
          confirmLabel="Archive Form"
          variant="warning"
          isLoading={archiveMutation.isPending}
        />
      )}
    </div>
  )
}
