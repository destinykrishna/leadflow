import * as React from 'react'
import {
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
import { useCreateAdvisor } from '../api/team.api'
import {
  validateForm,
  createAdvisorFormSchema,
} from '@/lib/validation'
import type { AdvisorItem } from '@/types/advisor.types'

interface CreateAdvisorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (advisor: AdvisorItem, password?: string) => void
}

function generateRandomPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
  let pass = ''
  for (let i = 0; i < 14; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}

export function CreateAdvisorModal({ isOpen, onClose, onSuccess }: CreateAdvisorModalProps) {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)

  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [serverError, setServerError] = React.useState<string | null>(null)

  const createMutation = useCreateAdvisor()

  const handleGeneratePassword = () => {
    const newPass = generateRandomPassword()
    setPassword(newPass)
    setShowPassword(true)
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPassword('')
    setPhone('')
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
      email: email.trim().toLowerCase(),
      password: password || undefined,
      phone: phone.trim() || undefined,
    }

    const validation = validateForm(createAdvisorFormSchema, rawPayload)
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }

    setErrors({})

    try {
      const createdAdvisor = await createMutation.mutateAsync({
        name: validation.data.name,
        email: validation.data.email,
        password: validation.data.password || undefined,
        phone: validation.data.phone || undefined,
      })

      const usedPassword = password.trim() || undefined
      resetForm()
      onSuccess(createdAdvisor, usedPassword)
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to create advisor'
      setServerError(message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold text-slate-900">
              Onboard Mortgage Advisor
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Provision a new mortgage advisor account within your brokerage organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {serverError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          <div className="space-y-1">
            <Input
              label="Advisor Full Name *"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors['name']}
              disabled={createMutation.isPending}
              required
            />
          </div>

          <div className="space-y-1">
            <Input
              label="Work Email *"
              type="email"
              placeholder="advisor@brokerage.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors['email']}
              disabled={createMutation.isPending}
              required
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Initial Password (Optional, min 8 chars)
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
                placeholder="Leave blank to auto-generate securely"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors['password']}
                disabled={createMutation.isPending}
                className="pr-10 font-mono text-xs"
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
              label="Contact Phone (Optional)"
              placeholder="e.g. +91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors['phone']}
              disabled={createMutation.isPending}
            />
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
              {createMutation.isPending ? 'Provisioning...' : 'Onboard Advisor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
