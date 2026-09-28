import * as React from 'react'
import {
  Key,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useRotateWebhookSecret } from '../api/brokerages.api'
import type { BrokerageItem } from '@/types/brokerage.types'

interface RotateSecretModalProps {
  isOpen: boolean
  onClose: () => void
  brokerage: BrokerageItem | null
}

export function RotateSecretModal({ isOpen, onClose, brokerage }: RotateSecretModalProps) {
  const [rotatedSecret, setRotatedSecret] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const rotateMutation = useRotateWebhookSecret()

  React.useEffect(() => {
    if (isOpen) {
      setRotatedSecret(null)
      setCopied(false)
      setServerError(null)
    }
  }, [isOpen])

  if (!brokerage) return null

  const handleRotate = async () => {
    setServerError(null)
    try {
      const result = await rotateMutation.mutateAsync(brokerage._id)
      setRotatedSecret(result.webhookSecret)
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to rotate webhook secret'
      setServerError(message)
    }
  }

  const handleCopy = () => {
    if (!rotatedSecret) return
    navigator.clipboard.writeText(rotatedSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setRotatedSecret(null)
    setCopied(false)
    setServerError(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {!rotatedSecret ? (
          /* Confirmation Step */
          <>
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <Key className="h-4 w-4" />
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Rotate Webhook Secret
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Generate a new cryptographic secret for inbound lead payload verification.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2">
              {serverError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{serverError}</div>
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 space-y-2 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-semibold text-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Immediate Invalidation Warning</span>
                </div>
                <p className="leading-relaxed">
                  Rotating the webhook secret for <strong className="font-semibold">{brokerage.name}</strong> will{' '}
                  <span className="font-medium underline decoration-amber-500">immediately invalidate</span> the existing secret.
                </p>
                <p className="leading-relaxed text-[11px] text-amber-800">
                  External lead ingestion sources (such as Google Apps Script or Zapier) sending the old secret will receive HTTP 401 Unauthorized errors until updated with the new key.
                </p>
              </div>

              <div className="rounded-md border border-border/70 bg-slate-50 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Target Brokerage: </span>
                <span className="font-medium text-slate-900">{brokerage.name}</span>
                <span className="text-muted-foreground text-[11px] ml-1.5 font-mono">
                  ({brokerage._id})
                </span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={rotateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleRotate}
                disabled={rotateMutation.isPending}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${rotateMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{rotateMutation.isPending ? 'Rotating...' : 'Rotate Secret Now'}</span>
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Safe Handling / Display of Rotated Secret */
          <>
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Webhook Secret Rotated Successfully
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                The new secret is active immediately. External webhooks must be updated.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800 block">
                  New Webhook Secret
                </label>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs font-mono text-slate-800">
                  <span className="truncate">{rotatedSecret}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 shrink-0 rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-xs border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 leading-relaxed">
                <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Next Step: </span>
                  Update the webhook header{' '}
                  <code className="bg-blue-100/70 px-1 py-0.5 rounded text-[11px] font-mono">
                    x-webhook-secret
                  </code>{' '}
                  in your external lead provider with this new key.
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="primary" onClick={handleClose} className="w-full">
                Done & Return to Directory
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
