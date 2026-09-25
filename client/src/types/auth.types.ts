export type UserRole = 'PLATFORM_ADMIN' | 'BROKERAGE_ADMIN' | 'ADVISOR' | 'CLIENT'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  status: UserStatus
  brokerageId: string | null
}

export interface LoginCredentials {
  email: string
  password: string
  brokerageSlug?: string
  brokerageId?: string
}

export interface AuthResponseData {
  user: AuthUser
  accessToken: string
}
