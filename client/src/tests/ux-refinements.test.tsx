import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CommandPalette } from '@/components/common/CommandPalette'
import { KeyboardShortcutsModal } from '@/components/common/KeyboardShortcutsModal'
import * as AuthHook from '@/hooks/useAuth'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'

describe('Production UX Refinements', () => {
  const createMockAuth = (user: AuthUser | null): AuthContextValue => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  })

  const mockAdvisor: AuthUser = {
    id: 'advisor-1',
    email: 'elena@berlin.de',
    name: 'Elena Schmidt',
    role: 'ADVISOR',
    status: 'ACTIVE',
    brokerageId: 'brokerage-1',
  }

  describe('CommandPalette', () => {
    it('renders search input and commands when open', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
      const onOpenChange = vi.fn()

      render(
        <MemoryRouter>
          <CommandPalette
            open={true}
            onOpenChange={onOpenChange}
            isMac={false}
          />
        </MemoryRouter>,
      )

      expect(screen.getByPlaceholderText('Search pages or type a command...')).toBeInTheDocument()
      expect(screen.getByText('Pipeline')).toBeInTheDocument()
      expect(screen.getByText('Leads')).toBeInTheDocument()
      expect(screen.getByText('Clients')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Tasks')).toBeInTheDocument()
    })

    it('filters commands when user types in search', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
      const onOpenChange = vi.fn()

      render(
        <MemoryRouter>
          <CommandPalette
            open={true}
            onOpenChange={onOpenChange}
            isMac={false}
          />
        </MemoryRouter>,
      )

      const input = screen.getByPlaceholderText('Search pages or type a command...')
      fireEvent.change(input, { target: { value: 'Pipeline' } })

      expect(screen.getByText('Pipeline')).toBeInTheDocument()
      expect(screen.queryByText('Documents')).not.toBeInTheDocument()
    })
  })

  describe('KeyboardShortcutsModal', () => {
    it('renders global and role-specific navigation shortcuts', () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
      const onOpenChange = vi.fn()

      render(
        <KeyboardShortcutsModal
          open={true}
          onOpenChange={onOpenChange}
          isMac={false}
        />,
      )

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
      expect(screen.getByText('Open command palette')).toBeInTheDocument()
      expect(screen.getByText('Go to Pipeline')).toBeInTheDocument()
      expect(screen.getByText('Go to Leads')).toBeInTheDocument()
    })
  })
})
