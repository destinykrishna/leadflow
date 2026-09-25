import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@/types/api.types'
import type { AuthResponseData } from '@/types/auth.types'

let inMemoryToken: string | null = null
let isRefreshing = false
let refreshSubscribers: Array<(token: string | null) => void> = [];

export function getAccessToken(): string | null {
  return inMemoryToken
}

export function setAccessToken(token: string | null): void {
  inMemoryToken = token
}

function onRefreshed(token: string | null): void {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

function subscribeTokenRefresh(cb: (token: string | null) => void): void {
  refreshSubscribers.push(cb)
}

export const api = axios.create({
  baseURL: '/api',
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

    // If 401 Unauthorized and not an auth endpoint, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
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
        const refreshResponse = await axios.post<ApiResponse<AuthResponseData>>(
          '/api/auth/refresh',
          {},
          { withCredentials: true },
        )

        const newAccessToken = refreshResponse.data.data?.accessToken ?? null
        setAccessToken(newAccessToken)
        onRefreshed(newAccessToken)

        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        setAccessToken(null)
        onRefreshed(null)
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)
