import { CheckCircle2, ShieldCheck, FileCheck2, Landmark } from 'lucide-react'
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
      name: 'Application Initiated',
      desc: 'Profile & requirements registered',
      icon: CheckCircle2,
      status: 'completed' as const,
    },
    {
      id: 2,
      name: 'Document Verification',
      desc: hasDocs
        ? `${verifiedCount} of ${totalDocs} documents verified`
        : 'Upload KYC & income documents',
      icon: FileCheck2,
      status: allVerified
        ? ('completed' as const)
        : hasDocs
        ? ('in_progress' as const)
        : ('action_needed' as const),
    },
    {
      id: 3,
      name: 'Underwriting & Valuation',
      desc: 'Bank review & property legal checks',
      icon: ShieldCheck,
      status: allVerified ? ('in_progress' as const) : ('upcoming' as const),
    },
    {
      id: 4,
      name: 'Sanction & Disbursement',
      desc: 'Offer letter issuance & loan sanction',
      icon: Landmark,
      status: 'upcoming' as const,
    },
  ]

  return (
    <Card className="p-5 border-slate-200/80 bg-white shadow-2xs">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">
          Application Progress Journey
        </h2>
        <p className="text-xs text-muted-foreground">
          Step-by-step milestones toward your home loan sanction and property registration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {steps.map((step) => {
          const isCompleted = step.status === 'completed'
          const isInProgress = step.status === 'in_progress'
          const isActionNeeded = step.status === 'action_needed'

          return (
            <div
              key={step.id}
              className={`relative flex flex-col p-3.5 rounded-xl border transition-all ${
                isCompleted
                  ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                  : isInProgress
                  ? 'border-blue-300 bg-blue-50/40 text-blue-950 ring-1 ring-blue-500/20'
                  : isActionNeeded
                  ? 'border-amber-200 bg-amber-50/40 text-amber-950'
                  : 'border-slate-200 bg-slate-50/60 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isInProgress
                      ? 'bg-blue-600 text-white'
                      : isActionNeeded
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                </span>

                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-800'
                      : isInProgress
                      ? 'bg-blue-100 text-blue-800'
                      : isActionNeeded
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted
                    ? 'Completed'
                    : isInProgress
                    ? 'In Progress'
                    : isActionNeeded
                    ? 'Action Required'
                    : 'Upcoming'}
                </span>
              </div>

              <h3 className="text-xs font-bold text-slate-900 mb-1">
                {step.name}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                {step.desc}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
