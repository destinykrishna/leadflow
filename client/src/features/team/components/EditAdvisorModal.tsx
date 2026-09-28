import * as React from 'react'
import {
  User,
  AlertTriangle,
  AlertCircle,
  Save,
  ShieldCheck,
  ShieldAlert,
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
import { useUpdateAdvisor } from '../api/team.api'
import {
  validateForm,
  updateAdvisorFormSchema,
} from '@/lib/validation'
import type { AdvisorItem, AdvisorStatus } from '@/types/advisor.types'

interface EditAdvisorModalProps {
  isOpen: boolean
  onClose: () => void
  advisor: AdvisorItem | null
}

export function EditAdvisorModal({ isOpen, onClose, advisor }: EditAdvisorModalProps) {
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [status, setStatus] = React.useState<AdvisorStatus>('ACTIVE')

  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [serverError, setServerError] = React.useState<string | null>(null)

  const updateMutation = useUpdateAdvisor()

  React.useEffect(() => {
    if (advisor) {
      setName(advisor.name || '')
      setPhone(advisor.phone || '')
      setStatus(advisor.status || 'ACTIVE')
      setErrors({})
      setServerError(null)
    }
  }, [advisor])

  if (!advisor) return null

  const advisorId = advisor.id || advisor._id || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    const rawPayload = {
      name: name.trim() !== advisor.name ? name.trim() : undefined,
      phone: phone.trim() !== (advisor.phone || '') ? phone.trim() : undefined,
      status: status !== advisor.status ? status : undefined,
    }

    if (!rawPayload.name && !rawPayload.phone && !rawPayload.status) {
      onClose()
      return
    }

    const validation = validateForm(updateAdvisorFormSchema, rawPayload)
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }

    try {
      await updateMutation.mutateAsync({
        id: advisorId,
        payload: {
          name: validation.data.name,
          phone: validation.data.phone || undefined,
          status: validation.data.status as AdvisorStatus | undefined,
        },
      })
      onClose()
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to update advisor profile'
      setServerError(message)
    }
  }

  const isDeactivating = status === 'INACTIVE' && advisor.status === 'ACTIVE'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold text-slate-900">
              Edit Advisor Profile
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Update advisor contact details and account operational standing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {serverError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {/* Email (Read-Only) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 block">
              Login Email (Fixed)
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600">
              {advisor.email}
            </div>
            <p className="text-[11px] text-muted-foreground">
              User identity email cannot be modified after account provisioning.
            </p>
          </div>

          <div className="space-y-1">
            <Input
              label="Advisor Full Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors['name']}
              disabled={updateMutation.isPending}
              required
            />
          </div>

          <div className="space-y-1">
            <Input
              label="Contact Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors['phone']}
              disabled={updateMutation.isPending}
            />
          </div>

          {/* Account Status Standing */}
          <div className="space-y-2 pt-1 border-t border-border/60">
            <label className="text-xs font-semibold text-slate-800 block">
              Account Status & Access Standing
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('ACTIVE')}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-colors ${
                  status === 'ACTIVE'
                    ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 font-medium'
                    : 'border-border bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className={`h-4 w-4 ${status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div>
                  <span className="block font-semibold">Active</span>
                  <span className="text-[10px] text-muted-foreground">Full workspace access</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('INACTIVE')}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-colors ${
                  status === 'INACTIVE'
                    ? 'border-amber-500 bg-amber-50/60 text-amber-950 font-medium'
                    : 'border-border bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert className={`h-4 w-4 ${status === 'INACTIVE' ? 'text-amber-600' : 'text-slate-400'}`} />
                <div>
                  <span className="block font-semibold">Inactive</span>
                  <span className="text-[10px] text-muted-foreground">Access suspended</span>
                </div>
              </button>
            </div>

            {isDeactivating && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-950 leading-relaxed">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Deactivation Notice: </span>
                  Setting status to Inactive will immediately revoke active login sessions. Historical assigned leads, borrower cases, and tasks remain safely preserved.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={updateMutation.isPending}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{updateMutation.isPending ? 'Saving...' : 'Save Profile'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
