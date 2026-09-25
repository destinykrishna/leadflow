import { Building2 } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function BrokeragesPage() {
  return (
    <FeatureShell
      title="Brokerages"
      subtitle="Manage partner brokerages, subscription plans, and organizational accounts"
      icon={<Building2 className="h-6 w-6 text-primary" />}
      emptyTitle="Brokerage Directory"
      emptyDescription="Active brokerage organizations will be listed here."
    />
  )
}
