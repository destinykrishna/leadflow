export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_SOURCES = [
  'WEBSITE',
  'REFERRAL',
  'ZILLOW',
  'REALTOR',
  'CAMPAIGN',
  'MANUAL',
  'OTHER',
] as const

export type LeadSource = (typeof LEAD_SOURCES)[number]

export interface LeadCustomFields {
  loanAmount?: number
  propertyValue?: number
  employmentStatus?: string
  residenceStatus?: string
  monthlyIncome?: number
  isAlreadyKnown?: boolean
  knownAs?: 'LEAD' | 'CLIENT'
  existingClientId?: string
  [key: string]: unknown
}

export interface LeadAssignedUser {
  _id: string
  name: string
  email: string
}

export interface Lead {
  _id: string
  brokerageId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  status: LeadStatus
  source: LeadSource
  score: number
  assignedTo?: LeadAssignedUser | string | null
  convertedClientId?: string | null
  notes?: string
  customFields?: LeadCustomFields
  createdAt: string
  updatedAt: string
  __v?: number
}

export interface PipelineGroupedData {
  pipeline: Record<LeadStatus, Lead[]>
  counts: Record<LeadStatus, number>
  total: number
}

export interface StageDefinition {
  id: LeadStatus
  label: string
  description: string
  badgeVariant: 'neutral' | 'default' | 'success' | 'warning' | 'danger'
  isTerminal?: boolean
}

export const STAGE_DEFINITIONS: Record<LeadStatus, StageDefinition> = {
  NEW: {
    id: 'NEW',
    label: 'New Inquiry',
    description: 'Fresh lead ingested from website or campaign',
    badgeVariant: 'neutral',
  },
  CONTACTED: {
    id: 'CONTACTED',
    label: 'Contacted',
    description: 'Initial borrower consultation underway',
    badgeVariant: 'default',
  },
  QUALIFIED: {
    id: 'QUALIFIED',
    label: 'Qualified',
    description: 'Creditworthiness and down payment verified',
    badgeVariant: 'default',
  },
  PROPOSAL: {
    id: 'PROPOSAL',
    label: 'Proposal',
    description: 'Bank rate comparison delivered to borrower',
    badgeVariant: 'warning',
  },
  NEGOTIATION: {
    id: 'NEGOTIATION',
    label: 'Negotiation',
    description: 'Financing terms under bank review',
    badgeVariant: 'warning',
  },
  WON: {
    id: 'WON',
    label: 'Won / Converted',
    description: 'Mortgage approved and client case established',
    badgeVariant: 'success',
    isTerminal: true,
  },
  LOST: {
    id: 'LOST',
    label: 'Lost',
    description: 'Unqualified or borrower opted out',
    badgeVariant: 'danger',
    isTerminal: true,
  },
}

export const ORDERED_STAGES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
]

/**
 * State machine rules matching backend validation:
 * Linear forward moves (NEW -> CONTACTED -> QUALIFIED -> PROPOSAL -> NEGOTIATION -> WON / LOST)
 * Any active stage can drop off to LOST.
 * WON and LOST are terminal with 0 outgoing moves.
 * Backward transitions or stage skipping are rejected.
 */
export const VALID_STAGE_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['NEGOTIATION', 'LOST'],
  NEGOTIATION: ['WON', 'LOST'],
  WON: [],
  LOST: [],
} as const

export function isValidStageTransition(
  currentStatus: LeadStatus,
  nextStatus: LeadStatus,
): boolean {
  if (currentStatus === nextStatus) return false
  const allowed = VALID_STAGE_TRANSITIONS[currentStatus]
  return allowed ? allowed.includes(nextStatus) : false
}

export interface PipelineStageChangedBroadcastPayload {
  leadId: string
  brokerageId: string
  previousStage: LeadStatus
  newStage: LeadStatus
  version: number
  timestamp: string
  updatedBy: {
    id: string
    name: string
    role: string
  }
}

