import { Home } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function ClientCasePage() {
  return (
    <FeatureShell
      title="My Mortgage Loan Application"
      subtitle="Track your German expat financing timeline, property details, and bank submission status"
      icon={<Home className="h-6 w-6 text-primary" />}
      emptyTitle="Financing File in Preparation"
      emptyDescription="Your advisor is assembling your mortgage dossier. Upload your required documents to expedite review."
    />
  )
}
