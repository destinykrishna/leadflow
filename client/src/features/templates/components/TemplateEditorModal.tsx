import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  X,
  Mail,
  Loader2,
  AlertCircle,
  Eye,
  PlusCircle,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCreateEmailTemplate, useUpdateEmailTemplate } from '../api/templates.api'
import type { IEmailTemplate } from '@/types/template.types'
import {
  AVAILABLE_TEMPLATE_VARIABLES,
  renderTemplatePreview,
  extractPlaceholders,
} from '../lib/templatePreview'
import {
  validateForm,
  createEmailTemplateFormSchema,
  updateEmailTemplateFormSchema,
} from '@/lib/validation'

interface TemplateEditorModalProps {
  isOpen: boolean
  onClose: () => void
  template?: IEmailTemplate | null
}

export function TemplateEditorModal({
  isOpen,
  onClose,
  template,
}: TemplateEditorModalProps) {
  const isEditing = Boolean(template)
  const createMutation = useCreateEmailTemplate()
  const updateMutation = useUpdateEmailTemplate()

  const [name, setName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [showPreview, setShowPreview] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [serverError, setServerError] = React.useState<string | null>(null)

  const bodyInputRef = React.useRef<HTMLTextAreaElement>(null)

  // Populate form if editing
  React.useEffect(() => {
    if (template) {
      setName(template.name)
      setSlug(template.slug)
      setSubject(template.subject)
      setBody(template.body)
    } else {
      setName('')
      setSlug('')
      setSubject('')
      setBody('')
    }
    setErrors({})
    setServerError(null)
    setShowPreview(false)
  }, [template, isOpen])

  // Auto-generate slug from name in create mode
  const handleNameChange = (val: string) => {
    setName(val)
    if (!isEditing) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setSlug(generatedSlug)
    }
  }

  // Insert variable token into textarea
  const handleInsertVariable = (token: string) => {
    const textarea = bodyInputRef.current
    if (!textarea) {
      setBody((prev) => prev + ' ' + token)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newBody = body.substring(0, start) + token + body.substring(end)
    setBody(newBody)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + token.length, start + token.length)
    }, 50)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    // Automatically compute variables from placeholders found in subject + body
    const detectedVariables = extractPlaceholders(subject + ' ' + body)

    const payload = {
      name,
      slug,
      subject,
      body,
      variables: detectedVariables,
      isActive: true,
    }

    const schema = isEditing ? updateEmailTemplateFormSchema : createEmailTemplateFormSchema
    const validation = validateForm(schema, payload)

    if (!validation.success) {
      setErrors(validation.errors)
      return
    }

    setErrors({})

    try {
      if (isEditing && template) {
        await updateMutation.mutateAsync({
          id: template._id,
          payload,
        })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save email template'
      setServerError(msg)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in-0" />
        <Dialog.Content
          aria-describedby="template-editor-desc"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-hidden max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-900 leading-tight">
                  {isEditing ? 'Edit Email Template' : 'New Email Template'}
                </Dialog.Title>
                <p id="template-editor-desc" className="text-xs text-muted-foreground mt-0.5">
                  Standardized client communication templates for pipeline notifications
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {serverError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Name & Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="template-name" className="block text-xs font-semibold text-slate-700">
                  Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Proposal Ready Notification"
                  className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden"
                />
                {errors.name && <p className="text-[11px] text-rose-600 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="template-slug" className="block text-xs font-semibold text-slate-700">
                  Slug (Identifier) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="template-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="e.g. proposal-ready-notification"
                  disabled={isEditing}
                  className={`mt-1 block w-full font-mono rounded-lg border border-border px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden ${
                    isEditing ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                  }`}
                />
                {errors.slug && <p className="text-[11px] text-rose-600 mt-1">{errors.slug}</p>}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="template-subject" className="block text-xs font-semibold text-slate-700">
                Email Subject Line <span className="text-rose-500">*</span>
              </label>
              <input
                id="template-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Your Home Loan Proposal is Ready, {{lead.firstName}}!"
                className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden"
              />
              {errors.subject && <p className="text-[11px] text-rose-600 mt-1">{errors.subject}</p>}
            </div>

            {/* Placeholders Quick-Insert Toolbar */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Available Placeholders</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Click token to insert into body
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {AVAILABLE_TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => handleInsertVariable(v.token)}
                    className="inline-flex items-center gap-1 rounded bg-white hover:bg-primary/5 hover:border-primary/40 px-2 py-1 text-[11px] font-mono text-slate-700 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
                    title={`${v.description} (e.g. ${v.sampleValue})`}
                  >
                    <PlusCircle className="h-3 w-3 text-slate-400" />
                    <span>{v.token}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="template-body" className="block text-xs font-semibold text-slate-700">
                  Email Body (HTML / Text) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{showPreview ? 'Hide Live Preview' : 'Show Live Preview'}</span>
                </button>
              </div>
              <textarea
                id="template-body"
                ref={bodyInputRef}
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="<p>Dear {{lead.firstName}},</p><p>We have processed your mortgage application for {{brokerage.name}}. Your advisor {{advisor.name}} will contact you shortly.</p>"
                className="block w-full font-mono rounded-lg border border-border bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden resize-y"
              />
              {errors.body && <p className="text-[11px] text-rose-600 mt-1">{errors.body}</p>}
            </div>

            {/* Live Render Preview Accordion */}
            {showPreview && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Live Render Preview (Sample: Rahul Sharma)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Apex Home Finance</span>
                </div>
                <div className="rounded-md border border-border bg-white p-3 shadow-2xs">
                  <div className="text-xs font-bold text-slate-900 pb-1 mb-2 border-b border-slate-100">
                    Subject: {renderTemplatePreview(subject) || '(No subject entered)'}
                  </div>
                  <div
                    className="prose prose-xs max-w-none text-slate-700"
                    dangerouslySetInnerHTML={{
                      __html: renderTemplatePreview(body).replace(/\n/g, '<br />') || '<em>(No body entered)</em>',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{isEditing ? 'Save Changes' : 'Create Template'}</span>
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
