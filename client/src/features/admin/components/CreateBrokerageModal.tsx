import * as React from 'react'
import {
  Building2,
  User,
  Sparkles,
  Eye,
  EyeOff,
  AlertCircle,
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
import {
  useCreateBrokerage,
} from '../api/brokerages.api'
import {
  validateForm,
  createBrokerageFormSchema,
  BROKERAGE_PLANS,
  BROKERAGE_STATUSES,
} from '@/lib/validation'
import type {
  BrokeragePlan,
  BrokerageStatus,
  OnboardingResult,
} from '@/types/brokerage.types'

interface CreateBrokerageModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (result: OnboardingResult) => void
}

function generateRandomPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
  let pass = ''
  for (let i = 0; i < 14; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CreateBrokerageModal({ isOpen, onClose, onSuccess }: CreateBrokerageModalProps) {
  // Brokerage organization state
  const [name, setName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [isSlugManual, setIsSlugManual] = React.useState(false)
  const [plan, setPlan] = React.useState<BrokeragePlan>('STARTER')
  const [status, setStatus] = React.useState<BrokerageStatus>('ACTIVE')

  // Initial admin state
  const [adminName, setAdminName] = React.useState('')
  const [adminEmail, setAdminEmail] = React.useState('')
  const [adminPassword, setAdminPassword] = React.useState('')
  const [adminPhone, setAdminPhone] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)

  // Validation & error states
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [serverError, setServerError] = React.useState<string | null>(null)

  const createMutation = useCreateBrokerage()

  // Auto-slugify when name changes, unless user manually edited slug
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setName(val)
    if (!isSlugManual) {
      setSlug(slugify(val))
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManual(true)
    setSlug(e.target.value.toLowerCase())
  }

  const handleGeneratePassword = () => {
    const newPass = generateRandomPassword()
    setAdminPassword(newPass)
    setShowPassword(true)
  }

  const resetForm = () => {
    setName('')
    setSlug('')
    setIsSlugManual(false)
    setPlan('STARTER')
    setStatus('ACTIVE')
    setAdminName('')
    setAdminEmail('')
    setAdminPassword('')
    setAdminPhone('')
    setShowPassword(false)
    setErrors({})
    setServerError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    const rawPayload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      plan,
      status,
      admin: {
        name: adminName.trim(),
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
        phone: adminPhone.trim() || undefined,
      },
    }

    const validation = validateForm(createBrokerageFormSchema, rawPayload)
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }

    setErrors({})

    try {
      const result = await createMutation.mutateAsync({
        name: validation.data.name,
        slug: validation.data.slug || undefined,
        plan: validation.data.plan as BrokeragePlan,
        status: validation.data.status as BrokerageStatus,
        admin: {
          name: validation.data.admin.name,
          email: validation.data.admin.email,
          password: validation.data.admin.password,
          phone: validation.data.admin.phone || undefined,
        },
      })

      resetForm()
      onSuccess(result)
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to create brokerage organization'
      setServerError(message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold text-slate-900">
              Create New Brokerage
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Onboard a partner brokerage organization and provision its initial Brokerage Administrator.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {serverError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {/* Section 1: Brokerage Details */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 border-b border-border/60 pb-1.5 text-xs font-semibold text-slate-800 uppercase tracking-wider">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Organization Details</span>
            </div>

            <div className="space-y-1">
              <Input
                label="Brokerage Name *"
                placeholder="e.g. Apex Home Finance Pvt Ltd"
                value={name}
                onChange={handleNameChange}
                error={errors['name']}
                disabled={createMutation.isPending}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Input
                  label="URL Slug (Optional)"
                  placeholder="e.g. apex-home-finance"
                  value={slug}
                  onChange={handleSlugChange}
                  error={errors['slug']}
                  disabled={createMutation.isPending}
                  helperText="Unique identifier for portal routing"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 block">
                  Subscription Plan
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as BrokeragePlan)}
                  disabled={createMutation.isPending}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {BROKERAGE_PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Initial Account Status
              </label>
              <div className="flex gap-2">
                {BROKERAGE_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s as BrokerageStatus)}
                    className={`flex-1 rounded-md py-1.5 px-3 text-xs font-medium border transition-colors ${
                      status === s
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-white text-slate-700 border-border hover:bg-slate-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Initial Brokerage Admin Account */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center gap-2 border-b border-border/60 pb-1.5 text-xs font-semibold text-slate-800 uppercase tracking-wider">
              <User className="h-3.5 w-3.5 text-primary" />
              <span>Initial Administrator Account</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Input
                  label="Admin Full Name *"
                  placeholder="e.g. Ramesh Kumar"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  error={errors['admin.name']}
                  disabled={createMutation.isPending}
                  required
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Admin Email *"
                  type="email"
                  placeholder="admin@brokerage.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  error={errors['admin.email']}
                  disabled={createMutation.isPending}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">
                  Initial Password * (min 8 chars)
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Generate Strong Password</span>
                </button>
              </div>

              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter or generate temporary password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  error={errors['admin.password']}
                  disabled={createMutation.isPending}
                  className="pr-10 font-mono text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Input
                label="Admin Phone (Optional)"
                placeholder="e.g. +91 98765 43210"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                error={errors['admin.phone']}
                disabled={createMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? 'Provisioning...' : 'Create & Onboard Brokerage'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
