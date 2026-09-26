export const CLIENT_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const CLIENT_TYPES = ['BUYER', 'SELLER', 'BOTH', 'OTHER'] as const
export type ClientType = (typeof CLIENT_TYPES)[number]

export interface ClientAddress {
  street?: string
  city?: string
  state?: string
  postalCode?: string
}

export interface ClientAdvisorDetails {
  _id: string
  name: string
  email: string
  phone?: string
  role?: string
}

export interface ClientLeadOrigin {
  _id: string
  status: string
  source?: string
  score?: number
  createdAt?: string
  customFields?: Record<string, unknown>
}

export interface Client {
  _id: string
  brokerageId: string | { _id: string; name?: string; slug?: string }
  userId?: string | null
  firstName: string
  lastName: string
  email: string
  phone?: string
  status: ClientStatus
  type: ClientType
  assignedTo?: string | ClientAdvisorDetails | null
  leadId?: string | ClientLeadOrigin | null
  address?: ClientAddress
  createdAt: string
  updatedAt: string
}

