import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from 'lucide-react'
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
    <Card className="p-5 border-slate-200/80 bg-white shadow-2xs space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Registered Profile & Case Details
        </h2>
        <p className="text-xs text-muted-foreground">
          Primary applicant identity and property communication address
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
          <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-slate-400">
              Primary Applicant
            </span>
            <p className="font-semibold text-slate-900">
              {client.firstName} {client.lastName}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
          <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5 min-w-0">
            <span className="text-[11px] font-medium text-slate-400">
              Registered Email
            </span>
            <p className="font-semibold text-slate-900 truncate">
              {client.email}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
          <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-slate-400">
              Contact Phone
            </span>
            <p className="font-semibold text-slate-900">
              {client.phone || 'Not specified'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
          <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-slate-400">
              Application Initiated
            </span>
            <p className="font-semibold text-slate-900">
              {formatDate(client.createdAt)}
            </p>
          </div>
        </div>

        <div className="sm:col-span-2 flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
          <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-slate-400">
              Registered Communication Address
            </span>
            <p className="font-semibold text-slate-900">
              {formattedAddress || 'Address details pending verification'}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
