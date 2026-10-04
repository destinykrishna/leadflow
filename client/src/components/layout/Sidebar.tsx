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
  ChevronsUpDown,
  User as UserIcon,
  Settings,
  LogOut,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { formatRoleLabel } from '@/lib/presentation'
import { cn } from '@/lib/utils'

interface SidebarProps {
  onCloseMobile?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onOpenProfile?: () => void
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
  onOpenProfile,
  isMac = false,
}: SidebarProps) {
  const { user, logout } = useAuth()
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

    if (user.role === 'BROKERAGE_ADMIN') {
      sections.push({
        heading: 'Management',
        items: [
          { label: 'Advisors & Team', to: '/app/team', icon: UserCheck, shortcut: 'G M' },
        ],
      })
    }

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

      {/* Sidebar Footer with User Profile & Collapse Trigger */}
      <div className="border-t border-border p-2 space-y-1">
        {/* User Profile Entry */}
        {user && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                title={isCollapsed ? `${user.name} (${formatRoleLabel(user.role)})` : undefined}
                className={cn(
                  'group flex w-full items-center rounded-lg text-left transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer',
                  isCollapsed ? 'justify-center p-1.5' : 'justify-between p-2 gap-2.5',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    name={user.name}
                    size="sm"
                    className="ring-1 ring-slate-200 shrink-0 h-7 w-7 text-[11px]"
                  />
                  {!isCollapsed && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-900 truncate leading-tight">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                        {formatRoleLabel(user.role)}
                      </span>
                    </div>
                  )}
                </div>
                {!isCollapsed && (
                  <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                )}
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side={isCollapsed ? 'right' : 'top'}
                align={isCollapsed ? 'end' : 'start'}
                sideOffset={8}
                className="z-50 min-w-56 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-none"
              >
                <div className="px-3 py-2.5 border-b border-border/60">
                  <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  <div className="mt-1.5">
                    <span className="inline-flex items-center text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {formatRoleLabel(user.role)}
                    </span>
                  </div>
                </div>

                <div className="p-1 space-y-0.5">
                  <DropdownMenu.Item
                    onClick={onOpenProfile}
                    className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                      <span>View Profile</span>
                    </div>
                    <kbd className="font-mono text-[9px] text-slate-400">G U</kbd>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    onClick={onOpenProfile}
                    className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5 text-slate-400" />
                      <span>Account Settings</span>
                    </div>
                  </DropdownMenu.Item>
                </div>

                <div className="border-t border-border/60 p-1">
                  <DropdownMenu.Item
                    onClick={() => logout()}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50 focus:text-rose-700 focus:outline-none"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </DropdownMenu.Item>
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}

        {/* Sidebar Collapse Toggle */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? `Expand sidebar (${modKey}B)` : `Collapse sidebar (${modKey}B)`}
            className={cn(
              'flex w-full items-center rounded-md text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer',
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
