import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

interface KeyboardShortcutsOptions {
  onToggleCommandPalette?: () => void
  onToggleSidebar?: () => void
  onToggleShortcutsModal?: () => void
}

export function useKeyboardShortcuts({
  onToggleCommandPalette,
  onToggleSidebar,
  onToggleShortcutsModal,
}: KeyboardShortcutsOptions = {}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isMac, setIsMac] = React.useState(false)
  const chordRef = React.useRef<{ key: string; timer: ReturnType<typeof setTimeout> } | null>(null)

  React.useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent))
    }
  }, [])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)

      // Cmd+K or Ctrl+K (Global search / command palette)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onToggleCommandPalette?.()
        return
      }

      // Cmd+B or Ctrl+B (Toggle sidebar)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        onToggleSidebar?.()
        return
      }

      // If user is focused inside an input or typing with modifier keys, do not trigger chord or ? shortcuts
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) {
        return
      }

      // ? key (Shift + /) for keyboard shortcuts cheat sheet
      if (e.key === '?') {
        e.preventDefault()
        onToggleShortcutsModal?.()
        return
      }

      // Sequence / Chord handling (e.g. "G" then "P" for Pipeline)
      if (chordRef.current?.key === 'g') {
        const targetKey = e.key.toLowerCase()
        clearTimeout(chordRef.current.timer)
        chordRef.current = null

        if (user?.role === 'CLIENT') {
          if (targetKey === 'c') {
            e.preventDefault()
            navigate('/portal/case')
          } else if (targetKey === 'd') {
            e.preventDefault()
            navigate('/portal/documents')
          } else if (targetKey === 'a') {
            e.preventDefault()
            navigate('/portal/advisor')
          }
          return
        }

        if (user?.role === 'PLATFORM_ADMIN') {
          if (targetKey === 'b') {
            e.preventDefault()
            navigate('/admin/brokerages')
          } else if (targetKey === 'h') {
            e.preventDefault()
            navigate('/admin/health')
          } else if (targetKey === 'a') {
            e.preventDefault()
            navigate('/admin/audit')
          }
          return
        }

        // ADVISOR / BROKERAGE_ADMIN
        if (targetKey === 'o') {
          e.preventDefault()
          navigate('/app/dashboard')
        } else if (targetKey === 'p') {
          e.preventDefault()
          navigate('/app/pipeline')
        } else if (targetKey === 'l') {
          e.preventDefault()
          navigate('/app/leads')
        } else if (targetKey === 'c') {
          e.preventDefault()
          navigate('/app/clients')
        } else if (targetKey === 'd') {
          e.preventDefault()
          navigate('/app/documents')
        } else if (targetKey === 't') {
          e.preventDefault()
          navigate('/app/tasks')
        }
        return
      }

      if (e.key.toLowerCase() === 'g') {
        const timer = setTimeout(() => {
          chordRef.current = null
        }, 1200)
        chordRef.current = { key: 'g', timer }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (chordRef.current?.timer) {
        clearTimeout(chordRef.current.timer)
      }
    }
  }, [navigate, user, onToggleCommandPalette, onToggleSidebar, onToggleShortcutsModal])

  return { isMac, modifierKey: isMac ? '⌘' : 'Ctrl' }
}
