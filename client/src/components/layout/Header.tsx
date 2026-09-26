import { useLocation } from 'react-router-dom'
import {
  Menu,
  LogOut,
  ChevronDown,
  Search,
  Keyboard,
  PanelLeft,
  User,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface HeaderProps {
  onOpenMobile?: () => void
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
  onOpenCommandPalette?: () => void
  onOpenShortcuts?: () => void
  onOpenProfile?: () => void
  isMac?: boolean
}

export function Header({
  onOpenMobile,
  onToggleSidebar,
  onOpenCommandPalette,
  onOpenShortcuts,
  onOpenProfile,
  isMac = false,
}: HeaderProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const modKey = isMac ? '⌘' : 'Ctrl'

  const getPageTitle = (pathname: string) => {
    if (pathname.includes('/dashboard')) return 'Operations Dashboard'
    if (pathname.includes('/pipeline')) return 'Pipeline'
    if (pathname.includes('/leads')) return 'Leads'
    if (pathname.includes('/clients')) return 'Clients'
    if (pathname.includes('/documents')) return 'Documents'
    if (pathname.includes('/tasks')) return 'Tasks'
    if (pathname.includes('/templates')) return 'Email Templates'
    if (pathname.includes('/triggers')) return 'Stage Automations'
    if (pathname.includes('/case')) return 'Loan Case'
    if (pathname.includes('/advisor')) return 'Advisor'
    if (pathname.includes('/brokerages')) return 'Brokerages'
    if (pathname.includes('/health')) return 'System Health'
    if (pathname.includes('/audit')) return 'Audit Logs'
    return 'Workspace'
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
        return 'Platform Admin'
      case 'BROKERAGE_ADMIN':
        return 'Brokerage Admin'
      case 'ADVISOR':
        return 'Advisor'
      case 'CLIENT':
        return 'Client'
      default:
        return 'User'
    }
  }

  const currentTitle = getPageTitle(location.pathname)

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border bg-card/95 backdrop-blur-xs px-4 md:px-6">
      {/* Left: Mobile Toggle, Desktop Rail Toggle & Breadcrumb */}
      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={onOpenMobile}
          aria-label="Toggle navigation"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <button
          type="button"
          onClick={onToggleSidebar}
          title={`Toggle sidebar (${modKey}B)`}
          className="hidden md:flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        <div className="hidden sm:flex items-center gap-2 pl-1">
          <span className="text-xs font-semibold text-slate-900 tracking-tight">
            {currentTitle}
          </span>
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="flex items-center justify-center flex-1 max-w-xs md:max-w-sm px-2">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="group flex h-9 w-full items-center justify-between rounded-lg border border-border bg-slate-50/70 px-3 text-xs text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-100/80 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" />
            <span className="truncate">Search or jump to...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400 shadow-2xs">
            {modKey}K
          </kbd>
        </button>
      </div>

      {/* Right: Keyboard Shortcuts & Profile Menu */}
      <div className="flex items-center gap-2">
        {/* Keyboard Shortcuts Trigger Button */}
        <button
          type="button"
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts (?)"
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
        >
          <Keyboard className="h-4 w-4" />
        </button>

        <div className="hidden lg:flex">
          <Badge variant={getRoleBadgeVariant(user?.role)} size="sm">
            {formatRoleLabel(user?.role)}
          </Badge>
        </div>

        {/* Profile Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex items-center gap-2 rounded-full p-1 pl-1.5 pr-2 text-left transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30 select-none"
              aria-label="User menu"
            >
              <Avatar name={user?.name} size="sm" />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {user?.name || 'User'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {user?.email}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-56 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-none"
            >
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-xs font-semibold text-slate-900">{user?.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                <div className="mt-1.5">
                  <Badge variant={getRoleBadgeVariant(user?.role)} size="sm">
                    {formatRoleLabel(user?.role)}
                  </Badge>
                </div>
              </div>

              <div className="p-1 space-y-0.5">
                <DropdownMenu.Item
                  onClick={onOpenProfile}
                  className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Profile & Settings</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-slate-400">G U</kbd>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onClick={onOpenCommandPalette}
                  className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                    <span>Command Palette</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-slate-400">{modKey}K</kbd>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onClick={onOpenShortcuts}
                  className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <Keyboard className="h-3.5 w-3.5 text-slate-400" />
                    <span>Shortcuts</span>
                  </div>
                  <kbd className="font-mono text-[10px] text-slate-400">?</kbd>
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
      </div>
    </header>
  )
}
