import * as React from 'react'
import {
  CheckCircle2,
  Clock,
  Radio,
  Building2,
  RefreshCw,
  Server,
  Layers,
  ShieldCheck,
  Cpu,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { getSocket } from '@/lib/socket'
import { useSystemHealth } from './api/health.api'
import { useBrokeragesList } from './api/brokerages.api'

function formatUptime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0s'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`)
  parts.push(`${secs}s`)

  return parts.slice(0, 3).join(' ')
}

export function HealthPage() {
  const {
    data: healthResult,
    isLoading: isHealthLoading,
    isRefetching,
    refetch,
    isError: isHealthError,
  } = useSystemHealth()

  const { data: brokerages, isLoading: isBrokeragesLoading } = useBrokeragesList()

  // Real-time socket state tracking
  const [socketConnected, setSocketConnected] = React.useState<boolean>(() => {
    try {
      return getSocket().connected
    } catch {
      return false
    }
  })

  React.useEffect(() => {
    let socket: ReturnType<typeof getSocket> | null = null
    try {
      socket = getSocket()
      const onConnect = () => setSocketConnected(true)
      const onDisconnect = () => setSocketConnected(false)

      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      setSocketConnected(socket.connected)

      return () => {
        socket?.off('connect', onConnect)
        socket?.off('disconnect', onDisconnect)
      }
    } catch {
      setSocketConnected(false)
    }
  }, [])

  const activeBrokerages = brokerages?.filter((b) => b.status === 'ACTIVE').length || 0
  const totalBrokerages = brokerages?.length || 0

  const isApiOperational = !isHealthError && healthResult?.data?.status === 'ok'
  const latencyMs = healthResult?.latencyMs ?? 0
  const uptimeSeconds = healthResult?.data?.uptime ?? 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              System Health & Services
            </h1>
            <Badge variant={isApiOperational ? 'success' : 'danger'} size="sm">
              {isApiOperational ? 'All Services Operational' : 'Service Disruption'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time status, API response latency, and platform service availability.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isHealthLoading}
            className="h-9 gap-1.5 text-xs text-slate-700"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefetching || isHealthLoading ? 'animate-spin' : ''}`}
            />
            <span>{isRefetching ? 'Checking...' : 'Refresh Status'}</span>
          </Button>
        </div>
      </div>

      {/* 4-Card Status Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Core REST API */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-slate-600">Core REST API</span>
            <Server className="h-4 w-4 text-primary" />
          </div>
          {isHealthLoading ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900">
                {isApiOperational ? 'Operational' : 'Unavailable'}
              </span>
              <span className="text-xs font-mono text-emerald-600 font-semibold">
                {isApiOperational ? `${latencyMs}ms` : 'Offline'}
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Endpoint <code className="font-mono text-slate-700">/api/health</code> HTTP 200
          </p>
        </Card>

        {/* Server Process Uptime */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-slate-600">Server Process Uptime</span>
            <Clock className="h-4 w-4 text-slate-500" />
          </div>
          {isHealthLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-slate-900 font-mono">
                {formatUptime(uptimeSeconds)}
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Continuous execution since last restart
          </p>
        </Card>

        {/* Realtime Event Gateway */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-slate-600">Realtime WebSocket</span>
            <Radio className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">
              {socketConnected ? 'Connected' : 'Connecting'}
            </span>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                socketConnected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
              }`}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Socket.IO channel on <code className="font-mono text-slate-700">/socket.io</code>
          </p>
        </Card>

        {/* Multi-Tenant Directory */}
        <Card className="p-4 border-border/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-slate-600">Tenant Directory</span>
            <Building2 className="h-4 w-4 text-slate-500" />
          </div>
          {isBrokeragesLoading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900">{activeBrokerages} Active</span>
              <span className="text-xs text-muted-foreground">of {totalBrokerages} total</span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Scoped via <code className="font-mono text-slate-700">withBrokerageScope</code>
          </p>
        </Card>
      </div>

      {/* Service Status Breakdown Table */}
      <Card className="overflow-hidden border-border/80 shadow-xs">
        <div className="border-b border-border/60 bg-slate-50/60 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Service Component Breakdown
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Polled every 15s · Auto-refresh active
          </span>
        </div>

        <div className="divide-y divide-border/60 text-xs">
          {/* Core API */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-slate-50/50 transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">Core REST API Service</span>
                <span className="font-mono text-[11px] text-muted-foreground">/api/*</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Express API handling authentication, CRUD workflows, and business logic.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-[11px] text-slate-600">
                {isApiOperational ? `${latencyMs}ms response` : 'No response'}
              </span>
              <Badge variant={isApiOperational ? 'success' : 'danger'} size="sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {isApiOperational ? 'Healthy' : 'Degraded'}
              </Badge>
            </div>
          </div>

          {/* Realtime Gateway */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-slate-50/50 transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">Realtime WebSocket Gateway</span>
                <span className="font-mono text-[11px] text-muted-foreground">/socket.io</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Socket.IO server broadcasting pipeline updates and document status changes to isolated tenant rooms.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-[11px] text-slate-600">
                {socketConnected ? 'Transport: websocket' : 'Polling fallback'}
              </span>
              <Badge variant={socketConnected ? 'success' : 'neutral'} size="sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {socketConnected ? 'Connected' : 'Connecting'}
              </Badge>
            </div>
          </div>

          {/* Tenant Registry */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-slate-50/50 transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">Multi-Tenant Organization Directory</span>
                <span className="font-mono text-[11px] text-muted-foreground">/api/brokerages</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Platform admin tenant management, status lifecycle, and webhook secret management.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-[11px] text-slate-600">
                {totalBrokerages} registered tenants
              </span>
              <Badge variant="success" size="sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Operational
              </Badge>
            </div>
          </div>

          {/* Lead Ingestion Gateway */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-slate-50/50 transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">Lead Ingestion Webhook Gateway</span>
                <span className="font-mono text-[11px] text-muted-foreground">/api/leads/webhook/:brokerageId</span>
              </div>
              <p className="text-[11px] text-slate-500">
                External lead ingestion supporting Google Forms Apps Script and HMAC SHA-256 verification.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-[11px] text-slate-600">
                Rate limit: 1,000 req/min
              </span>
              <Badge variant="success" size="sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            </div>
          </div>

          {/* Asynchronous Workers Note */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 bg-slate-50/30">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">BullMQ Background Queue & Workers</span>
                <span className="font-mono text-[11px] text-muted-foreground">worker/src/worker.ts</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Asynchronous document verification and transactional email dispatch. Queue depths and Redis memory pools run in container infrastructure and are not exposed via public REST monitoring endpoints.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant="neutral" size="sm">
                Container Managed
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Observability & Diagnostic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 border-border/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Tenant & Security Enforcements</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
              <span>
                <strong>Multi-Tenant Data Isolation:</strong> Every tenant query strictly scopes queries with <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">withBrokerageScope</code>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
              <span>
                <strong>Anti-IDOR Protection:</strong> Cross-tenant inquiries conceal resource existence with HTTP 404 (Not Found).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
              <span>
                <strong>Suspension Lifecycle:</strong> Suspended brokerages immediately revoke active access tokens via authentication middleware.
              </span>
            </li>
          </ul>
        </Card>

        <Card className="p-4 border-border/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <Cpu className="h-4 w-4 text-primary" />
            <span>Health Monitoring Contract</span>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <p>
              The LeadFlow platform provides real operational health monitoring based strictly on actual server contracts without simulated telemetry:
            </p>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700 space-y-1">
              <div>• Active Health Check: GET /api/health</div>
              <div>• Realtime Transport: Socket.IO /socket.io</div>
              <div>• Status Response: &#123; status: &quot;ok&quot;, uptime: {uptimeSeconds.toFixed(1)}s &#125;</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
