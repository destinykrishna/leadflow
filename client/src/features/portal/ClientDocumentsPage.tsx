import { UploadCloud } from 'lucide-react'
import { FeatureShell } from '@/components/layout/FeatureShell'

export function ClientDocumentsPage() {
  return (
    <FeatureShell
      title="Document Upload Center"
      subtitle="Upload required German mortgage records (Payslips, Passport, SCHUFA, Bank Statements)"
      icon={<UploadCloud className="h-6 w-6 text-primary" />}
      emptyTitle="No Documents Uploaded Yet"
      emptyDescription="Upload your employment payslips, tax certificates, and identification to begin verification."
    />
  )
}
