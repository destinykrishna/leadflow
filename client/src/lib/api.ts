import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@/types/api.types'
import type { AuthResponseData } from '@/types/auth.types'

let inMemoryToken: string | null = null
let isRefreshing = false
// When a refresh attempt fails (expired/invalid refresh token), latch this flag
// so that subsequent 401s from TanStack Query retry:1 don't trigger more refresh
// calls and exhaust the auth rate limiter (20 req / 15 min).
// The latch clears only on successful refresh or explicit reset (page reload / login).
let refreshFailed = false
let refreshSubscribers: Array<(token: string | null) => void> = []

export function getAccessToken(): string | null {
  return inMemoryToken
}

export function setAccessToken(token: string | null): void {
  inMemoryToken = token
  if (token) {
    // Successful token means session is healthy — clear the failure latch.
    refreshFailed = false
  }
}

/** Exposed only for testing: reset interceptor state between test cases. */
export function resetRefreshState(): void {
  isRefreshing = false
  refreshFailed = false
  refreshSubscribers = []
}

function onRefreshed(token: string | null): void {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

function subscribeTokenRefresh(cb: (token: string | null) => void): void {
  refreshSubscribers.push(cb)
}

export function getApiOrigin(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5000'
  }
  return typeof window !== 'undefined' ? window.location.origin : ''
}

const apiBase = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api'

export const api = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor: Attach bearer token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (inMemoryToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryToken}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Response Interceptor: Handle 401 and refresh token rotation
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/logout')

    // If 401 Unauthorized and not an auth endpoint, attempt token refresh.
    // Skip entirely if a previous refresh attempt already failed this session —
    // further retries would only hammer /api/auth/refresh and exhaust the rate limiter.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint &&
      !refreshFailed
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            } else {
              reject(error)
            }
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const fallbackToken = typeof window !== 'undefined' ? localStorage.getItem('leadflow_refresh_token') : null
        const refreshResponse = await axios.post<ApiResponse<AuthResponseData>>(
          `${apiBase}/auth/refresh`,
          { refreshToken: fallbackToken || undefined },
          { withCredentials: true },
        )

        const newAccessToken = refreshResponse.data.data?.accessToken ?? null
        const newRefreshToken = refreshResponse.data.data?.refreshToken ?? null
        if (newRefreshToken && typeof window !== 'undefined') {
          localStorage.setItem('leadflow_refresh_token', newRefreshToken)
        }

        setAccessToken(newAccessToken)
        onRefreshed(newAccessToken)

        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return api(originalRequest)
        }

        // Server returned 200 but no token — treat as failure so subscribers
        // are not left hanging and queued requests are rejected cleanly.
        return Promise.reject(error)
      } catch (refreshError) {
        // Latch: prevent subsequent 401s from spawning more refresh calls.
        refreshFailed = true
        setAccessToken(null)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('leadflow_refresh_token')
        }
        onRefreshed(null)
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)
