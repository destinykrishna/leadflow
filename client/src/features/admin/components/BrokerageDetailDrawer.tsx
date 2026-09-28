import * as React from 'react'
import {
  X,
  Building2,
  Key,
  Copy,
  Check,
  Users,
  Edit,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  useBrokerage,
  useBrokerageAdvisors,
} from '../api/brokerages.api'
import { formatDate, formatRelativeTime } from '@/lib/format'
import type { BrokerageItem } from '@/types/brokerage.types'

interface BrokerageDetailDrawerProps {
  brokerageId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit: (brokerage: BrokerageItem) => void
  onRotateSecret: (brokerage: BrokerageItem) => void
}

export function BrokerageDetailDrawer({
  brokerageId,
  isOpen,
  onClose,
  onEdit,
  onRotateSecret,
}: BrokerageDetailDrawerProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null)

  const { data: detailData, isLoading: isLoadingDetail } = useBrokerage(
    isOpen ? brokerageId : null
  )
  const { data: advisorsData, isLoading: isLoadingAdvisors } = useBrokerageAdvisors(
    isOpen ? brokerageId : null
  )

  // ESC dismiss
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !brokerageId) return null

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const brokerage = detailData || null
  const webhookUrl = `${window.location.origin}/api/leads/webhook/${brokerageId}`
  const advisors = advisorsData?.advisors || []
  const advisorCount = advisorsData?.total ?? advisors.length

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>
      case 'TRIAL':
        return <Badge variant="warning">Trial</Badge>
      case 'SUSPENDED':
        return <Badge variant="danger">Suspended</Badge>
      default:
        return <Badge variant="neutral">{status || '—'}</Badge>
    }
  }

  const getPlanBadge = (plan?: string) => {
    switch (plan) {
      case 'ENTERPRISE':
        return <Badge variant="default" className="bg-purple-50 text-purple-700 border-purple-200">Enterprise</Badge>
      case 'GROWTH':
        return <Badge variant="default" className="bg-blue-50 text-blue-700 border-blue-200">Growth</Badge>
      case 'STARTER':
        return <Badge variant="neutral">Starter</Badge>
      case 'FREE':
        return <Badge variant="neutral" className="bg-slate-100 text-slate-600">Free</Badge>
      default:
        return <Badge variant="neutral">{plan || '—'}</Badge>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Brokerage Details"
        className="relative z-50 flex h-full w-full sm:max-w-xl md:max-w-2xl flex-col bg-white border-l border-border shadow-2xl animate-in slide-in-from-right duration-250 ease-out"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 sm:px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-slate-800 tracking-tight">
              Brokerage Profile & Credentials
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close brokerage details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {isLoadingDetail || !brokerage ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : (
            <>
              {/* Top Profile Card */}
              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{brokerage.name}</h2>
                      {getStatusBadge(brokerage.status)}
                      {getPlanBadge(brokerage.plan)}
                    </div>
                    {brokerage.slug && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        slug: {brokerage.slug}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(brokerage)}
                      className="gap-1.5 text-xs"
                    >
                      <Edit className="h-3.5 w-3.5 text-slate-600" />
                      <span>Edit Lifecycle</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-border/50 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Organization ID</span>
                    <div className="flex items-center gap-1 font-mono text-slate-800">
                      <span className="truncate">{brokerage._id}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(brokerage._id, 'id')}
                        className="text-slate-400 hover:text-slate-700"
                        title="Copy ID"
                      >
                        {copiedField === 'id' ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">Created</span>
                    <span className="font-medium text-slate-800">
                      {formatDate(brokerage.createdAt)}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">Last Updated</span>
                    <span className="font-medium text-slate-800">
                      {formatRelativeTime(brokerage.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Webhook & Lead Ingestion Card */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-blue-700" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                      Inbound Lead Ingestion Credentials
                    </h3>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRotateSecret(brokerage)}
                    className="gap-1.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                  >
                    <RefreshCw className="h-3 w-3 text-amber-600" />
                    <span>Rotate Secret</span>
                  </Button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 mb-1 block">
                      Webhook Target URL
                    </label>
                    <div className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 border border-slate-200 text-xs font-mono text-slate-800">
                      <span className="truncate">{webhookUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(webhookUrl, 'webhookUrl')}
                        className="inline-flex items-center gap-1 shrink-0 text-slate-500 hover:text-primary transition-colors"
                      >
                        {copiedField === 'webhookUrl' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span className="text-[11px]">
                          {copiedField === 'webhookUrl' ? 'Copied' : 'Copy'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-700 mb-1 block">
                      Active Webhook Secret
                    </label>
                    <div className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 border border-slate-200 text-xs font-mono text-slate-800">
                      <span className="truncate">
                        {brokerage.webhookSecret || '••••••••••••••••••••••••••••••••'}
                      </span>
                      {brokerage.webhookSecret && (
                        <button
                          type="button"
                          onClick={() => handleCopy(brokerage.webhookSecret!, 'webhookSecret')}
                          className="inline-flex items-center gap-1 shrink-0 text-slate-500 hover:text-primary transition-colors"
                        >
                          {copiedField === 'webhookSecret' ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span className="text-[11px]">
                            {copiedField === 'webhookSecret' ? 'Copied' : 'Copy'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-blue-900/80 leading-relaxed rounded-md bg-blue-100/40 p-2.5">
                  <span className="font-semibold">Integration Header: </span>
                  Send payloads with HTTP header{' '}
                  <code className="bg-white/80 px-1 py-0.5 rounded text-[11px] font-mono border border-blue-200">
                    x-webhook-secret: &lt;secret&gt;
                  </code>
                  . Dual HMAC SHA-256 signatures are also supported via{' '}
                  <code className="bg-white/80 px-1 py-0.5 rounded text-[11px] font-mono border border-blue-200">
                    x-signature-sha256
                  </code>
                  .
                </div>
              </div>

              {/* Team & Members Overview */}
              <div className="rounded-xl border border-border/80 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Team & Advisors ({isLoadingAdvisors ? '...' : advisorCount})
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Tenant User Accounts
                  </span>
                </div>

                {isLoadingAdvisors ? (
                  <Skeleton className="h-16 w-full rounded" />
                ) : advisors.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-border">
                    No individual advisor accounts provisioned yet for this brokerage.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {advisors.slice(0, 5).map((adv: any) => (
                      <div
                        key={adv._id || adv.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs"
                      >
                        <div>
                          <span className="font-medium text-slate-900 block">{adv.name}</span>
                          <span className="text-[11px] text-muted-foreground">{adv.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="neutral" size="sm">
                            {adv.role}
                          </Badge>
                          <Badge
                            variant={adv.status === 'ACTIVE' ? 'success' : 'neutral'}
                            size="sm"
                          >
                            {adv.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {advisorCount > 5 && (
                      <p className="text-[11px] text-center text-muted-foreground pt-1">
                        + {advisorCount - 5} more advisors
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
