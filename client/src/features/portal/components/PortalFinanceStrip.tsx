import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/format'
import type { Client } from '@/types/client.types'

export interface PortalFinanceStripProps {
  client: Client
}

export function PortalFinanceStrip({ client }: PortalFinanceStripProps) {
  // Extract customFields safely from populated leadId
  const customFields =
    typeof client.leadId === 'object' && client.leadId !== null
      ? (client.leadId.customFields as Record<string, unknown> | undefined)
      : undefined

  const loanAmount = Number(customFields?.loanAmount) || 0
  const propertyValue = Number(customFields?.propertyValue) || 0
  const monthlyIncome =
    Number(customFields?.monthlyGrossIncome) ||
    Number(customFields?.monthlyIncome) ||
    0
  const downPayment = Number(customFields?.downPayment) || 0

  const hasFinancialData = loanAmount > 0 || propertyValue > 0 || monthlyIncome > 0

  const ltv =
    loanAmount > 0 && propertyValue > 0
      ? ((loanAmount / propertyValue) * 100).toFixed(1)
      : null

  if (!hasFinancialData) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600">
        <span className="font-semibold text-slate-800">Financial Assessment:</span>{' '}
        Loan terms and valuation figures will appear here once your preliminary documentation is reviewed by your advisor.
      </div>
    )
  }

  return (
    <Card className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs">
      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
        {/* 1. Target Home Loan */}
        <div className="p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Requested Loan Amount
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {formatCurrency(loanAmount)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {downPayment > 0
              ? `Down payment: ${formatCurrency(downPayment)}`
              : 'Subject to final sanction'}
          </p>
        </div>

        {/* 2. Property Valuation */}
        <div className="p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Property Valuation
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {propertyValue > 0 ? formatCurrency(propertyValue) : 'Under Valuation'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Estimated purchase price
          </p>
        </div>

        {/* 3. Loan-to-Value (LTV) */}
        <div className="p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Loan-to-Value (LTV)
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {ltv ? `${ltv}%` : '—'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {ltv ? 'Financed portion of asset' : 'Pending valuation report'}
          </p>
        </div>

        {/* 4. Monthly Gross Income */}
        <div className="p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Assessed Monthly Income
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {monthlyIncome > 0 ? formatCurrency(monthlyIncome) : 'Verified via KYC'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Eligibility basis
          </p>
        </div>
      </div>
    </Card>
  )
}
