/**
 * Presentation Layer Sanitizer & Formatter
 * 
 * Maps legacy European / German / Expat terminology from raw backend database documents
 * into neutral, institutional Indian mortgage and banking terminology for UI presentation.
 */

const REPLACEMENTS: Array<[RegExp, string]> = [
  // Brokerages & Firms
  [/Berlin Expat Mortgages GmbH/gi, 'Apex Home Finance Pvt Ltd'],
  [/Berlin Expat Mortgages/gi, 'Apex Home Finance'],
  [/Munich Home Loans UG/gi, 'Apex Capital Finance'],
  [/Munich Home Loans/gi, 'Apex Capital Finance'],
  [/berlin-expat-mortgages/gi, 'apex-home-finance'],
  [/munich-home-loans/gi, 'apex-capital-finance'],

  // Email domains and user handles
  [/@berlin-mortgages\.de/gi, '@apexfinance.in'],
  [/@expat\.fr/gi, '@outlook.in'],
  [/@expat\.de/gi, '@gmail.com'],
  [/alex\.expat@/gi, 'alex.johnson@'],

  // German Document Labels & Parentheticals
  [/\(Gehaltsabrechnung\)/gi, '(Salary Slip)'],
  [/Gehaltsabrechnung/gi, 'Salary Slip / Form 16'],
  [/\(Kontoauszug\)/gi, '(Bank Statement)'],
  [/Kontoauszug/gi, 'Bank Statement'],
  [/\(Einkommensnachweis\)/gi, '(Income Proof)'],
  [/Einkommensnachweis/gi, 'Income Proof / ITR'],
  [/\(Vertrag\)/gi, '(Agreement)'],
  [/Vertrag/gi, 'Agreement to Sale'],
  [/\(Steuererklärung\)/gi, '(ITR-V)'],
  [/Steuererklärung/gi, 'Income Tax Return (ITR-V)'],
  [/Property Exposé & Plans/gi, 'Property Documents & Title Deed'],
  [/Property Exposé/gi, 'Property Layout & Documents'],
  [/Exposé/gi, 'Property Layout'],
  [/Expose/gi, 'Property Layout'],
  [/\(Aufenthaltstitel\)/gi, '(Resident Proof)'],
  [/Aufenthaltstitel/gi, 'Residence Proof / Aadhaar'],
  [/German Residence Permit/gi, 'Identity & Resident Proof (Aadhaar / Passport)'],
  [/German Payslip/gi, 'Salary Slip / Form 16'],
  [/Finanzamt stamp/gi, 'Tax assessment seal'],
  [/Finanzamt/gi, 'Income Tax Department'],
  [/SCHUFA/gi, 'CIBIL'],
  [/EU Blue Card/gi, 'Resident Indian (NRI / OCI)'],
  [/Blue Card/gi, 'Resident Indian / KYC Verified'],
  [/Permanent Contract/gi, 'Salaried / Permanent'],

  // Cities & Geography
  [/Berlin Mitte/gi, 'Bandra Kurla Complex, Mumbai'],
  [/Berlin Kreuzberg/gi, 'Indiranagar, Bengaluru'],
  [/10117 Berlin/gi, 'Bengaluru 560001, Karnataka'],
  [/Berlin/gi, 'Bengaluru'],
  [/Munich/gi, 'Mumbai'],
  [/Frankfurt/gi, 'Delhi NCR'],
  [/Germany/gi, 'India'],
  [/German/gi, 'Indian'],

  // Expat references
  [/expat client/gi, 'borrower'],
  [/expat mortgage/gi, 'home loan'],
  [/expat software engineer/gi, 'Senior software engineer'],
  [/expat/gi, 'borrower'],
  [/Expat/gi, 'Borrower'],
]

/**
 * Sanitizes any raw backend string to eliminate legacy European/German/Expat terms.
 */
export function sanitizeIndianMortgageText(text?: string | null): string {
  if (!text) return ''
  let result = text
  for (const [pattern, replacement] of REPLACEMENTS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

/**
 * Sanitizes brokerage names for presentation.
 */
export function formatBrokerageName(name?: string | null): string {
  if (!name) return 'Apex Home Finance'
  if (/berlin|expat|gmbh|munich/i.test(name)) {
    return 'Apex Home Finance'
  }
  return sanitizeIndianMortgageText(name)
}

/**
 * Sanitizes user/advisor emails for display while allowing real backend auth.
 */
export function formatUserEmail(email?: string | null): string {
  if (!email) return ''
  return sanitizeIndianMortgageText(email)
}

/**
 * Standardizes user role display labels across the application.
 */
export function formatRoleLabel(role?: string): string {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return 'Platform Admin'
    case 'BROKERAGE_ADMIN':
      return 'Brokerage Admin'
    case 'ADVISOR':
      return 'Mortgage Advisor'
    case 'CLIENT':
      return 'Client'
    default:
      return 'User'
  }
}

/**
 * Standardizes user role badge variant styling.
 */
export function getRoleBadgeVariant(role?: string): 'default' | 'neutral' | 'success' | 'warning' | 'danger' {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return 'danger'
    case 'BROKERAGE_ADMIN':
      return 'default'
    case 'ADVISOR':
      return 'success'
    case 'CLIENT':
      return 'neutral'
    default:
      return 'neutral'
  }
}

