import * as React from 'react'
import {
  Building2,
  AlertTriangle,
  AlertCircle,
  Save,
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
import { useUpdateBrokerage } from '../api/brokerages.api'
import {
  validateForm,
  updateBrokerageFormSchema,
  BROKERAGE_PLANS,
  BROKERAGE_STATUSES,
} from '@/lib/validation'
import type {
  BrokerageItem,
  BrokeragePlan,
  BrokerageStatus,
} from '@/types/brokerage.types'

interface EditBrokerageModalProps {
  isOpen: boolean
  onClose: () => void
  brokerage: BrokerageItem | null
}

export function EditBrokerageModal({ isOpen, onClose, brokerage }: EditBrokerageModalProps) {
  const [name, setName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [plan, setPlan] = React.useState<BrokeragePlan>('STARTER')
  const [status, setStatus] = React.useState<BrokerageStatus>('ACTIVE')

  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [serverError, setServerError] = React.useState<string | null>(null)

  const updateMutation = useUpdateBrokerage()

  React.useEffect(() => {
    if (brokerage) {
      setName(brokerage.name || '')
      setSlug(brokerage.slug || '')
      setPlan(brokerage.plan || 'STARTER')
      setStatus(brokerage.status || 'ACTIVE')
      setErrors({})
      setServerError(null)
    }
  }, [brokerage])

  if (!brokerage) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    const rawPayload = {
      name: name.trim() !== brokerage.name ? name.trim() : undefined,
      slug: slug.trim() !== (brokerage.slug || '') ? slug.trim() : undefined,
      plan: plan !== brokerage.plan ? plan : undefined,
      status: status !== brokerage.status ? status : undefined,
    }

    // If nothing changed
    if (!rawPayload.name && !rawPayload.slug && !rawPayload.plan && !rawPayload.status) {
      onClose()
      return
    }

    const validation = validateForm(updateBrokerageFormSchema, rawPayload)
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }

    try {
      await updateMutation.mutateAsync({
        brokerageId: brokerage._id,
        payload: {
          name: validation.data.name,
          slug: validation.data.slug || undefined,
          plan: validation.data.plan as BrokeragePlan | undefined,
          status: validation.data.status as BrokerageStatus | undefined,
        },
      })
      onClose()
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to update brokerage organization'
      setServerError(message)
    }
  }

  const isSuspending = status === 'SUSPENDED' && brokerage.status !== 'SUSPENDED'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold text-slate-900">
              Manage Brokerage Lifecycle
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Update organization name, routing slug, subscription tier, and standing status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {serverError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {isSuspending && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold">Security Notice: </span>
                Suspending this organization will immediately invalidate access for all users in this tenant. Active requests will be rejected.
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Input
              label="Brokerage Organization Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors['name']}
              disabled={updateMutation.isPending}
              required
            />
          </div>

          <div className="space-y-1">
            <Input
              label="URL Slug Identifier"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              error={errors['slug']}
              disabled={updateMutation.isPending}
              helperText="Alphanumeric lowercase identifier with hyphens"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Subscription Plan
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as BrokeragePlan)}
                disabled={updateMutation.isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {BROKERAGE_PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Lifecycle Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BrokerageStatus)}
                disabled={updateMutation.isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {BROKERAGE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
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
              <span>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
