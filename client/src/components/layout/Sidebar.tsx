import * as React from 'react'
import { NavLink } from 'react-router-dom'
import {
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
  PanelLeftOpen,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface SidebarProps {
  onCloseMobile?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  isMac?: boolean
}

interface NavItem {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
}

export function Sidebar({
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
  isMac = false,
}: SidebarProps) {
  const { user } = useAuth()
  const modKey = isMac ? '⌘' : 'Ctrl'

  // Generate navigation links based on user role
  const getNavSections = () => {
    if (!user) return []

    if (user.role === 'PLATFORM_ADMIN') {
      return [
        {
          heading: 'Administration',
          items: [
            { label: 'Brokerages', to: '/admin/brokerages', icon: Building2, shortcut: 'G B' },
            { label: 'System Health', to: '/admin/health', icon: Activity, shortcut: 'G H' },
            { label: 'Audit Logs', to: '/admin/audit', icon: ShieldAlert, shortcut: 'G A' },
          ],
        },
      ]
    }

    if (user.role === 'CLIENT') {
      return [
        {
          heading: 'Mortgage Portal',
          items: [
            { label: 'My Loan Case', to: '/portal/case', icon: Home, shortcut: 'G C' },
            { label: 'Documents', to: '/portal/documents', icon: UploadCloud, shortcut: 'G D' },
            { label: 'Advisor Contact', to: '/portal/advisor', icon: UserCheck, shortcut: 'G A' },
          ],
        },
      ]
    }

    // BROKERAGE_ADMIN & ADVISOR
    const baseItems: NavItem[] = [
      { label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard, shortcut: 'G O' },
      { label: 'Pipeline', to: '/app/pipeline', icon: Kanban, shortcut: 'G P' },
      { label: 'Leads', to: '/app/leads', icon: Users, shortcut: 'G L' },
      { label: 'Clients', to: '/app/clients', icon: Briefcase, shortcut: 'G C' },
      { label: 'Documents', to: '/app/documents', icon: FileText, shortcut: 'G D' },
      { label: 'Tasks', to: '/app/tasks', icon: CheckSquare, shortcut: 'G T' },
    ]

    const sections = [
      {
        heading: 'Workspace',
        items: baseItems,
      },
      {
        heading: 'Automations',
        items: [
          { label: 'Stage Automations', to: '/app/triggers', icon: Zap, shortcut: 'G S' },
          { label: 'Email Templates', to: '/app/templates', icon: Mail, shortcut: 'G E' },
        ],
      },
    ]

    return sections
  }

  const sections = getNavSections()

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-card select-none transition-all duration-200 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-border',
          isCollapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white shadow-xs">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col animate-in fade-in-50 duration-150">
              <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                LeadFlow
              </span>
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground mt-1">
                Mortgage Platform
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-4">
        {sections.map((section, idx) => (
          <div key={section.heading} className="space-y-1">
            {!isCollapsed ? (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.heading}
              </p>
            ) : idx > 0 ? (
              <div className="mx-2 my-2 h-px bg-border/60" />
            ) : null}

            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={isCollapsed ? item.label : undefined}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center rounded-md text-xs font-medium transition-colors duration-150',
                    isCollapsed
                      ? 'justify-center p-2.5'
                      : 'justify-between px-2.5 py-2',
                    isActive
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5 truncate">
                      <item.icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-900',
                        )}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && item.shortcut && (
                      <span
                        className={cn(
                          'hidden group-hover:inline-block font-mono text-[9px] tracking-wider opacity-60',
                          isActive ? 'text-white' : 'text-slate-400',
                        )}
                      >
                        {item.shortcut}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Sidebar Footer with Collapse Trigger */}
      <div className="border-t border-border p-2">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? `Expand sidebar (${modKey}B)` : `Collapse sidebar (${modKey}B)`}
            className={cn(
              'flex w-full items-center rounded-md text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900',
              isCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-2',
            )}
          >
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4 shrink-0 text-slate-500" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 shrink-0 text-slate-500" />
                  <span>Collapse</span>
                </>
              )}
            </div>
            {!isCollapsed && (
              <kbd className="font-mono text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
                {modKey}B
              </kbd>
            )}
          </button>
        )}
      </div>
    </aside>
  )
}
