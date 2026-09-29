import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import {
  User,
  Building2,
  ShieldCheck,
  Globe,
  Lock,
  Copy,
  Check,
  LogOut,
  X,
  CreditCard,
  BadgeCheck,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/format'
import { useMyCase } from '@/features/clients/api/clients.api'
import type { ApiResponse } from '@/types/api.types'
import { formatBrokerageName, formatUserEmail, sanitizeIndianMortgageText } from '@/lib/presentation'

interface ProfileSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMac?: boolean
}

type SettingsTab = 'profile' | 'organization' | 'localization' | 'security'

interface BrokerageResponse {
  brokerage: {
    _id: string
    name: string
    slug: string
    plan: string
    status: string
    createdAt: string
  }
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
  isMac = false,
}: ProfileSettingsModalProps) {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('profile')
  const [copiedField, setCopiedField] = React.useState<string | null>(null)

  // Fetch brokerage details if user has a brokerageId
  const { data: brokerageData } = useQuery({
    queryKey: ['brokerage', user?.brokerageId],
    queryFn: async () => {
      if (!user?.brokerageId) return null
      const res = await api.get<ApiResponse<BrokerageResponse>>(`/brokerages/${user.brokerageId}`)
      return res.data.data?.brokerage ?? null
    },
    enabled: open && Boolean(user?.brokerageId) && user?.role !== 'CLIENT',
    staleTime: 5 * 60 * 1000,
  })

  // Fetch client personal case details only if user is a client and modal is open
  const isClientRole = user?.role === 'CLIENT'
  const { data: clientCase } = useMyCase({ enabled: open && isClientRole })

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
        return 'danger'
      case 'BROKERAGE_ADMIN':
        return 'default'
      case 'ADVISOR':
        return 'success'
      case 'CLIENT':
        return 'neutral'
      default:
        return 'neutral'
    }
  }

  const formatRoleLabel = (role?: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
        return 'Platform Superadmin'
      case 'BROKERAGE_ADMIN':
        return 'Brokerage Administrator'
      case 'ADVISOR':
        return 'Mortgage Advisor'
      case 'CLIENT':
        return 'Mortgage Client / Borrower'
      default:
        return 'User'
    }
  }

  const getRolePermissions = (role?: string): string[] => {
    switch (role) {
      case 'PLATFORM_ADMIN':
        return [
          'Complete administrative oversight across all partner brokerages and workspaces',
          'Provision, configure, and monitor partner brokerage accounts',
          'Access platform health diagnostics and operational audit records',
          'Manage global brokerage configurations and system settings',
        ]
      case 'BROKERAGE_ADMIN':
        return [
          'Manage all pipeline leads and borrower cases within your brokerage',
          'Configure stage transition automation rules and standardized email templates',
          'Review team document verification queues and task assignments',
          'Invite and manage brokerage advisors and operational staff',
        ]
      case 'ADVISOR':
        return [
          'Manage assigned borrower leads across the 7-stage Kanban pipeline',
          'Perform client case conversions and loan structure evaluations',
          'Verify KYC, income proofs, and bank statements with inspection notes',
          'Schedule, track, and complete borrower follow-up tasks',
        ]
      case 'CLIENT':
        return [
          'View loan case milestones, target financing amount, and LTV ratios',
          'Self-service upload of KYC, salary slips, and property documents',
          'Real-time tracking of document verification status',
          'Direct advisory desk contact details and inquiry messaging',
        ]
      default:
        return ['Standard authenticated user access']
    }
  }

  const permissions = getRolePermissions(user?.role)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-150 focus:outline-none overflow-hidden p-0 max-h-[90vh] flex flex-col">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <Avatar name={user?.name} size="md" className="h-10 w-10 ring-2 ring-white shadow-2xs" />
              <div>
                <DialogPrimitive.Title className="text-sm md:text-base font-bold text-slate-900 leading-tight">
                  {user?.name || 'Account Settings'}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">
                  {user?.email} • {formatRoleLabel(user?.role)}
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center border-b border-border px-6 gap-1 bg-white overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Identity & Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('organization')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'organization'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Organization</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('localization')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'localization'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Preferences</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'security'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Security & Roles</span>
            </button>
          </div>

          {/* Modal Body / Tab Contents */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* 1. Identity & Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-slate-50/40">
                  <div className="flex items-center gap-3.5">
                    <Avatar name={user?.name} size="lg" className="h-14 w-14 font-bold text-base" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{sanitizeIndianMortgageText(user?.name)}</h3>
                      <p className="text-xs text-muted-foreground">{formatUserEmail(user?.email)}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant={getRoleBadgeVariant(user?.role)} size="sm">
                          {formatRoleLabel(user?.role)}
                        </Badge>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Account Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Designation */}
                  <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Designation
                    </span>
                    <p className="font-semibold text-xs text-slate-900 truncate">
                      {formatRoleLabel(user?.role)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Assigned business responsibility
                    </p>
                  </div>

                  {/* Registered Email */}
                  <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Login Email
                      </span>
                      <button
                        type="button"
                        onClick={() => user?.email && handleCopy(user.email, 'email')}
                        className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                        title="Copy Email"
                      >
                        {copiedField === 'email' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="font-medium text-xs text-slate-900 truncate">
                      {formatUserEmail(user?.email) || '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Primary contact and sign-in email
                    </p>
                  </div>
                </div>

                {/* Client Case Summary if CLIENT role */}
                {isClientRole && clientCase && (
                  <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/40 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-700" />
                        <span className="font-bold text-blue-900">
                          Linked Mortgage Dossier
                        </span>
                      </div>
                      <Badge variant="success" size="sm">
                        Active Case
                      </Badge>
                    </div>
                    <p className="text-blue-800 leading-relaxed">
                      Your portal profile is linked to your active loan file. Assigned to mortgage specialist{' '}
                      <span className="font-semibold">
                        {typeof clientCase.assignedTo === 'object' && clientCase.assignedTo !== null
                          ? (clientCase.assignedTo as { name?: string }).name || 'Senior Advisor'
                          : 'Senior Advisor'}
                      </span>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 2. Organization Tab */}
            {activeTab === 'organization' && (
              <div className="space-y-4">
                {user?.role === 'PLATFORM_ADMIN' ? (
                  <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-3">
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>Platform Administration</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      As a Platform Administrator, you have oversight across all partner brokerages, system operations, and audit records.
                    </p>
                    <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2 text-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Administrative Scope:</span>
                        <span className="text-slate-900 font-semibold">Global Platform</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Directory Access:</span>
                        <span className="text-emerald-700 font-semibold">Active & Operational</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">
                              {formatBrokerageName(brokerageData?.name)}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Licensed Mortgage Consultancy
                            </p>
                          </div>
                        </div>
                        {brokerageData?.plan && (
                          <Badge variant="default" size="sm">
                            {brokerageData.plan} Plan
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                            Firm Status
                          </span>
                          <span className="font-semibold text-emerald-700 block mt-1">
                            {brokerageData?.status === 'ACTIVE' ? 'Active & In Good Standing' : 'Active'}
                          </span>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                            Account Type
                          </span>
                          <span className="font-semibold text-slate-900 block mt-1">
                            Professional Brokerage
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-blue-950">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <span>Private Brokerage Workspace</span>
                      </div>
                      <p className="text-blue-800 text-[11px] leading-relaxed">
                        Your account is registered with <strong className="font-semibold">{formatBrokerageName(brokerageData?.name)}</strong>. All borrower inquiries, loan cases, and financial dossiers are strictly private and accessible only to authorized team members within your firm.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Localization & Preferences Tab */}
            {activeTab === 'localization' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Mortgage Financial Standards
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                        Base Currency
                      </span>
                      <p className="font-bold text-slate-900">
                        Indian Rupee (INR — ₹)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Standard Indian Numbering Format (Lakhs & Crores)
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                        Sample Volume Formatting
                      </span>
                      <p className="font-bold text-slate-900 font-mono">
                        {formatCurrency(7500000)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Loan volume display convention
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                        Date Presentation
                      </span>
                      <p className="font-bold text-slate-900">
                        {formatDate(new Date())}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Standard convention (DD MMM YYYY)
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                        Time Zone & Region
                      </span>
                      <p className="font-bold text-slate-900">
                        IST (UTC+5:30)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Indian Standard Time & Banking Hours
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>Keyboard Navigation Available</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Navigate pages swiftly using shortcuts: press{' '}
                    <kbd className="font-mono px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">
                      {isMac ? '⌘' : 'Ctrl'}K
                    </kbd>{' '}
                    to launch the command palette or{' '}
                    <kbd className="font-mono px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">
                      ?
                    </kbd>{' '}
                    to review all registered shortcuts.
                  </p>
                </div>
              </div>
            )}

            {/* 4. Security & Role Permissions Tab */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Account Security & Protection
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-900 block">
                          Session Protection
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Encrypted session authentication with automatic inactivity protection
                        </span>
                      </div>
                      <Badge variant="success" size="sm">
                        Protected
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-900 block">
                          Role-Based Access
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Access permissions are strictly governed by your assigned role
                        </span>
                      </div>
                      <Badge variant="success" size="sm">
                        Enforced
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-900 block">
                          Data Confidentiality
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Borrower KYC records and financial dossiers are strictly private
                        </span>
                      </div>
                      <Badge variant="success" size="sm">
                        Guaranteed
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Role Capabilities ({formatRoleLabel(user?.role)})
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {permissions.map((perm, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <BadgeCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span className="leading-snug">{perm}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/80 bg-slate-50/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                logout()
              }}
              className="gap-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs cursor-pointer"
            >
              Done
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
