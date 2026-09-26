/**
 * Template Preview and Variable Interpolation Engine
 * Provides realistic Indian mortgage borrower context and safe client-side placeholder resolution.
 */

export interface TemplateContextData {
  lead: {
    firstName: string
    lastName: string
    fullName: string
    name: string
    email: string
    phone: string
    status: string
    source: string
    score: number
  }
  advisor: {
    name: string
    email: string
    phone: string
  }
  brokerage: {
    name: string
    slug: string
  }
  newStage: string
  previousStage: string
  customFields: {
    loanAmount: string
    propertyCity: string
    propertyType: string
  }
}

export const SAMPLE_TEMPLATE_CONTEXT: TemplateContextData = {
  lead: {
    firstName: 'Rahul',
    lastName: 'Sharma',
    fullName: 'Rahul Sharma',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    phone: '+91 98765 43210',
    status: 'PROPOSAL',
    source: 'WEBSITE',
    score: 85,
  },
  advisor: {
    name: 'Priya Patel',
    email: 'priya.patel@leadflow.in',
    phone: '+91 98111 22334',
  },
  brokerage: {
    name: 'Apex Home Finance',
    slug: 'apex-home-finance',
  },
  newStage: 'PROPOSAL',
  previousStage: 'QUALIFIED',
  customFields: {
    loanAmount: '₹75,00,000',
    propertyCity: 'Bengaluru',
    propertyType: '3BHK Apartment',
  },
}

export interface AvailableVariable {
  token: string
  label: string
  category: 'Borrower' | 'Advisor' | 'Brokerage' | 'Pipeline'
  sampleValue: string
  description: string
}

export const AVAILABLE_TEMPLATE_VARIABLES: AvailableVariable[] = [
  {
    token: '{{lead.firstName}}',
    label: 'Borrower First Name',
    category: 'Borrower',
    sampleValue: 'Rahul',
    description: "The primary applicant's first name",
  },
  {
    token: '{{lead.lastName}}',
    label: 'Borrower Last Name',
    category: 'Borrower',
    sampleValue: 'Sharma',
    description: "The primary applicant's last name",
  },
  {
    token: '{{lead.fullName}}',
    label: 'Borrower Full Name',
    category: 'Borrower',
    sampleValue: 'Rahul Sharma',
    description: "The primary applicant's full name",
  },
  {
    token: '{{lead.email}}',
    label: 'Borrower Email',
    category: 'Borrower',
    sampleValue: 'rahul.sharma@example.com',
    description: 'Email address of the borrower',
  },
  {
    token: '{{lead.phone}}',
    label: 'Borrower Phone',
    category: 'Borrower',
    sampleValue: '+91 98765 43210',
    description: 'Phone number of the borrower',
  },
  {
    token: '{{advisor.name}}',
    label: 'Advisor Name',
    category: 'Advisor',
    sampleValue: 'Priya Patel',
    description: 'Assigned mortgage advisor full name',
  },
  {
    token: '{{advisor.email}}',
    label: 'Advisor Email',
    category: 'Advisor',
    sampleValue: 'priya.patel@leadflow.in',
    description: 'Assigned mortgage advisor email address',
  },
  {
    token: '{{advisor.phone}}',
    label: 'Advisor Contact',
    category: 'Advisor',
    sampleValue: '+91 98111 22334',
    description: 'Advisor direct contact number',
  },
  {
    token: '{{brokerage.name}}',
    label: 'Brokerage Name',
    category: 'Brokerage',
    sampleValue: 'Apex Home Finance',
    description: 'Your mortgage brokerage company name',
  },
  {
    token: '{{newStage}}',
    label: 'Pipeline Stage',
    category: 'Pipeline',
    sampleValue: 'PROPOSAL',
    description: 'Target stage of the lead transition',
  },
]

const FORBIDDEN_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'valueOf',
  'toString',
  'toLocaleString',
])

function resolveDottedPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    if (FORBIDDEN_PROPERTIES.has(part)) {
      return undefined
    }
    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Safely renders a template string with placeholders replaced by sample data or supplied context.
 * Supports both nested `{{lead.firstName}}` and flat `{{firstName}}`.
 */
export function renderTemplatePreview(
  template: string,
  contextOverrides?: Partial<TemplateContextData>,
): string {
  if (!template) return ''

  const base = { ...SAMPLE_TEMPLATE_CONTEXT, ...contextOverrides }

  // Flat aliases matching backend template.ts
  const lookupContext: Record<string, unknown> = {
    ...base,
    firstName: base.lead.firstName,
    lastName: base.lead.lastName,
    fullName: base.lead.fullName,
    name: base.lead.name,
    email: base.lead.email,
    phone: base.lead.phone,
    advisorName: base.advisor.name,
    advisorEmail: base.advisor.email,
    brokerageName: base.brokerage.name,
    stage: base.newStage,
  }

  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = resolveDottedPath(lookupContext, key)
    if (value === undefined || value === null) {
      return `[${key}]`
    }
    return String(value)
  })
}

/**
 * Extracts all unique placeholder variable tokens (e.g. ['lead.firstName', 'advisor.name']) from text
 */
export function extractPlaceholders(text: string): string[] {
  if (!text) return []
  const matches = text.match(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)
  if (!matches) return []
  const unique = new Set(
    matches.map((m) => m.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '')),
  )
  return Array.from(unique)
}
