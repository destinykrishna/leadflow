import * as React from 'react'
import { AlertTriangle, AlertCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'

export interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmText?: string
  confirmLabel?: string
  cancelText?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'primary'
  isLoading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  const { t } = useTranslation()
  const resolvedConfirmText = confirmLabel || confirmText || t('common.confirm', 'Confirm')
  const resolvedCancelText = cancelLabel || cancelText || t('common.cancel', 'Cancel')
  const [internalLoading, setInternalLoading] = React.useState(false)

  const handleConfirm = async () => {
    try {
      setInternalLoading(true)
      await onConfirm()
      onClose()
    } catch {
      // Error handling is handled by the caller mutation
    } finally {
      setInternalLoading(false)
    }
  }

  const isPending = isLoading || internalLoading

  const iconBg =
    variant === 'danger'
      ? 'bg-rose-100 text-rose-700'
      : variant === 'warning'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-primary/10 text-primary'

  const confirmBtnClasses =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
      : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-[420px] p-5 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
              {variant === 'danger' ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 leading-tight">
                {title}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
            className="w-full sm:w-auto text-xs"
          >
            {resolvedCancelText}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
            className={`w-full sm:w-auto gap-1.5 text-xs font-semibold ${confirmBtnClasses}`}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{resolvedConfirmText}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
