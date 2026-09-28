import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from '@/features/auth/LoginPage'
import { Input } from '@/components/ui/Input'
import * as AuthHook from '@/hooks/useAuth'
import type { AuthContextValue } from '@/features/auth/auth-context'

describe('Password Visibility Toggle', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  const createMockAuth = (overrides?: Partial<AuthContextValue>): AuthContextValue => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  })

  it('toggles password between masked and visible text while preserving value on LoginPage', () => {
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth())

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const passwordInput = screen.getByLabelText('Password', { selector: 'input' }) as HTMLInputElement
    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput.type).toBe('password')

    // Find the toggle button via accessible aria-label
    const toggleBtn = screen.getByRole('button', { name: /show password/i })
    expect(toggleBtn).toBeInTheDocument()

    // Type a test password
    fireEvent.change(passwordInput, { target: { value: 'SecretSecure123!' } })
    expect(passwordInput.value).toBe('SecretSecure123!')

    // Toggle to visible
    fireEvent.click(toggleBtn)
    expect(passwordInput.type).toBe('text')
    expect(passwordInput.value).toBe('SecretSecure123!')
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument()

    // Toggle back to masked
    fireEvent.click(screen.getByRole('button', { name: /hide password/i }))
    expect(passwordInput.type).toBe('password')
    expect(passwordInput.value).toBe('SecretSecure123!')
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument()

    // Switch to Loan Advisor demo preset
    fireEvent.click(screen.getByRole('button', { name: /loan advisor/i }))
    expect(passwordInput.value).toBe('Password123!')
    // Toggle to visible and verify preset password is shown
    fireEvent.click(screen.getByRole('button', { name: /show password/i }))
    expect(passwordInput.type).toBe('text')
    expect(passwordInput.value).toBe('Password123!')
  })

  it('allows endIcon in Input primitive to receive clicks and toggle type', () => {
    function TestWrapper() {
      const [show, setShow] = React.useState(false)
      const [val, setVal] = React.useState('MyPassword')
      return (
        <Input
          label="Passcode"
          type={show ? 'text' : 'password'}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          endIcon={
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              Toggle
            </button>
          }
        />
      )
    }

    render(<TestWrapper />)
    const input = screen.getByLabelText(/passcode/i) as HTMLInputElement
    expect(input.type).toBe('password')

    const button = screen.getByRole('button', { name: /show password/i })
    fireEvent.click(button)
    expect(input.type).toBe('text')
    expect(input.value).toBe('MyPassword')

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }))
    expect(input.type).toBe('password')
    expect(input.value).toBe('MyPassword')
  })
})
