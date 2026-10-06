import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import {
  Copy,
  Check,
  RotateCcw,
  Send,
  Eye,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import type { IForm, IFormField } from '@/types/form.types'

interface FormPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  form: IForm | null
  brokerageIdentifier?: string
}

export function FormPreviewModal({
  isOpen,
  onClose,
  form,
  brokerageIdentifier,
}: FormPreviewModalProps) {
  const { showToast } = useToast()
  const [formData, setFormData] = React.useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [isSubmitted, setIsSubmitted] = React.useState(false)
  const [copiedLink, setCopiedLink] = React.useState(false)

  // Reset form inputs when opened or form changes
  React.useEffect(() => {
    if (isOpen) {
      setFormData({})
      setFieldErrors({})
      setIsSubmitted(false)
      setCopiedLink(false)
    }
  }, [isOpen, form])

  if (!form) return null

  // Sort fields by order property
  const sortedFields: IFormField[] = [...form.fields].sort((a, b) => a.order - b.order)

  const identifier = brokerageIdentifier || form.brokerageId || 'brokerage'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const publicLink = `${origin}/forms/${identifier}/${form.slug}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink)
    setCopiedLink(true)
    showToast({
      type: 'success',
      title: 'Link Copied',
      message: 'Public form link copied to clipboard.',
    })
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const handleInputChange = (fieldKey: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }))
    if (fieldErrors[fieldKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[fieldKey]
        return next
      })
    }
  }

  const handlePreviewSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields in local interactive preview
    const errors: Record<string, string> = {}
    for (const field of sortedFields) {
      if (field.required && !formData[field.fieldKey]?.trim()) {
        errors[field.fieldKey] = `${field.label} is required`
      } else if (field.type === 'email' && formData[field.fieldKey]?.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData[field.fieldKey].trim())) {
          errors[field.fieldKey] = 'Please enter a valid email address'
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitted(true)
  }

  const handleResetPreview = () => {
    setFormData({})
    setFieldErrors({})
    setIsSubmitted(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-slate-50/60 max-h-[92dvh] flex flex-col">
        {/* Header Bar */}
        <div className="border-b border-border bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-slate-900 leading-tight">
                  Form Preview
                </DialogTitle>
                <Badge
                  variant={
                    form.status === 'PUBLISHED'
                      ? 'success'
                      : form.status === 'DRAFT'
                      ? 'warning'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {form.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Interactive preview simulating the client-facing questionnaire
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5 text-xs shadow-2xs"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>Copy Public Link</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Scrollable Form Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-xl mx-auto rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
            {isSubmitted ? (
              /* Success Submission State in Preview */
              <div className="text-center py-6 space-y-4 animate-in fade-in-50 duration-200">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-xs">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Submission Received</h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                    {form.successMessage || 'Thank you for your submission.'}
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetPreview}
                    className="gap-1.5 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset & Test Again</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Active Form View */
              <form onSubmit={handlePreviewSubmit} className="space-y-5">
                {/* Form Title & Description */}
                <div className="border-b border-border pb-4 text-left">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    {form.title}
                  </h2>
                  {form.description && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {form.description}
                    </p>
                  )}
                </div>

                {sortedFields.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    This form does not contain any fields yet. Use the builder to add fields.
                  </div>
                ) : (
                  sortedFields.map((field) => {
                    const value = formData[field.fieldKey] || ''
                    const error = fieldErrors[field.fieldKey]

                    return (
                      <div key={field.fieldKey} className="space-y-1.5 text-left">
                        <label className="block text-xs font-semibold text-slate-800">
                          {field.label}
                          {field.required && (
                            <span className="text-rose-500 ml-1 font-bold">*</span>
                          )}
                        </label>

                        {field.type === 'textarea' ? (
                          <textarea
                            rows={3}
                            value={value}
                            onChange={(e) => handleInputChange(field.fieldKey, e.target.value)}
                            placeholder={field.placeholder}
                            className={`w-full rounded-md border bg-card px-3 py-2 text-xs text-foreground shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                              error ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
                            }`}
                          />
                        ) : field.type === 'select' ? (
                          <Select
                            value={value}
                            onChange={(e) => handleInputChange(field.fieldKey, e.target.value)}
                            error={error}
                          >
                            <option value="">
                              {field.placeholder || 'Select an option...'}
                            </option>
                            {(field.options || []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            type={
                              field.type === 'email'
                                ? 'email'
                                : field.type === 'phone'
                                ? 'tel'
                                : field.type === 'number'
                                ? 'number'
                                : 'text'
                            }
                            value={value}
                            onChange={(e) => handleInputChange(field.fieldKey, e.target.value)}
                            placeholder={field.placeholder}
                            error={error}
                          />
                        )}

                        {field.helpText && !error && (
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {field.helpText}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}

                {/* Submit Button */}
                {sortedFields.length > 0 && (
                  <div className="pt-3">
                    <Button
                      type="submit"
                      className="w-full gap-2 text-xs font-semibold shadow-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{form.submitButtonText || 'Submit'}</span>
                    </Button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-border bg-white px-5 py-2.5 text-center">
          <p className="text-[11px] text-muted-foreground">
            This preview simulates the actual public form experience without sending real submissions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
