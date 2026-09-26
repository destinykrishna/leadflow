import {
  IndianRupee,
  Building,
  TrendingUp,
  Wallet,
  Info,
} from 'lucide-react'
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Loan & Financing Overview
          </h2>
          <p className="text-xs text-muted-foreground">
            Current financing figures under review for your property acquisition
          </p>
        </div>
      </div>

      {hasFinancialData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Target Home Loan */}
          <Card className="p-4 bg-white border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Target Loan Amount
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(loanAmount)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {downPayment > 0
                ? `Down payment: ${formatCurrency(downPayment)}`
                : 'Sanction requested'}
            </p>
          </Card>

          {/* 2. Property Valuation */}
          <Card className="p-4 bg-white border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Property Valuation
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Building className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(propertyValue)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Estimated acquisition price
            </p>
          </Card>

          {/* 3. Loan-to-Value (LTV) */}
          <Card className="p-4 bg-white border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Loan-to-Value (LTV)
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                {ltv ? `${ltv}%` : 'N/A'}
              </span>
              {ltv && Number(ltv) <= 80 && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  Standard Ratio
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {ltv ? 'Financed portion of property' : 'Pending final valuation'}
            </p>
          </Card>

          {/* 4. Monthly Gross Income */}
          <Card className="p-4 bg-white border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Monthly Gross Income
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                {monthlyIncome > 0 ? formatCurrency(monthlyIncome) : 'Verified via KYC'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Assessed borrower eligibility
            </p>
          </Card>
        </div>
      ) : (
        <Card className="p-5 border-slate-200/80 bg-slate-50/50">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Info className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-slate-900">
                Financial Assessment in Progress
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your mortgage advisor is calculating your optimal loan-to-value ratio, interest rates, and loan ticket size based on your property choice and income proof documents.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
