import { CheckSquare } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function TasksPage() {
  return (
    <FeatureShell
      title="Advisor Tasks"
      subtitle="Follow-up action items, borrower outreach milestones, and bank submission deadlines"
      icon={<CheckSquare className="h-6 w-6 text-primary" />}
      emptyTitle="No Pending Tasks"
      emptyDescription="All advisor follow-ups are up to date. New tasks will be scheduled as leads advance."
    />
  )
}
