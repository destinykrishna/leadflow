import { Zap } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function TriggersPage() {
  return (
    <FeatureShell
      title="Stage Automations"
      subtitle="Automated client emails and task reminders triggered by pipeline moves"
      icon={<Zap className="h-6 w-6 text-primary" />}
      emptyTitle="No Custom Automations"
      emptyDescription="Automatic welcome notifications and advisor tasks can be configured for each column."
    />
  )
}
