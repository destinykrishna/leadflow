import * as React from 'react'
import { Copy, Check, Building2, ShieldCheck, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Client, ClientStatus, ClientType } from '@/types/client.types'

export interface PortalCaseHeaderProps {
  client: Client
  isRefetching?: boolean
  onRefresh?: () => void
}

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; variant: 'success' | 'neutral' | 'danger' }
> = {
  ACTIVE: { label: 'Active Mortgage Case', variant: 'success' },
  INACTIVE: { label: 'Case Under Review', variant: 'neutral' },
  ARCHIVED: { label: 'Archived File', variant: 'neutral' },
}

const TYPE_LABELS: Record<ClientType, string> = {
  BUYER: 'Home Buyer / Borrower',
  SELLER: 'Property Vendor',
  BOTH: 'Buyer & Seller',
  OTHER: 'Specialized Financing',
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
      ? client.brokerageId.name || 'LeadFlow Partner Brokerage'
      : 'LeadFlow Partner Brokerage'

  const statusConfig = STATUS_CONFIG[client.status] || STATUS_CONFIG.ACTIVE
  const typeLabel = TYPE_LABELS[client.type] || 'Home Loan Application'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 text-white shadow-sm">
      {/* Decorative background glows */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur-xs">
              <Building2 className="h-3.5 w-3.5 text-blue-400" />
              {brokerageName}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified Client Portal
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Welcome back, {client.firstName}
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Track your home loan journey, review verification documents, and stay in direct touch with your assigned mortgage specialist.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant={statusConfig.variant} size="sm">
              {statusConfig.label}
            </Badge>

            <span className="rounded-md bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-200">
              {typeLabel}
            </span>

            {/* Case Reference Token with Copy */}
            <button
              type="button"
              onClick={handleCopyId}
              title="Copy full case ID"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-xs text-slate-300 transition-colors hover:bg-white/15 hover:text-white"
            >
              <span>Case #{client._id.slice(-6).toUpperCase()}</span>
              {copiedId ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {onRefresh && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefetching}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`}
              />
              {isRefetching ? 'Updating...' : 'Refresh Status'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
