import * as React from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
  action?: React.ReactNode
}

export function ErrorState({
  title,
  message,
  onRetry,
  className,
  action,
}: ErrorStateProps) {
  const { t } = useTranslation()
  const resolvedTitle = title || t('common.errorTitle', 'Something went wrong')

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6 text-center rounded-lg border border-rose-200 bg-rose-50/50 text-rose-900',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h4 className="text-sm font-semibold tracking-tight">{resolvedTitle}</h4>
      <p className="mt-1 text-xs text-rose-700/90 max-w-md leading-relaxed">{message}</p>
      {(onRetry || action) && (
        <div className="mt-4 flex items-center gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 border-rose-200 hover:bg-rose-100/50">
              <RotateCcw className="h-3.5 w-3.5" />
              {t('common.retry', 'Try again')}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}
