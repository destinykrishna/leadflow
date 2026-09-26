import * as React from 'react'
import {
  Mail,
  Phone,
  Building2,
  Check,
  Copy,
  HelpCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useMyCase } from '@/features/clients/api/clients.api'
import type { ClientAdvisorDetails } from '@/types/client.types'

export function ClientAdvisorPage() {
  const { data: client, isLoading, isError, error, refetch } = useMyCase()
  const [copiedEmail, setCopiedEmail] = React.useState(false)

  const advisor: ClientAdvisorDetails | null = React.useMemo(() => {
    if (!client?.assignedTo) return null
    if (typeof client.assignedTo === 'object' && client.assignedTo !== null) {
      return client.assignedTo as ClientAdvisorDetails
    }
    return null
  }, [client?.assignedTo])

  const brokerageName =
    typeof client?.brokerageId === 'object' && client.brokerageId !== null
      ? client.brokerageId.name || 'LeadFlow Brokerage Partner'
      : 'LeadFlow Brokerage Partner'

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-12 max-w-4xl mx-auto">
        <ErrorState
          title="Unable to Load Advisor Details"
          message={
            (error as Error)?.message ||
            'There was an unexpected error retrieving your assigned mortgage advisor. Please verify your connection and try again.'
          }
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
          Mortgage Advisory Desk
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Direct advisory contact for bank negotiations, document verification, and sanction tracking
        </p>
      </div>

      {/* Advisor Profile Card */}
      {advisor ? (
        <Card className="p-6 border-slate-200 bg-white rounded-lg shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar name={advisor.name} size="lg" className="h-14 w-14 text-base font-semibold" />
              <div className="space-y-0.5">
                <h2 className="text-base font-bold text-slate-900">
                  {advisor.name}
                </h2>
                <p className="text-xs text-slate-600">
                  Senior Mortgage Specialist
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>{brokerageName}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {advisor.email && (
                <a href={`mailto:${advisor.email}`}>
                  <Button size="sm" className="h-8 gap-1.5 text-xs bg-primary text-white hover:bg-primary/90">
                    <Mail className="h-3.5 w-3.5" />
                    Send Email
                  </Button>
                </a>
              )}
              {advisor.phone && (
                <a href={`tel:${advisor.phone}`}>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-slate-200 text-slate-700 hover:bg-slate-50">
                    <Phone className="h-3.5 w-3.5" />
                    Call Advisor
                  </Button>
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/50 p-2.5 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                    Direct Email
                  </span>
                  <span className="font-medium text-slate-900 truncate block">
                    {advisor.email}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyEmail(advisor.email)}
                className="p-1 text-slate-400 hover:text-slate-700 ml-2"
                title="Copy email"
              >
                {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex items-center rounded-md border border-slate-200 bg-slate-50/50 p-2.5 text-xs">
              <Phone className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Contact Phone
                </span>
                <span className="font-medium text-slate-900">
                  {advisor.phone || 'Available via brokerage central line'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-700 space-y-1.5">
            <p className="font-semibold text-slate-900">
              Advisory Scope & Responsibilities:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs">
              <li>Lender comparison and interest rate negotiation across major Indian banks.</li>
              <li>Income assessment, debt-to-income calculation, and credit bureau review.</li>
              <li>Coordination of property valuation, title search, and legal vetting.</li>
              <li>Expediting formal sanction letter issuance and disbursement schedules.</li>
            </ul>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center border-slate-200 bg-white rounded-lg">
          <Building2 className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            Advisory Desk — {brokerageName}
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Your mortgage application is in the queue for advisor assignment. A licensed advisor will be linked to your file shortly.
          </p>
        </Card>
      )}

      {/* Advisory FAQ */}
      <Card className="p-6 border-slate-200 bg-white rounded-lg shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">
            Frequently Asked Questions
          </h3>
        </div>

        <div className="space-y-3 divide-y divide-slate-100 text-xs">
          <div className="pt-2 space-y-1">
            <h4 className="font-semibold text-slate-900">
              How long does document verification and bank sanction take?
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Automated document verification completes within minutes of upload. Once KYC and income proofs are confirmed, in-principle bank sanction typically takes 3 to 5 business days.
            </p>
          </div>

          <div className="pt-3 space-y-1">
            <h4 className="font-semibold text-slate-900">
              Can I upload photos of my documents or do I need scanned PDFs?
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Clear photos (JPEG/PNG) and scanned PDFs are accepted (up to 10MB per file). Ensure all four corners are visible and text is sharp and unblurred.
            </p>
          </div>

          <div className="pt-3 space-y-1">
            <h4 className="font-semibold text-slate-900">
              What should I do if a document is marked &quot;Needs Attention&quot;?
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Review the specific note provided on the document row (such as missing pages or blurriness). Then click &quot;Re-upload&quot; to submit a corrected file.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
