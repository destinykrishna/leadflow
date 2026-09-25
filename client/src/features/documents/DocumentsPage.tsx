import { FileText } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function DocumentsPage() {
  return (
    <FeatureShell
      title="Document Verification"
      subtitle="Review uploaded borrower payslips, tax records, SCHUFA certificates, and bank statements"
      icon={<FileText className="h-6 w-6 text-primary" />}
      emptyTitle="No Documents Pending Review"
      emptyDescription="Uploaded borrower records requiring review and bank validation will be listed here."
    />
  )
}
