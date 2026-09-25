import { ShieldAlert } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function AuditPage() {
  return (
    <FeatureShell
      title="Security and Activity Logs"
      subtitle="Administrative event logs, account changes, and organizational activity"
      icon={<ShieldAlert className="h-6 w-6 text-primary" />}
      emptyTitle="No Recent Security Events"
      emptyDescription="System access attempts and account changes will be logged here."
    />
  )
}
