import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  X,
  Mail,
  Copy,
  Check,
  Code,
  Eye,
  Building,
  User,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  renderTemplatePreview,
  SAMPLE_TEMPLATE_CONTEXT,
} from '../lib/templatePreview'

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  template: {
    name: string
    slug?: string
    subject: string
    body: string
    variables?: string[]
  } | null
}

export function EmailPreviewModal({ isOpen, onClose, template }: EmailPreviewModalProps) {
  const [viewMode, setViewMode] = React.useState<'rendered' | 'raw'>('rendered')
  const [copied, setCopied] = React.useState(false)

  if (!template) return null

  const renderedSubject = renderTemplatePreview(template.subject)
  const renderedBody = renderTemplatePreview(template.body)

  const handleCopyBody = () => {
    navigator.clipboard.writeText(viewMode === 'rendered' ? renderedBody : template.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in-0" />
        <Dialog.Content
          aria-describedby="email-preview-desc"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-900 leading-tight">
                  {template.name}
                </Dialog.Title>
                <div className="flex items-center gap-2 mt-1">
                  {template.slug && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {template.slug}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Automated Pipeline Dispatch Preview
                  </span>
                </div>
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

          <p id="email-preview-desc" className="sr-only">
            Preview the rendered email with sample Indian borrower data and available placeholders.
          </p>

          {/* View Mode Toggle & Sample Data Banner */}
          <div className="flex items-center justify-between py-3 border-b border-border text-xs">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('rendered')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'rendered'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Rendered Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'raw'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code className="h-3.5 w-3.5" />
                <span>Raw Placeholders</span>
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyBody}
              className="h-7 text-xs gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Text</span>
                </>
              )}
            </Button>
          </div>

          {/* Email Preview Container */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Metadata Card (To/From/Subject) */}
            <div className="rounded-lg border border-border bg-slate-50/70 p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 w-16 shrink-0">From:</span>
                <span className="text-slate-800 font-medium flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  {SAMPLE_TEMPLATE_CONTEXT.brokerage.name} &lt;notifications@leadflow.in&gt;
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 w-16 shrink-0">To:</span>
                <span className="text-slate-800 font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {SAMPLE_TEMPLATE_CONTEXT.lead.fullName} &lt;{SAMPLE_TEMPLATE_CONTEXT.lead.email}&gt;
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/80">
                <span className="font-semibold text-slate-500 w-16 shrink-0">Subject:</span>
                <span className="text-slate-900 font-bold">
                  {viewMode === 'rendered' ? renderedSubject : template.subject}
                </span>
              </div>
            </div>

            {/* Email Body Content */}
            <div className="rounded-lg border border-border bg-white p-5 text-sm leading-relaxed shadow-2xs min-h-[160px]">
              {viewMode === 'rendered' ? (
                <div
                  className="prose prose-sm max-w-none text-slate-800"
                  dangerouslySetInnerHTML={{ __html: renderedBody.replace(/\n/g, '<br />') }}
                />
              ) : (
                <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-md border border-slate-200">
                  {template.body}
                </pre>
              )}
            </div>

            {/* Indian Context Legend */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-800">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Simulated preview rendered with Indian borrower: <strong>{SAMPLE_TEMPLATE_CONTEXT.lead.fullName}</strong> ({SAMPLE_TEMPLATE_CONTEXT.lead.email}), Advisor: <strong>{SAMPLE_TEMPLATE_CONTEXT.advisor.name}</strong>, Brokerage: <strong>{SAMPLE_TEMPLATE_CONTEXT.brokerage.name}</strong>.
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-border flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close Preview
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
