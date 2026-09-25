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

export interface Client {
  _id: string
  brokerageId: string
  userId?: string | null
  firstName: string
  lastName: string
  email: string
  phone?: string
  status: ClientStatus
  type: ClientType
  assignedTo?: string | null
  leadId?: string | null
  address?: ClientAddress
  createdAt: string
  updatedAt: string
}
