import * as React from 'react'
import { Home, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { useMyCase, useClientDocuments } from '@/features/clients/api/clients.api'
import { useDocumentSocket } from '@/features/documents/hooks/useDocumentSocket'
import { UploadDocumentModal } from '@/features/clients/components/UploadDocumentModal'

import { PortalCaseHeader } from './components/PortalCaseHeader'
import { PortalFinanceStrip } from './components/PortalFinanceStrip'
import { PortalMilestoneStepper } from './components/PortalMilestoneStepper'
import { PortalDocumentSummary } from './components/PortalDocumentSummary'
import { PortalAdvisorCard } from './components/PortalAdvisorCard'
import { PortalCaseDetails } from './components/PortalCaseDetails'

export function ClientCasePage() {
  // 1. Fetch authenticated client's personal case (IDOR-immune, GET /api/clients/me)
  const {
    data: client,
    isLoading: isClientLoading,
    isError: isClientError,
    error: clientError,
    refetch: refetchClient,
    isFetching: isClientFetching,
  } = useMyCase()

  // 2. Fetch authenticated client's documents (GET /api/documents?clientId=...)
  const {
    data: documents = [],
    isLoading: isDocsLoading,
    refetch: refetchDocs,
    isFetching: isDocsFetching,
  } = useClientDocuments(client?._id)

  // 3. Realtime Socket.IO subscription for live verification updates
  useDocumentSocket({
    clientId: client?._id,
    enabled: Boolean(client?._id),
  })

  // Modal state for uploading document
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false)

  const handleRefresh = () => {
    refetchClient()
    if (client?._id) {
      refetchDocs()
    }
  }

  // 1. Loading Skeleton State
  if (isClientLoading || isDocsLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-44 w-full rounded-2xl bg-slate-200" />

        {/* Financial KPI Strip Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>

        {/* Milestone Tracker Skeleton */}
        <Skeleton className="h-40 rounded-xl" />

        {/* Bottom Split Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  // 2. Error State
  if (isClientError) {
    return (
      <div className="py-12">
        <ErrorState
          title="Unable to Load Mortgage Case"
          message={
            (clientError as Error)?.message ||
            'There was an unexpected error retrieving your mortgage case. Please verify your connection and try again.'
          }
          onRetry={handleRefresh}
        />
      </div>
    )
  }

  // 3. Empty / Not Found State
  if (!client) {
    return (
      <div className="py-12">
        <Card className="p-8 text-center max-w-lg mx-auto border-slate-200 bg-white">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Home className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">
            Application Dossier in Preparation
          </h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Your mortgage account has been registered, but your formal case file has not yet been linked. Your designated mortgage advisor is preparing your initial file.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button size="sm" onClick={handleRefresh} variant="outline" className="text-xs">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Check Again
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // 4. Normal Case Overview Dashboard
  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <PortalCaseHeader
        client={client}
        isRefetching={isClientFetching || isDocsFetching}
        onRefresh={handleRefresh}
      />

      {/* 2. Financing Overview Strip (Target Loan, Property Value, LTV %, Income) */}
      <PortalFinanceStrip client={client} />

      {/* 3. Application Milestone Journey */}
      <PortalMilestoneStepper documents={documents} />

      {/* 4. Split Section: Documents on Left, Advisor & Profile on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 cols): Document Verification Summary */}
        <div className="lg:col-span-2 space-y-6">
          <PortalDocumentSummary
            documents={documents}
            onOpenUpload={() => setIsUploadModalOpen(true)}
          />
        </div>

        {/* Right Column (1 col): Assigned Advisor & Case Profile */}
        <div className="space-y-6">
          <PortalAdvisorCard client={client} />
          <PortalCaseDetails client={client} />
        </div>
      </div>

      {/* Document Upload Modal */}
      {client && (
        <UploadDocumentModal
          clientId={client._id}
          clientName={`${client.firstName} ${client.lastName}`}
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false)
            refetchDocs()
          }}
        />
      )}
    </div>
  )
}
