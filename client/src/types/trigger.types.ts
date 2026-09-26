export type TriggerActionType = 'CREATE_TASK' | 'SEND_EMAIL' | 'NOTIFICATION'
export type TriggerRecipientType = 'LEAD' | 'AGENT' | 'CUSTOM'

export interface IPopulatedEmailTemplate {
  _id: string
  name: string
  slug: string
  subject: string
}

export interface ITriggerActionConfig {
  taskTitle?: string
  taskDescription?: string
  taskPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDaysOffset?: number
  dueHoursOffset?: number | null
  templateId?: string | IPopulatedEmailTemplate | null
  recipientType?: TriggerRecipientType
  customRecipientEmail?: string | null
}

export interface IPipelineTrigger {
  _id: string
  brokerageId: string
  name: string
  fromStage?: string | null
  toStage: string
  actionType: TriggerActionType
  actionConfig: ITriggerActionConfig
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTriggerPayload {
  name: string
  fromStage?: string | null
  toStage: string
  actionType: TriggerActionType
  actionConfig: ITriggerActionConfig
  isActive?: boolean
}

export interface UpdateTriggerPayload {
  name?: string
  fromStage?: string | null
  toStage?: string
  actionType?: TriggerActionType
  actionConfig?: ITriggerActionConfig
  isActive?: boolean
}

export interface TriggerFilterValues {
  search: string
  actionType: 'ALL' | TriggerActionType
  stage: string // 'ALL' or specific stage
  status: 'ALL' | 'ACTIVE' | 'PAUSED'
}
