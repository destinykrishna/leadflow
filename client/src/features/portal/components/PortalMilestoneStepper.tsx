import { Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { DocumentItem } from '@/types/document.types'

export interface PortalMilestoneStepperProps {
  documents: DocumentItem[]
}

export function PortalMilestoneStepper({ documents }: PortalMilestoneStepperProps) {
  const verifiedCount = documents.filter((d) => d.status === 'VERIFIED').length
  const totalDocs = documents.length
  const hasDocs = totalDocs > 0
  const allVerified = hasDocs && verifiedCount === totalDocs

  const steps = [
    {
      id: 1,
      name: 'Application Submitted',
      detail: 'Registration complete',
      state: 'completed' as const,
    },
    {
      id: 2,
      name: 'Document Verification',
      detail: allVerified
        ? 'All files verified'
        : hasDocs
        ? `${verifiedCount} of ${totalDocs} verified`
        : 'Upload KYC & income proof',
      state: allVerified
        ? ('completed' as const)
        : hasDocs
        ? ('active' as const)
        : ('action_needed' as const),
    },
    {
      id: 3,
      name: 'Underwriting & Valuation',
      detail: allVerified ? 'Bank review in progress' : 'Pending documents',
      state: allVerified ? ('active' as const) : ('upcoming' as const),
    },
    {
      id: 4,
      name: 'Sanction & Disbursement',
      detail: 'Final approval & sanction',
      state: 'upcoming' as const,
    },
  ]

  return (
    <Card className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Application Progress
          </h2>
          <p className="text-xs text-slate-500">
            Key milestones from document intake to final loan sanction
          </p>
        </div>
      </div>

      <div className="relative">
        {/* Horizontal connector line (desktop) */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-3.5 left-10 right-10 h-[2px] bg-slate-200"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-2">
          {steps.map((step) => {
            const isCompleted = step.state === 'completed'
            const isActive = step.state === 'active' || step.state === 'action_needed'

            return (
              <div
                key={step.id}
                className="relative flex items-start gap-3 md:flex-col md:items-start"
              >
                {/* Step indicator node */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-white z-10 transition-colors ${
                    isCompleted
                      ? 'bg-slate-900 text-white'
                      : isActive
                      ? 'border-2 border-slate-900 bg-white text-slate-900'
                      : 'border border-slate-300 bg-white text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>

                {/* Step info */}
                <div className="min-w-0 md:mt-2">
                  <p
                    className={`text-xs font-semibold ${
                      isCompleted || isActive ? 'text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {step.name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {step.detail}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
