import * as React from 'react'
import { api, setAccessToken } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import type { ApiResponse } from '@/types/api.types'
import type { AuthResponseData, AuthUser, LoginCredentials } from '@/types/auth.types'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let isMounted = true

    api
      .post<ApiResponse<AuthResponseData>>('/auth/refresh')
      .then((response) => {
        if (!isMounted) return
        const data = response.data.data
        if (data?.accessToken && data.user) {
          setAccessToken(data.accessToken)
          setUser(data.user)
        } else {
          setUser(null)
        }
      })
      .catch(() => {
        if (!isMounted) return
        setUser(null)
        setAccessToken(null)
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const login = React.useCallback(async (credentials: LoginCredentials): Promise<AuthUser> => {
    const response = await api.post<ApiResponse<AuthResponseData>>('/auth/login', credentials)
    const data = response.data.data
    if (!data?.accessToken || !data.user) {
      throw new Error('Invalid authentication response from server')
    }

    setAccessToken(data.accessToken)
    setUser(data.user)
    return data.user
  }, [])

  const logout = React.useCallback(async (): Promise<void> => {
    try {
      await api.post('/auth/logout')
    } finally {
      setAccessToken(null)
      setUser(null)
      queryClient.clear()
    }
  }, [])

  const refreshUser = React.useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await api.get<ApiResponse<{ user: AuthUser }>>('/auth/me')
      if (response.data.data?.user) {
        setUser(response.data.data.user)
        return response.data.data.user
      }
      return null
    } catch {
      return null
    }
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
