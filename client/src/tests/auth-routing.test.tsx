import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { RootRedirect } from '@/routes/RootRedirect'
import * as AuthHook from '@/hooks/useAuth'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'

describe('Auth Routing & Access Guards', () => {
  const createMockAuth = (overrides?: Partial<AuthContextValue>): AuthContextValue => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  })

  it('renders loading indicator while session is restoring', () => {
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth({ isLoading: true }))

    render(
      <MemoryRouter initialEntries={['/app/pipeline']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ADVISOR']} />}>
            <Route path="/app/pipeline" element={<div>Pipeline View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Restoring session...')).toBeInTheDocument()
    expect(screen.queryByText('Pipeline View')).not.toBeInTheDocument()
  })

  it('redirects unauthenticated users to login page', () => {
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth({ isAuthenticated: false, user: null }))

    render(
      <MemoryRouter initialEntries={['/app/pipeline']}>
        <Routes>
          <Route path="/login" element={<div>Login Screen</div>} />
          <Route element={<ProtectedRoute allowedRoles={['ADVISOR']} />}>
            <Route path="/app/pipeline" element={<div>Pipeline View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Login Screen')).toBeInTheDocument()
    expect(screen.queryByText('Pipeline View')).not.toBeInTheDocument()
  })

  it('allows authorized advisor to access workspace', () => {
    const mockAdvisor: AuthUser = {
      id: 'advisor-1',
      email: 'advisor@berlin.de',
      name: 'Elena Schmidt',
      role: 'ADVISOR',
      status: 'ACTIVE',
      brokerageId: 'brokerage-1',
    }

    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
      createMockAuth({ isAuthenticated: true, user: mockAdvisor }),
    )

    render(
      <MemoryRouter initialEntries={['/app/pipeline']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['ADVISOR']} />}>
            <Route path="/app/pipeline" element={<div>Pipeline View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Pipeline View')).toBeInTheDocument()
  })

  it('redirects client role to expat portal if trying to access advisor routes', () => {
    const mockClient: AuthUser = {
      id: 'client-1',
      email: 'alex@gmail.com',
      name: 'Alex Johnson',
      role: 'CLIENT',
      status: 'ACTIVE',
      brokerageId: 'brokerage-1',
    }

    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
      createMockAuth({ isAuthenticated: true, user: mockClient }),
    )

    render(
      <MemoryRouter initialEntries={['/app/pipeline']}>
        <Routes>
          <Route path="/portal/case" element={<div>Client Portal Home</div>} />
          <Route element={<ProtectedRoute allowedRoles={['ADVISOR', 'BROKERAGE_ADMIN']} />}>
            <Route path="/app/pipeline" element={<div>Pipeline View</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Client Portal Home')).toBeInTheDocument()
    expect(screen.queryByText('Pipeline View')).not.toBeInTheDocument()
  })

  describe('RootRedirect', () => {
    it('redirects root path to /portal/case for CLIENT users', () => {
      const mockClient: AuthUser = {
        id: 'client-1',
        email: 'alex@gmail.com',
        name: 'Alex Johnson',
        role: 'CLIENT',
        status: 'ACTIVE',
        brokerageId: 'brokerage-1',
      }

      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: true, user: mockClient }),
      )

      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/portal/case" element={<div>Expat Portal Landing</div>} />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Expat Portal Landing')).toBeInTheDocument()
    })

    it('redirects root path to /app/pipeline for ADVISOR users', () => {
      const mockAdvisor: AuthUser = {
        id: 'advisor-1',
        email: 'elena@berlin.de',
        name: 'Elena Schmidt',
        role: 'ADVISOR',
        status: 'ACTIVE',
        brokerageId: 'brokerage-1',
      }

      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(
        createMockAuth({ isAuthenticated: true, user: mockAdvisor }),
      )

      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/app/pipeline" element={<div>Advisor Pipeline Landing</div>} />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Advisor Pipeline Landing')).toBeInTheDocument()
    })
  })
})
