export type BrokeragePlan = 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE'
export type BrokerageStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL'

export interface BrokerageItem {
  _id: string
  name: string
  slug?: string
  plan: BrokeragePlan
  status: BrokerageStatus
  webhookSecret?: string
  createdAt: string
  updatedAt: string
}

export interface InitialAdminInput {
  name: string
  email: string
  password?: string
  phone?: string
}

export interface CreateBrokeragePayload {
  name: string
  slug?: string
  plan?: BrokeragePlan
  status?: BrokerageStatus
  admin: {
    name: string
    email: string
    password?: string
    phone?: string
  }
}

export interface UpdateBrokeragePayload {
  name?: string
  slug?: string
  plan?: BrokeragePlan
  status?: BrokerageStatus
}

export interface SafeAdminResult {
  id: string
  name: string
  email: string
  role: string
  status: string
  phone?: string
  brokerageId: string
  createdAt: string
}

export interface SafeBrokerageResult {
  id: string
  name: string
  slug?: string
  plan: BrokeragePlan
  status: BrokerageStatus
  webhookSecret?: string
  createdAt: string
  updatedAt: string
}

export interface OnboardingResult {
  brokerage: SafeBrokerageResult
  admin: SafeAdminResult
}

export interface RotateWebhookSecretResult {
  id: string
  webhookSecret: string
}
