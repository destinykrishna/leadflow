import { Card } from '@/components/ui/Card'
import { formatDate } from '@/lib/format'
import type { Client } from '@/types/client.types'

export interface PortalCaseDetailsProps {
  client: Client
}

export function PortalCaseDetails({ client }: PortalCaseDetailsProps) {
  const address = client.address
  const formattedAddress = [
    address?.street,
    address?.city,
    address?.state,
    address?.postalCode ? `PIN: ${address.postalCode}` : undefined,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Card className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Applicant Details
        </h2>
        <p className="text-xs text-slate-500">
          Registered borrower contact and correspondence information
        </p>
      </div>

      <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white text-xs">
        <div className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Primary Applicant
          </span>
          <span className="font-semibold text-slate-900">
            {client.firstName} {client.lastName}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Registered Email
          </span>
          <span className="font-medium text-slate-900 truncate">
            {client.email}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Contact Phone
          </span>
          <span className="font-medium text-slate-900">
            {client.phone || 'Not provided'}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Application Date
          </span>
          <span className="font-medium text-slate-900">
            {formatDate(client.createdAt)}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-start sm:justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 shrink-0 sm:mt-0.5">
            Correspondence Address
          </span>
          <span className="font-medium text-slate-900 text-right sm:max-w-xs">
            {formattedAddress || 'Pending verification'}
          </span>
        </div>
      </div>
    </Card>
  )
}
