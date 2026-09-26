import * as React from 'react'
import { Mail, Phone, Check, Copy } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import type { Client, ClientAdvisorDetails } from '@/types/client.types'

export interface PortalAdvisorCardProps {
  client: Client
}

export function PortalAdvisorCard({ client }: PortalAdvisorCardProps) {
  const [copiedEmail, setCopiedEmail] = React.useState(false)

  // Resolve assigned advisor
  const advisor: ClientAdvisorDetails | null = React.useMemo(() => {
    if (!client.assignedTo) return null
    if (typeof client.assignedTo === 'object' && client.assignedTo !== null) {
      return client.assignedTo as ClientAdvisorDetails
    }
    return null
  }, [client.assignedTo])

  const brokerageName =
    typeof client.brokerageId === 'object' && client.brokerageId !== null
      ? client.brokerageId.name || 'LeadFlow Brokerage Partner'
      : 'LeadFlow Brokerage Partner'

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  return (
    <Card className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Assigned Loan Advisor
        </h2>
        <p className="text-xs text-slate-500">
          Direct advisory contact for your loan application
        </p>
      </div>

      {advisor ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Avatar name={advisor.name} size="md" className="h-10 w-10 text-xs font-semibold" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {advisor.name}
              </p>
              <p className="text-xs text-slate-500">
                Mortgage Specialist
              </p>
              <p className="text-xs text-slate-400">
                {brokerageName}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {advisor.email && (
              <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50/50 px-2.5 py-1.5">
                <a
                  href={`mailto:${advisor.email}`}
                  className="flex items-center gap-2 text-slate-700 hover:text-primary truncate"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{advisor.email}</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyEmail(advisor.email)}
                  title="Copy email address"
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  {copiedEmail ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            )}

            {advisor.phone ? (
              <div className="flex items-center rounded border border-slate-200 bg-slate-50/50 px-2.5 py-1.5">
                <a
                  href={`tel:${advisor.phone}`}
                  className="flex items-center gap-2 text-slate-700 hover:text-primary truncate"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{advisor.phone}</span>
                </a>
              </div>
            ) : (
              <div className="flex items-center rounded border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-slate-400">
                <Phone className="h-3.5 w-3.5 shrink-0 mr-2" />
                <span>Phone available via brokerage</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Your advisor coordinates bank eligibility checks, rate options, and loan sanction on your behalf.
          </p>
        </div>
      ) : (
        <div className="rounded border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">Advisory Desk Allocation</p>
          <p className="text-[11px] leading-relaxed">
            Your application file is in the advisor assignment queue. A dedicated specialist from {brokerageName} will be allocated shortly.
          </p>
        </div>
      )}
    </Card>
  )
}
