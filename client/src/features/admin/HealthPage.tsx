import { Activity } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function HealthPage() {
  return (
    <FeatureShell
      title="System Status"
      subtitle="Overview of platform services, queue processing, and system connectivity"
      icon={<Activity className="h-6 w-6 text-primary" />}
      emptyTitle="All Systems Operational"
      emptyDescription="Database connections, storage gateways, and background queue workers are operational."
    />
  )
}
