import * as React from 'react'
import { Mail, Phone, UserCheck, Building2, Check, Copy } from 'lucide-react'
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
      ? client.brokerageId.name || 'LeadFlow Partner Brokerage'
      : 'LeadFlow Partner Brokerage'

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  return (
    <Card className="p-5 border-slate-200/80 bg-white shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Assigned Mortgage Specialist
          </h2>
          <p className="text-xs text-muted-foreground">
            Direct dedicated advisory support for your property acquisition
          </p>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
          <UserCheck className="h-3 w-3" />
          Dedicated Support
        </span>
      </div>

      {advisor ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3.5">
            <Avatar name={advisor.name} size="md" className="h-11 w-11 text-sm font-bold" />
            <div className="space-y-0.5 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                {advisor.name}
              </h3>
              <p className="text-xs text-slate-500">
                Senior Mortgage Specialist
              </p>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Building2 className="h-3 w-3 text-slate-400" />
                <span>{brokerageName}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {advisor.email && (
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2 text-xs">
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
              <div className="flex items-center rounded-lg border border-slate-100 bg-slate-50/60 p-2 text-xs">
                <a
                  href={`tel:${advisor.phone}`}
                  className="flex items-center gap-2 text-slate-700 hover:text-primary truncate"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{advisor.phone}</span>
                </a>
              </div>
            ) : (
              <div className="flex items-center rounded-lg border border-slate-100 bg-slate-50/60 p-2 text-xs text-slate-400">
                <Phone className="h-3.5 w-3.5 shrink-0 mr-1.5" />
                <span>Phone available via desk</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5 leading-relaxed border border-slate-100">
            Have questions about bank loan tenure, interest schemes, or property valuation? Reach out directly to your advisor at any stage.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-semibold text-slate-900">
              Mortgage Advisory Team ({brokerageName})
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your file is currently in our active allocation queue. A dedicated senior advisor will be assigned to manage your bank documentation and property legal check.
          </p>
        </div>
      )}
    </Card>
  )
}
