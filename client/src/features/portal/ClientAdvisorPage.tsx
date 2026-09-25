import { UserCheck } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function ClientAdvisorPage() {
  return (
    <FeatureShell
      title="Designated Mortgage Advisor"
      subtitle="Direct contact information and appointment assistance for your property purchase"
      icon={<UserCheck className="h-6 w-6 text-primary" />}
      emptyTitle="Mortgage Specialist Assigned"
      emptyDescription="Your advisor is actively managing your case and can be reached via your registered email."
    />
  )
}
