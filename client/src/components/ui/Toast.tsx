import * as React from 'react'
import {
  CheckCircle2,
  Mail,
  AlertCircle,
  AlertTriangle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface ToastItem {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => string
  dismissToast: (id: string) => void
}

const noopToastContext: ToastContextValue = {
  showToast: () => '',
  dismissToast: () => {},
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext)
  return context ?? noopToastContext
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = React.useCallback(
    ({ type, title, message, duration = 5000 }: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newToast: ToastItem = { id, type, title, message, duration }

      setToasts((prev) => [...prev.slice(-4), newToast]) // keep at most 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id)
        }, duration)
      }

      return id
    },
    [dismissToast],
  )

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
      case 'info':
        return <Mail className="h-4 w-4 text-sky-600 shrink-0" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
    }
  }

  const getTypeStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-emerald-200 bg-white/95 text-slate-900 shadow-emerald-500/5'
      case 'info':
        return 'border-sky-200 bg-white/95 text-slate-900 shadow-sky-500/5'
      case 'warning':
        return 'border-amber-200 bg-white/95 text-slate-900 shadow-amber-500/5'
      case 'error':
        return 'border-rose-200 bg-white/95 text-slate-900 shadow-rose-500/5'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-xs transition-all duration-200 animate-in fade-in slide-in-from-bottom-3',
              getTypeStyles(toast.type),
            )}
          >
            <div className="pt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 min-w-0">
              {toast.title && (
                <h4 className="text-xs font-semibold text-slate-900 leading-tight">
                  {toast.title}
                </h4>
              )}
              <p className={cn('text-xs text-slate-700 leading-snug', toast.title ? 'mt-0.5' : '')}>
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 rounded p-0.5 transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
