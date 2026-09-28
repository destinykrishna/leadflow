export type AdvisorStatus = 'ACTIVE' | 'INACTIVE'

export interface AdvisorItem {
  id: string
  _id?: string
  name: string
  email: string
  role: 'ADVISOR'
  status: AdvisorStatus
  phone?: string
  brokerageId: string
  createdAt: string
  updatedAt: string
}

export interface CreateAdvisorPayload {
  name: string
  email: string
  password?: string
  phone?: string
}

export interface UpdateAdvisorPayload {
  name?: string
  phone?: string
  status?: AdvisorStatus
}

export interface ListAdvisorsQuery {
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  search?: string
  page?: number
  limit?: number
}

export interface PaginatedAdvisorsResponse {
  advisors: AdvisorItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}
