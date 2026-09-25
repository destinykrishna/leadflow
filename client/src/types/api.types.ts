export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: ApiErrorPayload
}
