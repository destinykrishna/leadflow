import * as React from 'react'
import {
  AlertTriangle,
  ShieldAlert,
  UserX,
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
import { useUpdateAdvisor } from '../api/team.api'
import type { AdvisorItem } from '@/types/advisor.types'

interface DeactivateAdvisorConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  advisor: AdvisorItem | null
}

export function DeactivateAdvisorConfirmModal({
  isOpen,
  onClose,
  advisor,
}: DeactivateAdvisorConfirmModalProps) {
  const [serverError, setServerError] = React.useState<string | null>(null)
  const updateMutation = useUpdateAdvisor()

  if (!advisor) return null

  const advisorId = advisor.id || advisor._id || ''
  const isCurrentlyActive = advisor.status === 'ACTIVE'
  const targetStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE'

  const handleToggle = async () => {
    setServerError(null)
    try {
      await updateMutation.mutateAsync({
        id: advisorId,
        payload: {
          status: targetStatus,
        },
      })
      onClose()
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to update advisor status'
      setServerError(message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                isCurrentlyActive ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isCurrentlyActive ? (
                <UserX className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {isCurrentlyActive ? 'Deactivate Advisor' : 'Reactivate Advisor'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {isCurrentlyActive
              ? 'Suspend workspace access for this team member.'
              : 'Restore workspace access for this team member.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {serverError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          <div className="rounded-md border border-border/80 bg-slate-50 p-3 text-xs">
            <span className="text-muted-foreground">Target Advisor: </span>
            <span className="font-semibold text-slate-900">{advisor.name}</span>
            <span className="text-muted-foreground font-mono ml-1.5">({advisor.email})</span>
          </div>

          {isCurrentlyActive ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Access Suspension (Not Deletion)</span>
              </div>
              <p>
                Deactivating <strong className="font-semibold">{advisor.name}</strong> will immediately terminate active login sessions and block new sign-ins.
              </p>
              <p className="text-[11px] text-amber-800">
                All previously assigned mortgage leads, client cases, tasks, and historical records remain fully preserved in your brokerage database. You can reactivate this account anytime.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 leading-relaxed">
              Reactivating <strong className="font-semibold">{advisor.name}</strong> will restore full access to their assigned pipeline leads, tasks, and document reviews.
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
            type="button"
            variant={isCurrentlyActive ? 'destructive' : 'primary'}
            onClick={handleToggle}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending
              ? 'Updating...'
              : isCurrentlyActive
              ? 'Deactivate Advisor'
              : 'Reactivate Advisor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
