import { Briefcase } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function ClientsPage() {
  return (
    <FeatureShell
      title="Mortgage Cases"
      subtitle="Active borrower financing files, loan details, and advisor assignments"
      icon={<Briefcase className="h-6 w-6 text-primary" />}
      emptyTitle="No Active Cases"
      emptyDescription="Converted applicants with active mortgage cases will be displayed here."
    />
  )
}
