import * as React from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Client, ClientStatus, ClientType } from '@/types/client.types'

export interface PortalCaseHeaderProps {
  client: Client
  isRefetching?: boolean
  onRefresh?: () => void
}

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; badgeClass: string }
> = {
  ACTIVE: {
    label: 'Active Application',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  INACTIVE: {
    label: 'Under Review',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  ARCHIVED: {
    label: 'Archived',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

const TYPE_LABELS: Record<ClientType, string> = {
  BUYER: 'Home Purchase Loan',
  SELLER: 'Property Vendor',
  BOTH: 'Buyer & Seller',
  OTHER: 'Specialized Mortgage',
}

export function PortalCaseHeader({
  client,
  isRefetching = false,
  onRefresh,
}: PortalCaseHeaderProps) {
  const [copiedId, setCopiedId] = React.useState(false)

  const handleCopyId = () => {
    navigator.clipboard.writeText(client._id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const brokerageName =
    typeof client.brokerageId === 'object' && client.brokerageId !== null
      ? client.brokerageId.name || 'LeadFlow Brokerage Partner'
      : 'LeadFlow Brokerage Partner'

  const statusConfig = STATUS_CONFIG[client.status] || STATUS_CONFIG.ACTIVE
  const typeLabel = TYPE_LABELS[client.type] || 'Home Purchase Loan'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-2xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* Metadata Row: Brokerage + Case Reference */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{brokerageName}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Reference:</span>
            <button
              type="button"
              onClick={handleCopyId}
              title="Copy full case identifier"
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <span>#{client._id.slice(-6).toUpperCase()}</span>
              {copiedId ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3 text-slate-400" />
              )}
            </button>
          </div>

          {/* Primary Hierarchy: Loan Title & Applicant Name */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              Home Loan Application
            </h1>
            <p className="mt-0.5 text-sm text-slate-600">
              Primary Applicant:{' '}
              <span className="font-semibold text-slate-900">
                {client.firstName} {client.lastName}
              </span>
              <span className="mx-2 text-slate-300">•</span>
              <span className="text-slate-500">{typeLabel}</span>
            </p>
          </div>
        </div>

        {/* Case Status & Actions */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          <span
            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${statusConfig.badgeClass}`}
          >
            {statusConfig.label}
          </span>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefetching}
              className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 text-slate-500 ${isRefetching ? 'animate-spin' : ''}`}
              />
              {isRefetching ? 'Updating...' : 'Refresh'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
