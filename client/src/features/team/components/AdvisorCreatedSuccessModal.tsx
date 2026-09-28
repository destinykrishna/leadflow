import * as React from 'react'
import {
  CheckCircle2,
  Copy,
  Check,
  User,
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
import { Badge } from '@/components/ui/Badge'
import type { AdvisorItem } from '@/types/advisor.types'

interface AdvisorCreatedSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  advisor: AdvisorItem | null
  temporaryPassword?: string
}

export function AdvisorCreatedSuccessModal({
  isOpen,
  onClose,
  advisor,
  temporaryPassword,
}: AdvisorCreatedSuccessModalProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null)

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  if (!advisor) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Advisor Onboarded Successfully
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                The advisor account is active and ready for mortgage lead assignments.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Advisor Summary Box */}
          <div className="rounded-lg border border-border/80 bg-slate-50/70 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-semibold text-slate-900">{advisor.name}</span>
              </div>
              <Badge variant="success" size="sm">
                Active
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-muted-foreground block text-[11px]">Login Email</span>
                <div className="flex items-center gap-1 font-mono text-slate-900">
                  <span className="truncate">{advisor.email}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(advisor.email, 'email')}
                    className="text-slate-400 hover:text-slate-700"
                    title="Copy Email"
                  >
                    {copiedField === 'email' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {advisor.phone && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">Contact Phone</span>
                  <span className="text-slate-800">{advisor.phone}</span>
                </div>
              )}
            </div>

            {temporaryPassword && (
              <div className="pt-2 border-t border-border/50">
                <span className="text-muted-foreground block text-[11px] font-medium mb-1">
                  Provisioned Password
                </span>
                <div className="flex items-center justify-between gap-2 rounded bg-white px-2.5 py-1.5 border border-slate-200 font-mono text-xs text-slate-800">
                  <span>{temporaryPassword}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(temporaryPassword, 'password')}
                    className="inline-flex items-center gap-1 shrink-0 text-slate-600 hover:text-primary transition-colors text-[11px]"
                  >
                    {copiedField === 'password' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedField === 'password' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 leading-relaxed">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              Share these credentials securely with the advisor. They can sign in immediately at the portal login screen.
            </div>
          </div>
        </div>

        <DialogFooter className="pt-1">
          <Button variant="primary" onClick={onClose} className="w-full">
            Done & Return to Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
