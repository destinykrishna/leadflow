import * as React from 'react'
import {
  CheckCircle2,
  Copy,
  Check,
  Building2,
  Key,
  ShieldCheck,
  User,
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
import { Badge } from '@/components/ui/Badge'
import { getApiOrigin } from '@/lib/api'
import type { OnboardingResult } from '@/types/brokerage.types'

interface OnboardingSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  data: OnboardingResult | null
}

export function OnboardingSuccessModal({ isOpen, onClose, data }: OnboardingSuccessModalProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null)

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  if (!data) return null

  const { brokerage, admin } = data
  const webhookUrl = `${getApiOrigin()}/api/leads/webhook/${brokerage.id}`

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Brokerage Onboarded Successfully
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Organization and initial Brokerage Admin account have been provisioned.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Organization Summary Box */}
          <div className="rounded-lg border border-border/80 bg-slate-50/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm text-slate-900">{brokerage.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="default" size="sm">
                  {brokerage.plan}
                </Badge>
                <Badge variant="success" size="sm">
                  {brokerage.status}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Slug: </span>
                <span className="font-mono text-slate-800">{brokerage.slug || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">ID: </span>
                  <span className="font-mono text-slate-800 truncate">
                    {brokerage.id.slice(0, 10)}...
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(brokerage.id, 'brokerageId')}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  title="Copy full Brokerage ID"
                >
                  {copiedField === 'brokerageId' ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedField === 'brokerageId' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Webhook Configuration Details */}
          {brokerage.webhookSecret && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs tracking-wide uppercase">
                <Key className="h-3.5 w-3.5 text-blue-700" />
                <span>Lead Ingestion Webhook Setup</span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 mb-1 block">
                  Webhook Ingestion URL
                </label>
                <div className="flex items-center justify-between gap-2 rounded bg-white px-2.5 py-1.5 border border-slate-200 text-xs font-mono text-slate-800">
                  <span className="truncate">{webhookUrl}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookUrl, 'webhookUrl')}
                    className="inline-flex items-center gap-1 shrink-0 text-slate-600 hover:text-primary transition-colors"
                  >
                    {copiedField === 'webhookUrl' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span className="text-[11px]">
                      {copiedField === 'webhookUrl' ? 'Copied' : 'Copy URL'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 mb-1 block">
                  Generated Webhook Secret
                </label>
                <div className="flex items-center justify-between gap-2 rounded bg-white px-2.5 py-1.5 border border-slate-200 text-xs font-mono text-slate-800">
                  <span className="truncate">{brokerage.webhookSecret}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(brokerage.webhookSecret!, 'webhookSecret')}
                    className="inline-flex items-center gap-1 shrink-0 text-slate-600 hover:text-primary transition-colors"
                  >
                    {copiedField === 'webhookSecret' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span className="text-[11px]">
                      {copiedField === 'webhookSecret' ? 'Copied' : 'Copy Secret'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-1.5 text-[11px] text-blue-800/90 leading-relaxed">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Configure incoming lead sources (e.g. Google Forms or external portals) with the{' '}
                  <code className="bg-blue-100/70 px-1 py-0.5 rounded text-[11px] font-mono">
                    x-webhook-secret
                  </code>{' '}
                  header.
                </span>
              </div>
            </div>
          )}

          {/* Initial Admin Details Box */}
          <div className="rounded-lg border border-border/80 bg-slate-50/70 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs tracking-wide uppercase">
              <User className="h-3.5 w-3.5 text-slate-600" />
              <span>Initial Administrator Account</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Admin Name:</span>
                <span className="font-medium text-slate-900">{admin.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Login Email:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-slate-900 truncate">{admin.email}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(admin.email, 'adminEmail')}
                    className="text-slate-400 hover:text-slate-700"
                    title="Copy Email"
                  >
                    {copiedField === 'adminEmail' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Role:</span>
                <Badge variant="neutral" size="sm">
                  {admin.role}
                </Badge>
              </div>
              {admin.phone && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">Phone:</span>
                  <span className="text-slate-800">{admin.phone}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              The administrator can now log in using this email address and the password set during creation.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="primary" onClick={onClose} className="w-full sm:w-auto">
            Done & Return to Directory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
