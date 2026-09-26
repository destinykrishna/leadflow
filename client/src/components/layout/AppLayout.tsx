import * as React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { CommandPalette } from '@/components/common/CommandPalette'
import { KeyboardShortcutsModal } from '@/components/common/KeyboardShortcutsModal'
import { ProfileSettingsModal } from '@/components/common/ProfileSettingsModal'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false)
  const [shortcutsModalOpen, setShortcutsModalOpen] = React.useState(false)
  const [profileModalOpen, setProfileModalOpen] = React.useState(false)

  const toggleCommandPalette = React.useCallback(() => {
    setCommandPaletteOpen((prev) => !prev)
  }, [])

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev) => !prev)
  }, [])

  const toggleShortcutsModal = React.useCallback(() => {
    setShortcutsModalOpen((prev) => !prev)
  }, [])

  const toggleProfileModal = React.useCallback(() => {
    setProfileModalOpen((prev) => !prev)
  }, [])

  const { isMac } = useKeyboardShortcuts({
    onToggleCommandPalette: toggleCommandPalette,
    onToggleSidebar: toggleSidebar,
    onToggleShortcutsModal: toggleShortcutsModal,
    onToggleProfileModal: toggleProfileModal,
  })

  return (
    <div className="flex min-h-[100dvh] w-full bg-slate-50/50">
      {/* Desktop Sidebar */}
      <div
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 z-30 transition-all duration-200 ease-in-out',
          sidebarCollapsed ? 'md:w-16' : 'md:w-64',
        )}
      >
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          isMac={isMac}
        />
      </div>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex w-64 flex-1 flex-col bg-card shadow-xl animate-in slide-in-from-left duration-200">
            <Sidebar
              onCloseMobile={() => setMobileOpen(false)}
              isMac={isMac}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={cn(
          'flex flex-1 flex-col min-w-0 transition-all duration-200 ease-in-out',
          sidebarCollapsed ? 'md:pl-16' : 'md:pl-64',
        )}
      >
        <Header
          onOpenMobile={() => setMobileOpen(true)}
          onToggleSidebar={toggleSidebar}
          isSidebarCollapsed={sidebarCollapsed}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenShortcuts={() => setShortcutsModalOpen(true)}
          onOpenProfile={() => setProfileModalOpen(true)}
          isMac={isMac}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette (Cmd+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        isMac={isMac}
        onToggleSidebar={toggleSidebar}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
        onOpenProfile={() => setProfileModalOpen(true)}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal (?) */}
      <KeyboardShortcutsModal
        open={shortcutsModalOpen}
        onOpenChange={setShortcutsModalOpen}
        isMac={isMac}
      />

      {/* Profile & Settings Modal */}
      <ProfileSettingsModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        isMac={isMac}
      />
    </div>
  )
}
