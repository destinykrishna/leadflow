export interface IEmailTemplate {
  _id: string
  brokerageId: string
  name: string
  slug: string
  subject: string
  body: string
  variables: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateEmailTemplatePayload {
  name: string
  slug: string
  subject: string
  body: string
  variables?: string[]
  isActive?: boolean
}

export interface UpdateEmailTemplatePayload {
  name?: string
  slug?: string
  subject?: string
  body?: string
  variables?: string[]
  isActive?: boolean
}

export interface TemplateFilterValues {
  search: string
  status: 'ALL' | 'ACTIVE' | 'INACTIVE'
}
