export const FORM_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export type FormStatus = (typeof FORM_STATUSES)[number]

export const FORM_FIELD_TYPES = [
  'text',
  'email',
  'phone',
  'number',
  'textarea',
  'select',
] as const
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export interface IFormField {
  fieldKey: string
  label: string
  type: FormFieldType
  required: boolean
  order: number
  placeholder?: string
  helpText?: string
  options?: string[]
}

export interface IForm {
  _id: string
  brokerageId: string
  title: string
  slug: string
  description?: string
  status: FormStatus
  fields: IFormField[]
  submitButtonText: string
  successMessage: string
  submissionCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateFormPayload {
  title: string
  slug: string
  description?: string
  status?: FormStatus
  fields: IFormField[]
  submitButtonText?: string
  successMessage?: string
}

export interface UpdateFormPayload {
  title?: string
  slug?: string
  description?: string
  status?: FormStatus
  fields?: IFormField[]
  submitButtonText?: string
  successMessage?: string
}

export interface FormQueryParams {
  status?: FormStatus | 'ALL'
  search?: string
  page?: number
  limit?: number
  sort?: 'createdAt' | 'updatedAt' | 'title' | 'submissionCount'
  order?: 'asc' | 'desc'
}

export interface IPublicFormField {
  fieldKey: string
  label: string
  type: string
  required: boolean
  order: number
  placeholder?: string
  helpText?: string
  options?: string[]
}

export interface IPublicFormView {
  id: string
  brokerageId: string
  brokerageName: string
  title: string
  slug: string
  description?: string
  fields: IPublicFormField[]
  submitButtonText: string
}

export interface PublicFormSubmissionPayload {
  responses: Record<string, string | number | boolean | null>
  _hp?: string
  hp_website?: string
}

export interface PublicSubmissionResponse {
  success: boolean
  message: string
}

