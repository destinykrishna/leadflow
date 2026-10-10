import * as React from 'react'
import { Globe, Loader2, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { translateText, type TranslationResultData } from '@/features/translation/api/translation.api'
import i18n from '@/i18n'

export interface TextTranslateProps {
  /** The text string to translate */
  text?: string
  /** Backward compatibility alias for text */
  notes?: string
  /** Translation domain context for AI prompt tailoring */
  context?: 'lead_note' | 'document_note' | 'task_description' | 'email_preview' | 'general_note'
  /** Optional custom container CSS classes */
  className?: string
  /** User-facing label (e.g. 'Note', 'Task Description', 'Verification Note') */
  label?: string
  /** Optional prefix for test IDs to avoid collisions in multi-card views */
  testIdPrefix?: string
  /** Presentation variant: 'toolbar' (full select + button bar) or 'link' (subtle inline link) */
  variant?: 'toolbar' | 'link'
}

export type LeadNoteTranslateProps = TextTranslateProps

export { isEligibleDocumentText } from '@/features/translation/lib/document-eligibility'

/**
 * Generalized dynamic text translation component.
 * Calls backend POST /api/translate securely using existing authenticated API client.
 * Never overwrites original text; renders translations separately with language selection,
 * loading indicator, error handling, and dismiss capability.
 */
export function TextTranslate({
  text,
  notes,
  context = 'general_note',
  className = '',
  label,
  testIdPrefix = '',
  variant = 'toolbar',
}: TextTranslateProps) {
  const effectiveText = (text !== undefined ? text : notes) || ''
  const defaultLabel =
    label ||
    (context === 'lead_note'
      ? 'Note'
      : context === 'document_note'
        ? 'Document Note'
        : context === 'task_description'
          ? 'Task Description'
          : 'Text')

  // Default target language: German if current interface is English, English if German
  const initialLang = (i18n.language === 'de' ? 'en' : 'de') as 'en' | 'de'
  const [targetLang, setTargetLang] = React.useState<'en' | 'de'>(initialLang)
  const [isTranslating, setIsTranslating] = React.useState(false)
  const [translation, setTranslation] = React.useState<TranslationResultData | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Clear translation and errors if original text changes
  React.useEffect(() => {
    setTranslation(null)
    setError(null)
  }, [effectiveText])

  const hasContent = Boolean(effectiveText && effectiveText.trim().length > 0)

  const handleTranslate = async () => {
    // Prevent duplicate concurrent requests
    if (isTranslating) return

    const trimmed = effectiveText.trim()
    // Guard against empty input without calling the backend API
    if (!trimmed) {
      setError(
        defaultLabel === 'Note'
          ? 'Note text is empty. Enter note content before translating.'
          : `${defaultLabel} text is empty. Enter content before translating.`
      )
      return
    }

    setIsTranslating(true)
    setError(null)

    try {
      const result = await translateText({
        text: trimmed,
        targetLang,
        context,
      })
      setTranslation(result)
    } catch (err: unknown) {
      const errObj = err as {
        response?: { data?: { error?: { message?: string } } }
        message?: string
      }
      const message =
        errObj.response?.data?.error?.message ||
        errObj.message ||
        `Failed to translate ${defaultLabel.toLowerCase()}. Please try again.`
      setError(message)
    } finally {
      setIsTranslating(false)
    }
  }

  const selectId = testIdPrefix ? `${testIdPrefix}target-lang-select` : 'target-lang-select'
  const selectTestId = testIdPrefix ? `${testIdPrefix}target-lang-select` : 'target-lang-select'
  const buttonTestId = testIdPrefix ? `${testIdPrefix}translate-button` : 'translate-button'
  const errorTestId = testIdPrefix ? `${testIdPrefix}translate-error` : 'translate-error'
  const boxTestId = testIdPrefix ? `${testIdPrefix}translated-note-box` : 'translated-note-box'
  const spinnerTestId = testIdPrefix ? `${testIdPrefix}translate-spinner` : 'translate-spinner'

  return (
    <div className={`${variant === 'link' ? 'mt-1 space-y-1.5' : 'mt-2 space-y-2'} ${className}`}>
      {variant === 'link' ? (
        /* Subtle Text Link beside eligible note */
        <div className="inline-flex items-center gap-1.5 flex-wrap text-xs">
          <button
            type="button"
            onClick={handleTranslate}
            disabled={isTranslating || !hasContent}
            data-testid={buttonTestId}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 hover:underline transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isTranslating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin shrink-0" data-testid={spinnerTestId} />
                <span>Translating…</span>
              </>
            ) : (
              <>
                <Globe className="h-3 w-3 shrink-0" />
                <span>Translate to {targetLang === 'de' ? 'German' : 'English'}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTargetLang(targetLang === 'de' ? 'en' : 'de')}
            disabled={isTranslating}
            data-testid={selectTestId}
            aria-label="Switch target language"
            className="text-[10px] text-muted-foreground hover:text-slate-700 transition-colors cursor-pointer"
          >
            (to {targetLang === 'de' ? 'EN' : 'DE'})
          </button>
        </div>
      ) : (
        /* Translation Action Toolbar */
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <label htmlFor={selectId} className="text-[11px] font-medium text-slate-500">
              Translate to:
            </label>
            <select
              id={selectId}
              aria-label="Target language"
              data-testid={selectTestId}
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as 'en' | 'de')}
              disabled={isTranslating}
              className="rounded border border-border/80 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 cursor-pointer"
            >
              <option value="de">German (DE)</option>
              <option value="en">English (EN)</option>
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTranslate}
            disabled={isTranslating || !hasContent}
            data-testid={buttonTestId}
            className="h-6 text-[11px] gap-1 px-2.5 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary transition-colors"
          >
            {isTranslating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" data-testid={spinnerTestId} />
                <span>Translating…</span>
              </>
            ) : (
              <>
                <Globe className="h-3 w-3" />
                <span>Translate</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Error Notice (Preserves original text) */}
      {error && (
        <div
          role="alert"
          data-testid={errorTestId}
          className="flex items-start justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50/90 p-2.5 text-xs text-rose-800"
        >
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold block text-[11px]">Translation Error</span>
              <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed break-words">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="rounded p-0.5 text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Translated Box (Preserves original text) */}
      {translation && (
        <div
          data-testid={boxTestId}
          className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-slate-800 shadow-2xs animate-in fade-in-50 duration-150"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-primary/10">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold text-primary text-[11px]">
                Translated {defaultLabel} ({translation.targetLang === 'de' ? 'German' : 'English'})
              </span>
              {translation.isAiTranslated && (
                <Badge variant="outline" size="sm" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary bg-white">
                  AI
                </Badge>
              )}
              {translation.cached && (
                <span className="text-[10px] text-muted-foreground font-mono">(Cached)</span>
              )}
              {translation.fallback && (
                <span className="text-[10px] text-muted-foreground font-mono">(Direct)</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setTranslation(null)}
              aria-label="Dismiss translation"
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-primary/10 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="leading-relaxed whitespace-pre-wrap text-slate-900 font-normal">
            {translation.translatedText}
          </p>

          {translation.warning && (
            <p className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-2 py-1 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 shrink-0 text-amber-600" />
              <span>{translation.warning}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Backward-compatible wrapper for lead intake notes translation.
 */
export function LeadNoteTranslate(props: LeadNoteTranslateProps) {
  return <TextTranslate context="lead_note" label="Note" {...props} />
}
