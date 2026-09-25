import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCheck,
  Key,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
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
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import type { Lead } from '@/types/pipeline.types'
import type { ClientType } from '@/types/client.types'
import {
  useConvertLead,
  type ConvertLeadResponseData,
} from '../api/leads.api'

interface ConvertLeadModalProps {
  lead: Lead
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: ConvertLeadResponseData) => void
}

export function ConvertLeadModal({
  lead,
  isOpen,
  onClose,
  onSuccess,
}: ConvertLeadModalProps) {
  const navigate = useNavigate()
  const convertMutation = useConvertLead()

  const [clientType, setClientType] = React.useState<ClientType>('BUYER')
  const [password, setPassword] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [conversionResult, setConversionResult] =
    React.useState<ConvertLeadResponseData | null>(null)
  const [copied, setCopied] = React.useState(false)

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setClientType('BUYER')
      setPassword('')
      setNotes('')
      setErrorMessage(null)
      setConversionResult(null)
      setCopied(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    try {
      const res = await convertMutation.mutateAsync({
        leadId: lead._id,
        payload: {
          type: clientType,
          password: password.trim() ? password.trim() : undefined,
          notes: notes.trim() ? notes.trim() : undefined,
        },
      })
      setConversionResult(res)
      onSuccess?.(res)
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string }
      const msg =
        errorObj.response?.data?.error?.message ||
        errorObj.message ||
        'Failed to convert lead to client case. Please ensure lead is in a qualified stage.'
      setErrorMessage(msg)
    }
  }

  const handleCopyPassword = () => {
    if (conversionResult?.temporaryPassword) {
      navigator.clipboard.writeText(conversionResult.temporaryPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleViewClientCase = () => {
    if (conversionResult?.client._id) {
      onClose()
      navigate(`/app/clients/${conversionResult.client._id}`)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {conversionResult ? (
          // Success State
          <div className="space-y-4 py-2">
            <DialogHeader>
              <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Client Case Established
                </DialogTitle>
              </div>
              <DialogDescription>
                Lead inquiry successfully converted into an active mortgage case for{' '}
                <span className="font-semibold text-slate-800">
                  {lead.firstName} {lead.lastName}
                </span>
                .
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-lg border border-border/80 bg-slate-50/70 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Portal Account Email:</span>
                <span className="font-semibold text-slate-900">{conversionResult.user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Account Role:</span>
                <Badge variant="neutral" size="sm">
                  {conversionResult.user.role}
                </Badge>
              </div>

              {conversionResult.temporaryPassword && (
                <div className="pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-amber-600" />
                      Generated Portal Password
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyPassword}
                      className="h-6 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="rounded bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-emerald-400 select-all tracking-wider">
                    {conversionResult.temporaryPassword}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                    Share this temporary password with the borrower for initial portal access.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
                Done
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleViewClientCase}
                className="w-full sm:w-auto gap-1.5"
              >
                View Client Case
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Conversion Form State
          <form onSubmit={handleSubmit} className="space-y-4 py-1">
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary">
                <UserCheck className="h-5 w-5" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Convert Lead to Client Case
                </DialogTitle>
              </div>
              <DialogDescription>
                Create an official client profile and expat portal account for{' '}
                <span className="font-semibold text-slate-800">
                  {lead.firstName} {lead.lastName}
                </span>{' '}
                ({lead.email}).
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Client Profile Type
                </label>
                <select
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value as ClientType)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="BUYER">Buyer (Default)</option>
                  <option value="SELLER">Seller</option>
                  <option value="BOTH">Buyer & Seller</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Portal Password (Optional)
                </label>
                <Input
                  type="password"
                  placeholder="Auto-generated if left blank"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-xs"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Leave empty to generate a cryptographically secure temporary password.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Case Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="E.g. Target property in Mumbai, pre-approved for ₹45,00,000 mortgage"
                  rows={2}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={convertMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={convertMutation.isPending}
                className="w-full sm:w-auto"
              >
                Confirm Conversion
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
