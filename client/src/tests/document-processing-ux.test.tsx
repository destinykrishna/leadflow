import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { DocumentItem } from '@/types/document.types'
import type { Client } from '@/types/client.types'
import type { Lead } from '@/types/pipeline.types'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'
import * as AuthHook from '@/hooks/useAuth'
import * as ClientsApi from '@/features/clients/api/clients.api'
import * as DocumentsApi from '@/features/documents/api/documents.api'
import * as LeadsApi from '@/features/leads/api/leads.api'
import * as SocketLib from '@/lib/socket'
import { UploadDocumentModal } from '@/features/clients/components/UploadDocumentModal'
import { ClientDetailView } from '@/features/clients/components/ClientDetailView'
import { DocumentsPage } from '@/features/documents/DocumentsPage'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}))

describe('Phase 4 — Prompt 2: Document Upload & Processing UX', () => {
  let queryClient: QueryClient

  const mockAdvisor: AuthUser = {
    id: 'advisor-1',
    email: 'elena@berlin.de',
    name: 'Elena Schmidt',
    role: 'ADVISOR',
    status: 'ACTIVE',
    brokerageId: 'brokerage-1',
  }

  const createMockAuth = (user: AuthUser | null): AuthContextValue => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  })

  const sampleClient: Client = {
    _id: 'client-1',
    brokerageId: 'brokerage-1',
    userId: 'user-client-1',
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'alex.morgan@example.com',
    phone: '+49 170 5551234',
    status: 'ACTIVE',
    type: 'BUYER',
    assignedTo: {
      _id: 'advisor-1',
      name: 'Elena Schmidt',
      email: 'elena@berlin.de',
      role: 'ADVISOR',
    },
    leadId: 'lead-1',
    address: {
      street: 'Friedrichstraße 42',
      city: 'Berlin',
      postalCode: '10117',
    },
    createdAt: new Date('2026-03-01T09:00:00Z').toISOString(),
    updatedAt: new Date('2026-03-01T09:00:00Z').toISOString(),
  }

  const sampleDocuments: DocumentItem[] = [
    {
      _id: 'doc-verified-1',
      brokerageId: 'brokerage-1',
      clientId: 'client-1',
      leadId: 'lead-1',
      uploadedBy: 'advisor-1',
      type: 'IDENTIFICATION',
      title: 'EU Passport - Alex Morgan',
      fileKey: 'passport_scan.pdf',
      fileUrl: 'https://vault.leadflow.de/docs/passport_scan.pdf',
      fileSize: 1024 * 512, // 512 KB
      mimeType: 'application/pdf',
      status: 'VERIFIED',
      verifiedAt: new Date('2026-03-02T10:00:00Z').toISOString(),
      createdAt: new Date('2026-03-01T12:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-02T10:00:00Z').toISOString(),
    },
    {
      _id: 'doc-processing-1',
      brokerageId: 'brokerage-1',
      clientId: 'client-1',
      leadId: 'lead-1',
      uploadedBy: 'advisor-1',
      type: 'PAYSLIP',
      title: 'Payslip January 2026',
      fileKey: 'gehalt_jan_2026.pdf',
      fileUrl: 'https://vault.leadflow.de/docs/gehalt_jan_2026.pdf',
      fileSize: 1024 * 250, // 250 KB
      mimeType: 'application/pdf',
      status: 'PROCESSING',
      createdAt: new Date('2026-03-03T08:30:00Z').toISOString(),
      updatedAt: new Date('2026-03-03T08:31:00Z').toISOString(),
    },
    {
      _id: 'doc-pending-1',
      brokerageId: 'brokerage-1',
      clientId: 'client-1',
      leadId: 'lead-1',
      uploadedBy: 'advisor-1',
      type: 'BANK_STATEMENT',
      title: 'Deutsche Bank 3-Month Extract',
      fileKey: 'bank_statement.pdf',
      fileUrl: 'https://vault.leadflow.de/docs/bank_statement.pdf',
      fileSize: 1024 * 1024 * 2, // 2 MB
      mimeType: 'application/pdf',
      status: 'PENDING',
      createdAt: new Date('2026-03-04T15:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-04T15:00:00Z').toISOString(),
    },
    {
      _id: 'doc-rejected-1',
      brokerageId: 'brokerage-1',
      clientId: 'client-1',
      leadId: 'lead-1',
      uploadedBy: 'advisor-1',
      type: 'INCOME_PROOF',
      title: 'Freelance Tax Assessment',
      fileKey: 'tax_assessment_blurry.jpg',
      fileUrl: 'https://vault.leadflow.de/docs/tax_assessment_blurry.jpg',
      fileSize: 1024 * 300,
      mimeType: 'image/jpeg',
      status: 'REJECTED',
      verificationNotes: 'Finanzamt stamp is unreadable due to low resolution. Please upload original PDF.',
      createdAt: new Date('2026-03-05T11:00:00Z').toISOString(),
      updatedAt: new Date('2026-03-05T11:05:00Z').toISOString(),
    },
  ]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
  })

  describe('UploadDocumentModal - Validation and UX', () => {
    it('rejects files exceeding the 10MB limit with an error message', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <UploadDocumentModal
            clientId="client-1"
            isOpen={true}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      )

      // Create an oversized 11MB file
      const bigFile = new File(['a'.repeat(1024)], 'large_document.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })

      const input = document.getElementById('client-doc-file-input') as HTMLInputElement
      expect(input).toBeDefined()

      fireEvent.change(input, { target: { files: [bigFile] } })

      await waitFor(() => {
        expect(
          screen.getByText(/File exceeds the 10MB limit/i)
        ).toBeInTheDocument()
      })
    })

    it('rejects unsupported file formats with clear validation messaging', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <UploadDocumentModal
            clientId="client-1"
            isOpen={true}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      )

      // Create an executable file
      const invalidFile = new File(['binary'], 'virus.exe', {
        type: 'application/x-msdownload',
      })

      const input = document.getElementById('client-doc-file-input') as HTMLInputElement
      fireEvent.change(input, { target: { files: [invalidFile] } })

      await waitFor(() => {
        expect(
          screen.getByText(/Unsupported file format/i)
        ).toBeInTheDocument()
      })
    })

    it('accepts valid PDF files, populates title, and shows preview card with file size', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <UploadDocumentModal
            clientId="client-1"
            isOpen={true}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      )

      const validPdf = new File(['content'], 'Passport_Scan.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(validPdf, 'size', { value: 500 * 1024 }) // 500 KB

      const input = document.getElementById('client-doc-file-input') as HTMLInputElement
      fireEvent.change(input, { target: { files: [validPdf] } })

      await waitFor(() => {
        expect(screen.getByText('Passport_Scan.pdf')).toBeInTheDocument()
        expect(screen.getByText('500 KB')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Passport_Scan')).toBeInTheDocument()
      })
    })

    it('preserves case context, title, and selected file upon upload failure', async () => {
      // Mock failure
      vi.spyOn(ClientsApi.clientsApi, 'uploadClientDocument').mockRejectedValueOnce(
        new Error('Network gateway timeout while contacting storage')
      )

      render(
        <QueryClientProvider client={queryClient}>
          <UploadDocumentModal
            clientId="client-1"
            isOpen={true}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      )

      const file = new File(['data'], 'salary_statement.pdf', {
        type: 'application/pdf',
      })
      const input = document.getElementById('client-doc-file-input') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      // Custom title and notes
      const titleInput = screen.getByPlaceholderText(/e\.g\. Passport/i)
      fireEvent.change(titleInput, { target: { value: 'March 2026 Payslip' } })

      const notesInput = screen.getByPlaceholderText(/Add verification instructions/i)
      fireEvent.change(notesInput, { target: { value: 'Verified with HR department' } })

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /Upload Document/i })
      fireEvent.click(submitBtn)

      // Verify error banner is shown
      await waitFor(() => {
        expect(
          screen.getByText(/Network gateway timeout while contacting storage/i)
        ).toBeInTheDocument()
      })

      // Verify user's entered state is preserved
      expect(screen.getByDisplayValue('March 2026 Payslip')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Verified with HR department')).toBeInTheDocument()
      expect(screen.getByText('salary_statement.pdf')).toBeInTheDocument()
    })

    it('displays success state when document upload succeeds and invokes onSuccess callback', async () => {
      const onSuccessSpy = vi.fn()
      const newDoc: DocumentItem = {
        _id: 'new-doc-123',
        brokerageId: 'brokerage-1',
        clientId: 'client-1',
        type: 'PAYSLIP',
        title: 'Uploaded Document',
        fileKey: 'upload.pdf',
        fileUrl: 'https://vault.leadflow.de/docs/upload.pdf',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.spyOn(ClientsApi.clientsApi, 'uploadClientDocument').mockResolvedValueOnce(newDoc)

      render(
        <QueryClientProvider client={queryClient}>
          <UploadDocumentModal
            clientId="client-1"
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={onSuccessSpy}
          />
        </QueryClientProvider>
      )

      const file = new File(['content'], 'upload.pdf', { type: 'application/pdf' })
      const input = document.getElementById('client-doc-file-input') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      const submitBtn = screen.getByRole('button', { name: /Upload Document/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText(/Document Uploaded & Queued/i)).toBeInTheDocument()
        expect(screen.getByText(/Brokerage tenant isolation verified/i)).toBeInTheDocument()
      })

      expect(onSuccessSpy).toHaveBeenCalledWith(newDoc)
    })
  })

  describe('ClientDetailView - Status Hierarchy & Rejection Presentation', () => {
    beforeEach(() => {
      vi.spyOn(ClientsApi.clientsApi, 'getClientById').mockResolvedValue(sampleClient)
      vi.spyOn(ClientsApi.clientsApi, 'getClientDocuments').mockResolvedValue(sampleDocuments)
      vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue({
        _id: 'lead-1',
        brokerageId: 'brokerage-1',
        firstName: 'Alex',
        lastName: 'Morgan',
        email: 'alex.morgan@example.com',
        source: 'MANUAL',
        status: 'WON',
        score: 85,
        customFields: {
          loanAmount: 450000,
          propertyValue: 550000,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Lead)
    })

    it('renders all 4 processing states (VERIFIED, PROCESSING, PENDING, REJECTED) with correct badges and counts', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ClientDetailView clientId="client-1" />
          </MemoryRouter>
        </QueryClientProvider>
      )

      // Wait for client and documents queries to resolve
      await waitFor(() => {
        expect(screen.getByText('All (4)')).toBeInTheDocument()
      })

      // Check status tabs with live counts
      expect(screen.getByText('Verified (1)')).toBeInTheDocument()
      expect(screen.getByText('Processing (1)')).toBeInTheDocument()
      expect(screen.getByText('Pending (1)')).toBeInTheDocument()
      expect(screen.getByText('Rejected (1)')).toBeInTheDocument()

      // Check document titles
      expect(screen.getByText('EU Passport - Alex Morgan')).toBeInTheDocument()
      expect(screen.getByText('Payslip January 2026')).toBeInTheDocument()
      expect(screen.getByText('Deutsche Bank 3-Month Extract')).toBeInTheDocument()
      expect(screen.getByText('Freelance Tax Assessment')).toBeInTheDocument()

      // Check distinct badges
      expect(screen.getByText('VERIFIED')).toBeInTheDocument()
      expect(screen.getByText('PROCESSING (BULLMQ)')).toBeInTheDocument()
      expect(screen.getByText('PENDING')).toBeInTheDocument()
      expect(screen.getByText('REJECTED')).toBeInTheDocument()

      // Check prominent rejection note callout
      expect(screen.getByText('Inspection Rejection Issue:')).toBeInTheDocument()
      expect(
        screen.getByText(/Finanzamt stamp is unreadable due to low resolution/i)
      ).toBeInTheDocument()
    })

    it('filters documents when status tabs are clicked', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ClientDetailView clientId="client-1" />
          </MemoryRouter>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Rejected (1)')).toBeInTheDocument()
      })

      // Click "Rejected" tab
      const rejectedTab = screen.getByText('Rejected (1)')
      fireEvent.click(rejectedTab)

      // Only the rejected document should be displayed
      expect(screen.getByText('Freelance Tax Assessment')).toBeInTheDocument()
      expect(screen.queryByText('EU Passport - Alex Morgan')).not.toBeInTheDocument()
      expect(screen.queryByText('Payslip January 2026')).not.toBeInTheDocument()
    })

    it('handles clipboard copy for secure file link', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ClientDetailView clientId="client-1" />
          </MemoryRouter>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('EU Passport - Alex Morgan')).toBeInTheDocument()
      })

      const copyButtons = screen.getAllByRole('button', { name: /Copy Link/i })
      expect(copyButtons.length).toBeGreaterThan(0)

      fireEvent.click(copyButtons[0])

      expect(writeTextMock).toHaveBeenCalledWith(
        'https://vault.leadflow.de/docs/passport_scan.pdf'
      )
    })
  })

  describe('Real-time Socket Invalidation and DocumentsPage', () => {
    it('invalidates document query cache upon receiving document:status_changed socket event', async () => {
      let registeredHandler: ((data: unknown) => void) | undefined
      vi.spyOn(SocketLib, 'useSocketEvent').mockImplementation((event, handler) => {
        if (event === 'document:status_changed') {
          registeredHandler = handler as (data: unknown) => void
        }
      })

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ClientDetailView clientId="client-1" />
          </MemoryRouter>
        </QueryClientProvider>
      )

      expect(registeredHandler).toBeDefined()

      // Simulate incoming BullMQ worker status change event
      registeredHandler?.({
        documentId: 'doc-processing-1',
        brokerageId: 'brokerage-1',
        clientId: 'client-1',
        previousStatus: 'PROCESSING',
        newStatus: 'VERIFIED',
        type: 'PAYSLIP',
        title: 'Payslip January 2026',
        updatedAt: new Date().toISOString(),
      })

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: DocumentsApi.DOCUMENTS_QUERY_KEY,
      })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ClientsApi.CLIENT_DOCUMENTS_KEY('client-1'),
      })
    })

    it('renders DocumentsPage with KPI counts and allows searching', async () => {
      vi.spyOn(DocumentsApi.documentsApi, 'listDocuments').mockResolvedValue(sampleDocuments)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DocumentsPage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Document Verification')).toBeInTheDocument()
      })

      // KPI cards
      expect(screen.getByText('Total Files')).toBeInTheDocument()
      expect(screen.getByText('Audit approved')).toBeInTheDocument()
      expect(screen.getByText('In BullMQ worker')).toBeInTheDocument()
      expect(screen.getByText('Requires correction')).toBeInTheDocument()

      // Search filtering
      const searchInput = screen.getByPlaceholderText(/Search by document title/i)
      fireEvent.change(searchInput, { target: { value: 'Passport' } })

      expect(screen.getByText('EU Passport - Alex Morgan')).toBeInTheDocument()
      expect(screen.queryByText('Freelance Tax Assessment')).not.toBeInTheDocument()
    })
  })
})
