import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  Kanban,
  Users,
  Briefcase,
  FileText,
  CheckSquare,
  Mail,
  Zap,
  Building2,
  Activity,
  ShieldAlert,
  Home,
  UploadCloud,
  UserCheck,
  PanelLeftClose,
  Keyboard,
  Link2,
  LogOut,
  Check,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMac: boolean
  onToggleSidebar?: () => void
  onOpenShortcuts?: () => void
}

interface CommandItem {
  id: string
  label: string
  category: 'Navigation' | 'Actions' | 'Account'
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string[]
  keywords?: string
  action: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  isMac,
  onToggleSidebar,
  onOpenShortcuts,
}: CommandPaletteProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [search, setSearch] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [copiedLink, setCopiedLink] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const modKey = isMac ? '⌘' : 'Ctrl'

  // Reset search and selection on open
  React.useEffect(() => {
    if (open) {
      setSearch('')
      setSelectedIndex(0)
      setCopiedLink(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Build command items based on current role
  const getCommands = (): CommandItem[] => {
    const items: CommandItem[] = []

    const nav = (path: string) => {
      navigate(path)
      onOpenChange(false)
    }

    if (user?.role === 'PLATFORM_ADMIN') {
      items.push(
        {
          id: 'nav-brokerages',
          label: 'Brokerages',
          category: 'Navigation',
          icon: Building2,
          shortcut: ['G', 'B'],
          keywords: 'tenants brokerages accounts partners firms',
          action: () => nav('/admin/brokerages'),
        },
        {
          id: 'nav-health',
          label: 'System Health',
          category: 'Navigation',
          icon: Activity,
          shortcut: ['G', 'H'],
          keywords: 'health uptime metrics queues database status',
          action: () => nav('/admin/health'),
        },
        {
          id: 'nav-audit',
          label: 'Audit Logs',
          category: 'Navigation',
          icon: ShieldAlert,
          shortcut: ['G', 'A'],
          keywords: 'audit logs events security compliance',
          action: () => nav('/admin/audit'),
        },
      )
    } else if (user?.role === 'CLIENT') {
      items.push(
        {
          id: 'nav-case',
          label: 'My Loan Case',
          category: 'Navigation',
          icon: Home,
          shortcut: ['G', 'C'],
          keywords: 'mortgage loan application status progress expat',
          action: () => nav('/portal/case'),
        },
        {
          id: 'nav-documents',
          label: 'Documents',
          category: 'Navigation',
          icon: UploadCloud,
          shortcut: ['G', 'D'],
          keywords: 'upload files id passport payslip salary proof',
          action: () => nav('/portal/documents'),
        },
        {
          id: 'nav-advisor',
          label: 'Advisor Contact',
          category: 'Navigation',
          icon: UserCheck,
          shortcut: ['G', 'A'],
          keywords: 'specialist advisor phone email message call support',
          action: () => nav('/portal/advisor'),
        },
      )
    } else {
      // ADVISOR / BROKERAGE_ADMIN
      items.push(
        {
          id: 'nav-dashboard',
          label: 'Dashboard',
          category: 'Navigation',
          icon: LayoutDashboard,
          shortcut: ['G', 'O'],
          keywords: 'operations dashboard metrics analytics kpi overview stats',
          action: () => nav('/app/dashboard'),
        },
        {
          id: 'nav-pipeline',
          label: 'Pipeline',
          category: 'Navigation',
          icon: Kanban,
          shortcut: ['G', 'P'],
          keywords: 'kanban board stages deals mortgage leads pipeline',
          action: () => nav('/app/pipeline'),
        },
        {
          id: 'nav-leads',
          label: 'Leads',
          category: 'Navigation',
          icon: Users,
          shortcut: ['G', 'L'],
          keywords: 'borrowers inquiries intake prospects contact new',
          action: () => nav('/app/leads'),
        },
        {
          id: 'nav-clients',
          label: 'Clients',
          category: 'Navigation',
          icon: Briefcase,
          shortcut: ['G', 'C'],
          keywords: 'active clients borrower cases portfolio profiles',
          action: () => nav('/app/clients'),
        },
        {
          id: 'nav-documents',
          label: 'Documents',
          category: 'Navigation',
          icon: FileText,
          shortcut: ['G', 'D'],
          keywords: 'verification files payslips passport pdf review',
          action: () => nav('/app/documents'),
        },
        {
          id: 'nav-tasks',
          label: 'Tasks',
          category: 'Navigation',
          icon: CheckSquare,
          shortcut: ['G', 'T'],
          keywords: 'todo checklist overdue follow-up reminders',
          action: () => nav('/app/tasks'),
        },
      )

      if (user?.role === 'BROKERAGE_ADMIN') {
        items.push(
          {
            id: 'nav-templates',
            label: 'Email Templates',
            category: 'Navigation',
            icon: Mail,
            shortcut: ['G', 'E'],
            keywords: 'email templates automated messages drafts',
            action: () => nav('/app/templates'),
          },
          {
            id: 'nav-triggers',
            label: 'Stage Automations',
            category: 'Navigation',
            icon: Zap,
            shortcut: ['G', 'S'],
            keywords: 'triggers automation rules pipeline workflow',
            action: () => nav('/app/triggers'),
          },
        )
      }
    }

    // Actions category
    items.push(
      {
        id: 'act-sidebar',
        label: 'Toggle Navigation Sidebar',
        category: 'Actions',
        icon: PanelLeftClose,
        shortcut: [modKey, 'B'],
        keywords: 'sidebar expand collapse hide show view menu',
        action: () => {
          onOpenChange(false)
          onToggleSidebar?.()
        },
      },
      {
        id: 'act-shortcuts',
        label: 'View Keyboard Shortcuts',
        category: 'Actions',
        icon: Keyboard,
        shortcut: ['?'],
        keywords: 'keyboard shortcuts hotkeys help keys bindings',
        action: () => {
          onOpenChange(false)
          onOpenShortcuts?.()
        },
      },
      {
        id: 'act-copy-link',
        label: copiedLink ? 'Workspace URL Copied!' : 'Copy Current Page URL',
        category: 'Actions',
        icon: copiedLink ? Check : Link2,
        keywords: 'copy link share url location clipboard',
        action: () => {
          if (typeof window !== 'undefined') {
            navigator.clipboard.writeText(window.location.href)
            setCopiedLink(true)
            setTimeout(() => onOpenChange(false), 600)
          }
        },
      },
    )

    // Account category
    items.push({
      id: 'acc-logout',
      label: 'Sign Out',
      category: 'Account',
      icon: LogOut,
      keywords: 'logout exit signout disconnect leave session',
      action: () => {
        onOpenChange(false)
        logout()
      },
    })

    return items
  }

  const allCommands = getCommands()

  const filteredCommands = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allCommands
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        (cmd.keywords && cmd.keywords.toLowerCase().includes(q)),
    )
  }, [allCommands, search])

  // Reset index when search results change
  React.useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Scroll active item into view
  React.useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (filteredCommands.length ? (prev + 1) % filteredCommands.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        filteredCommands.length ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action()
      }
    }
  }

  // Group commands by category for display
  const categories: Array<'Navigation' | 'Actions' | 'Account'> = ['Navigation', 'Actions', 'Account']

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-150 focus:outline-none overflow-hidden p-0">
          <DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search or navigate across LeadFlow
          </DialogPrimitive.Description>

          {/* Search Header */}
          <div className="flex items-center px-4 py-3 border-b border-border/80 gap-3 bg-card">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages or type a command..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="flex items-center gap-1.5">
              <kbd className="inline-flex min-w-[20px] items-center justify-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 shadow-2xs">
                ESC
              </kbd>
            </div>
          </div>

          {/* Command List */}
          <div ref={listRef} className="max-h-80 overflow-y-auto p-2 space-y-3">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No matching pages or actions found for &ldquo;{search}&rdquo;
              </div>
            ) : (
              categories.map((cat) => {
                const catItems = filteredCommands.filter((item) => item.category === cat)
                if (catItems.length === 0) return null

                return (
                  <div key={cat} className="space-y-1">
                    <p className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {cat}
                    </p>
                    {catItems.map((item) => {
                      const globalIdx = filteredCommands.findIndex((cmd) => cmd.id === item.id)
                      const isSelected = globalIdx === selectedIndex

                      return (
                        <div
                          key={item.id}
                          role="option"
                          aria-selected={isSelected}
                          data-selected={isSelected}
                          onClick={() => item.action()}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-slate-100 text-slate-900 border-l-2 border-primary pl-2'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <item.icon
                              className={`h-4 w-4 shrink-0 ${
                                isSelected ? 'text-primary' : 'text-slate-400'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>

                          {item.shortcut && (
                            <div className="flex items-center gap-1">
                              {item.shortcut.map((key) => (
                                <kbd
                                  key={key}
                                  className="inline-flex min-w-[18px] items-center justify-center rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 shadow-2xs"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Shortcuts Hint */}
          <div className="flex items-center justify-between border-t border-border/70 bg-slate-50/60 px-4 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[9px]">
                  ↑
                </kbd>
                <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[9px]">
                  ↓
                </kbd>
                <span className="text-[10px]">Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[9px]">
                  ↵
                </kbd>
                <span className="text-[10px]">Select</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[9px]">
                ESC
              </kbd>
              <span className="text-[10px]">Close</span>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
