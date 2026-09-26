import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Command } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface KeyboardShortcutsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMac: boolean
}

interface ShortcutItem {
  keys: string[]
  description: string
}

export function KeyboardShortcutsModal({ open, onOpenChange, isMac }: KeyboardShortcutsModalProps) {
  const { user } = useAuth()
  const modKey = isMac ? '⌘' : 'Ctrl'

  const globalShortcuts: ShortcutItem[] = [
    { keys: [modKey, 'K'], description: 'Open command palette' },
    { keys: [modKey, 'B'], description: 'Toggle navigation sidebar' },
    { keys: ['G', 'U'], description: 'Open Profile & Settings' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
    { keys: ['Esc'], description: 'Close modal or menu' },
  ]

  const getNavigationShortcuts = (): ShortcutItem[] => {
    if (user?.role === 'CLIENT') {
      return [
        { keys: ['G', 'C'], description: 'Go to My Loan Case' },
        { keys: ['G', 'D'], description: 'Go to Documents' },
        { keys: ['G', 'A'], description: 'Go to Advisor Contact' },
      ]
    }

    if (user?.role === 'PLATFORM_ADMIN') {
      return [
        { keys: ['G', 'B'], description: 'Go to Brokerages' },
        { keys: ['G', 'H'], description: 'Go to System Health' },
        { keys: ['G', 'A'], description: 'Go to Audit Logs' },
      ]
    }

    return [
      { keys: ['G', 'O'], description: 'Go to Dashboard' },
      { keys: ['G', 'P'], description: 'Go to Pipeline' },
      { keys: ['G', 'L'], description: 'Go to Leads' },
      { keys: ['G', 'C'], description: 'Go to Clients' },
      { keys: ['G', 'D'], description: 'Go to Documents' },
      { keys: ['G', 'T'], description: 'Go to Tasks' },
    ]
  }

  const navShortcuts = getNavigationShortcuts()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-150 focus:outline-none">
          <div className="flex items-center justify-between pb-4 border-b border-border/70">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <Command className="h-4 w-4" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-sm font-semibold text-slate-900">
                  Keyboard Shortcuts
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">
                  Quick key bindings for rapid navigation
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="space-y-5 pt-4">
            {/* Global Shortcuts */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Global
              </p>
              <div className="space-y-1.5">
                {globalShortcuts.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between py-1 text-xs"
                  >
                    <span className="text-slate-600">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="inline-flex min-w-[20px] items-center justify-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Chords */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Navigation
                </p>
                <span className="text-[10px] text-muted-foreground">Press in sequence</span>
              </div>
              <div className="space-y-1.5">
                {navShortcuts.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between py-1 text-xs"
                  >
                    <span className="text-slate-600">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, idx) => (
                        <React.Fragment key={k}>
                          <kbd className="inline-flex min-w-[20px] items-center justify-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 shadow-2xs">
                            {k}
                          </kbd>
                          {idx === 0 && <span className="text-[10px] text-slate-400">then</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
