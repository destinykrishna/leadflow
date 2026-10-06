import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { LeadDetailView } from './LeadDetailView'
import { usePrefersReducedMotion } from '@/lib/motion'

interface LeadDetailDrawerProps {
  leadId: string | null
  isOpen: boolean
  onClose: () => void
}

export function LeadDetailDrawer({ leadId, isOpen, onClose }: LeadDetailDrawerProps) {
  const reducedMotion = usePrefersReducedMotion()

  // ESC key dismiss listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && leadId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop with smooth blur */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-over Content Drawer */}
          <motion.div
            key="drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Lead Details"
            initial={{ x: reducedMotion ? 0 : '100%', opacity: reducedMotion ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reducedMotion ? 0 : '100%', opacity: reducedMotion ? 0 : 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-50 flex h-full w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl flex-col bg-white border-l border-border shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-4 sm:px-6 py-3.5 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Lead Workspace
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Close lead detail view"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Workspace Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
              <LeadDetailView leadId={leadId} onClose={onClose} showFullPageLink={true} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
