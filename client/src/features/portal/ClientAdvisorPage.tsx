import * as React from 'react'
import {
  UserCheck,
  Mail,
  Phone,
  Building2,
  ShieldCheck,
  Check,
  Copy,
  HelpCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMyCase } from '@/features/clients/api/clients.api'
import type { ClientAdvisorDetails } from '@/types/client.types'

export function ClientAdvisorPage() {
  const { data: client, isLoading } = useMyCase()
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
      ? client.brokerageId.name || 'LeadFlow Partner Brokerage'
      : 'LeadFlow Partner Brokerage'

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="border-b border-border/80 pb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Mortgage Specialist & Advisory Desk
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            <UserCheck className="h-3.5 w-3.5" />
            Direct Support
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Connect directly with your licensed advisor for rate negotiations, bank coordination, and valuation updates.
        </p>
      </div>

      {/* Advisor Profile Card */}
      {advisor ? (
        <Card className="p-6 border-slate-200/80 bg-white shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar name={advisor.name} size="lg" className="h-16 w-16 text-lg font-bold" />
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {advisor.name}
                </h2>
                <p className="text-xs font-medium text-primary">
                  Senior Mortgage Specialist & Loan Underwriting Advisor
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>{brokerageName}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {advisor.email && (
                <a href={`mailto:${advisor.email}`}>
                  <Button size="sm" className="h-9 gap-1.5 text-xs">
                    <Mail className="h-3.5 w-3.5" />
                    Send Email
                  </Button>
                </a>
              )}
              {advisor.phone && (
                <a href={`tel:${advisor.phone}`}>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                    <Phone className="h-3.5 w-3.5" />
                    Call Advisor
                  </Button>
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
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

            <div className="flex items-center rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
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

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900 space-y-1">
            <h4 className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              What your advisor manages on your behalf:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-blue-800 text-[11px] pt-1">
              <li>Comparing top bank interest rates (SBI, HDFC, ICICI, Axis, Bank of Baroda).</li>
              <li>Pre-screening your CIBIL score and debt-to-income eligibility ratios.</li>
              <li>Arranging the property physical inspection and legal title clearance.</li>
              <li>Expediting bank sanction letter issuance and final disbursement schedules.</li>
            </ul>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center border-slate-200/80 bg-white">
          <Building2 className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-3 text-base font-bold text-slate-900">
            Advisory Desk — {brokerageName}
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Your mortgage file is undergoing initial KYC intake. Our senior advisor desk will be in direct contact once your file is allocated.
          </p>
        </Card>
      )}

      {/* Advisory FAQ / Journey steps */}
      <Card className="p-6 border-slate-200/80 bg-white shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">
            Frequently Asked Questions by Home Loan Applicants
          </h3>
        </div>

        <div className="space-y-3 divide-y divide-slate-100 text-xs">
          <div className="pt-2 space-y-1">
            <h4 className="font-semibold text-slate-900">
              How long does document verification and bank sanction take?
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Automated document verification takes just minutes upon upload. Once all KYC and income proofs are verified, bank in-principle sanction typically takes 3 to 5 business days.
            </p>
          </div>

          <div className="pt-3 space-y-1">
            <h4 className="font-semibold text-slate-900">
              Can I upload photos of my documents or do I need scanned PDFs?
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Clear photos (JPEG/PNG) and scanned PDFs are accepted (up to 10MB per file). Ensure all 4 corners of the document are visible with zero blurriness or glare.
            </p>
          </div>

          <div className="pt-3 space-y-1">
            <h4 className="font-semibold text-slate-900">
              What happens if my document is marked &quot;Needs Attention&quot;?
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Our automated system or your advisor will leave a specific note explaining what was missing (e.g. missing employer stamp or incomplete bank statement duration). Simply click &quot;Re-upload&quot; with the corrected file.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
