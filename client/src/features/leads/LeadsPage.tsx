import { Users } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function LeadsPage() {
  return (
    <FeatureShell
      title="Lead Inquiries"
      subtitle="Review prospective mortgage clients and initial property inquiries"
      icon={<Users className="h-6 w-6 text-primary" />}
      emptyTitle="No Inbound Inquiries"
      emptyDescription="Prospects who submit financing inquiries through web forms will be listed here."
    />
  )
}
