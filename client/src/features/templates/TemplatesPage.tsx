import { Mail } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function TemplatesPage() {
  return (
    <FeatureShell
      title="Email Templates"
      subtitle="Standardized client communication templates for pipeline notifications"
      icon={<Mail className="h-6 w-6 text-primary" />}
      emptyTitle="No Custom Templates"
      emptyDescription="Standard notification templates are active. Brokerage admins can create custom templates here."
    />
  )
}
