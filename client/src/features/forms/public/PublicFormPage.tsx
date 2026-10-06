import * as React from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  ShieldCheck,
  FileQuestion,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Loader } from '@/components/ui/Loader'
import { ErrorState } from '@/components/ui/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { usePublicForm, useSubmitPublicForm } from './public-form.api'
import type { IPublicFormField } from '@/types/form.types'

export function PublicFormPage() {
  const { brokerageIdentifier, slug } = useParams<{
    brokerageIdentifier: string
    slug: string
  }>()

  const {
    data: form,
    isLoading,
    isError,
    error,
    refetch,
  } = usePublicForm(brokerageIdentifier, slug)

  const submitMutation = useSubmitPublicForm(
    brokerageIdentifier || '',
    slug || '',
  )

  const [formData, setFormData] = React.useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [honeypot, setHoneypot] = React.useState('')
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  // Dynamically synchronize page title with loaded form and brokerage identity
  React.useEffect(() => {
    if (form) {
      document.title = `${form.title} · ${form.brokerageName} · LeadFlow`
    }
  }, [form])

  const handleInputChange = (fieldKey: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }))
    if (fieldErrors[fieldKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[fieldKey]
        return next
      })
    }
    if (submitError) {
      setSubmitError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return

    setSubmitError(null)

    // Sort fields by configured order for consistent validation
    const sortedFields: IPublicFormField[] = [...form.fields].sort(
      (a, b) => a.order - b.order,
    )

    // Client-side validation
    const errors: Record<string, string> = {}
    for (const field of sortedFields) {
      const value = (formData[field.fieldKey] || '').trim()

      if (field.required && !value) {
        errors[field.fieldKey] = `${field.label} is required`
      } else if (value) {
        if (field.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(value)) {
            errors[field.fieldKey] = 'Please enter a valid email address'
          }
        } else if (field.type === 'number') {
          const num = Number(value)
          if (isNaN(num) || !isFinite(num)) {
            errors[field.fieldKey] = `${field.label} must be a valid number`
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    // Build payload mapping strictly from defined fields
    const responses: Record<string, string | number> = {}
    for (const field of sortedFields) {
      const raw = formData[field.fieldKey]
      if (raw !== undefined && raw !== null && raw.trim() !== '') {
        if (field.type === 'number') {
          responses[field.fieldKey] = Number(raw.trim())
        } else {
          responses[field.fieldKey] = raw.trim()
        }
      }
    }

    try {
      const result = await submitMutation.mutateAsync({
        responses,
        hp_website: honeypot || undefined,
      })
      setSuccessMessage(result.message || 'Thank you for your submission.')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429) {
          setSubmitError('Too many requests. Please wait a moment before trying again.')
        } else if (err.response?.status === 400) {
          const serverMsg =
            err.response.data?.error?.message ||
            err.response.data?.message ||
            'Please review your answers and try again.'
          setSubmitError(serverMsg)
        } else {
          setSubmitError('An unexpected error occurred. Please try again.')
        }
      } else {
        setSubmitError('Unable to connect to service. Please try again.')
      }
    }
  }

  const handleResetForm = () => {
    setFormData({})
    setFieldErrors({})
    setSubmitError(null)
    setSuccessMessage(null)
    setHoneypot('')
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-slate-50/70 p-4 sm:p-6 lg:p-8">
        <Loader fullScreen label="Loading form..." />
      </div>
    )
  }

  // Error States
  if (isError) {
    const isAxios = axios.isAxiosError(error)
    const status = isAxios ? error.response?.status : undefined

    // 429 Rate Limit
    if (status === 429) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-slate-50/70 p-4 sm:p-6 lg:p-8">
          <Card className="w-full max-w-md shadow-xs border-amber-200 bg-amber-50/40 text-center p-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-2xs">
              <Clock className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-amber-950">
                Too Many Requests
              </CardTitle>
              <CardDescription className="text-xs text-amber-800 mt-2 leading-relaxed max-w-sm mx-auto">
                You have accessed or submitted requests too frequently. Please wait a moment and refresh the page.
              </CardDescription>
            </div>
          </Card>
        </div>
      )
    }

    // Generic 404 Form Unavailable (conceals draft, archived, missing, suspended status)
    if (status === 404) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-slate-50/70 p-4 sm:p-6 lg:p-8">
          <Card className="w-full max-w-md shadow-xs border-border bg-card text-center p-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 shadow-2xs">
              <FileQuestion className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Form Unavailable
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-sm mx-auto">
                This form does not exist or is currently not accepting submissions. Please verify the URL or contact the brokerage directly.
              </CardDescription>
            </div>
          </Card>
        </div>
      )
    }

    // Other unexpected operational errors
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-slate-50/70 p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <ErrorState
            title="Unable to Load Form"
            message="A network or service error occurred while retrieving this questionnaire."
            onRetry={() => refetch()}
          />
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-slate-50/70 p-4 sm:p-6 lg:p-8">
        <Card className="w-full max-w-md shadow-xs border-border bg-card text-center p-8 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 shadow-2xs">
            <FileQuestion className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">
              Form Unavailable
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-sm mx-auto">
              This form does not exist or is currently not accepting submissions. Please verify the URL or contact the brokerage directly.
            </CardDescription>
          </div>
        </Card>
      </div>
    )
  }

  const sortedFields: IPublicFormField[] = [...form.fields].sort(
    (a, b) => a.order - b.order,
  )

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-xl space-y-4">
        {/* Main Form Card */}
        <Card className="shadow-xs border-border bg-card overflow-hidden">
          {/* Header */}
          <CardHeader className="p-6 sm:p-8 pb-5 space-y-3 border-b border-border bg-white">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm" className="gap-1.5 px-2.5 py-0.5 font-medium">
                <Building2 className="h-3 w-3 text-slate-500" />
                <span className="truncate max-w-[260px]">{form.brokerageName}</span>
              </Badge>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {form.title}
              </h1>
              {form.description && (
                <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {form.description}
                </p>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 pt-6">
            {successMessage ? (
              /* Success Confirmation View */
              <div className="text-center py-6 sm:py-8 space-y-4 animate-in fade-in-50 duration-200">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-xs">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-slate-900">Inquiry Received</h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                    {successMessage}
                  </p>
                </div>
                <div className="pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetForm}
                    className="gap-1.5 text-xs shadow-2xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Submit another response</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Questionnaire Inputs Form */
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
                {/* Submission Error Banner */}
                {submitError && (
                  <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 animate-in fade-in-50 duration-150">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span className="font-medium">{submitError}</span>
                  </div>
                )}

                {/* Silent Bot Honeypot: Inaccessible to keyboard navigation and screen readers */}
                <div
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    pointerEvents: 'none',
                    height: 0,
                    width: 0,
                    zIndex: -1,
                    overflow: 'hidden',
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <label htmlFor="hp_website">Do not fill this field</label>
                  <input
                    type="text"
                    id="hp_website"
                    name="hp_website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                {sortedFields.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    This questionnaire does not contain any fields.
                  </div>
                ) : (
                  sortedFields.map((field) => {
                    const value = formData[field.fieldKey] || ''
                    const error = fieldErrors[field.fieldKey]
                    const fieldId = `field-${field.fieldKey}`

                    return (
                      <div key={field.fieldKey} className="space-y-1.5 text-left">
                        <label
                          htmlFor={fieldId}
                          className="block text-xs font-semibold text-slate-800"
                        >
                          {field.label}
                          {field.required && (
                            <span className="text-rose-500 ml-1 font-bold" aria-hidden="true">
                              *
                            </span>
                          )}
                        </label>

                        {field.type === 'textarea' ? (
                          <div>
                            <textarea
                              id={fieldId}
                              rows={3}
                              value={value}
                              onChange={(e) => handleInputChange(field.fieldKey, e.target.value)}
                              placeholder={field.placeholder}
                              aria-invalid={Boolean(error)}
                              className={`w-full rounded-md border bg-card px-3 py-2 text-xs text-foreground shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                                error ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
                              }`}
                            />
                            {error ? (
                              <p className="mt-1 text-xs font-medium text-destructive">
                                {error}
                              </p>
                            ) : field.helpText ? (
                              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                                {field.helpText}
                              </p>
                            ) : null}
                          </div>
                        ) : field.type === 'select' ? (
                          <div>
                            <Select
                              id={fieldId}
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
                            {error ? (
                              <p className="mt-1 text-xs font-medium text-destructive">
                                {error}
                              </p>
                            ) : field.helpText ? (
                              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                                {field.helpText}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <Input
                            id={fieldId}
                            type={
                              field.type === 'email'
                                ? 'email'
                                : field.type === 'phone'
                                ? 'tel'
                                : field.type === 'number'
                                ? 'text'
                                : 'text'
                            }
                            inputMode={field.type === 'number' ? 'numeric' : undefined}
                            value={value}
                            onChange={(e) => handleInputChange(field.fieldKey, e.target.value)}
                            placeholder={field.placeholder}
                            helperText={field.helpText}
                            error={error}
                          />
                        )}
                      </div>
                    )
                  })
                )}

                {/* Submit Button */}
                {sortedFields.length > 0 && (
                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={submitMutation.isPending}
                      className="w-full gap-2 text-xs font-semibold shadow-xs"
                    >
                      {submitMutation.isPending ? (
                        <span>Submitting inquiry...</span>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>{form.submitButtonText || 'Submit'}</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>

        {/* Brand & Security Trust Seal */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Encrypted & Secure Ingestion · Powered by LeadFlow</span>
        </div>
      </div>
    </div>
  )
}
