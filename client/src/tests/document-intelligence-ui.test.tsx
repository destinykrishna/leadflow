import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DocumentItem } from '@/types/document.types'
import { ReviewDocumentModal } from '@/features/documents/components/ReviewDocumentModal'
import { DocumentIntelligencePanel } from '@/features/documents/components/DocumentIntelligencePanel'

describe('AI-3: Advisor Document Intelligence Review UI', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const mockSalarySlipDoc: DocumentItem = {
    _id: 'doc-123',
    brokerageId: 'brokerage-1',
    title: 'Salary_Slip_September_2026.png',
    type: 'PAYSLIP',
    status: 'PENDING_REVIEW',
    mimeType: 'image/png',
    fileSize: 102400,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractedData: {
      classification: {
        status: 'RECOGNIZED',
        detectedType: 'PAYSLIP',
        confidence: 0.95,
        matchedKeywords: ['PAYSLIP', 'GROSS EARNINGS', 'NET PAY'],
      },
      fields: {
        borrowerName: { value: 'Rahul Sharma', confidence: 0.90 },
        pan: { value: 'ABCDE1234F', confidence: 0.95 },
        employerName: { value: 'ABC Technologies Pvt. Ltd.', confidence: 0.90 },
        grossIncome: { value: 85000, confidence: 0.90 },
        netIncome: { value: 71200, confidence: 0.90 },
        currency: { value: 'INR', confidence: 0.95 },
        documentPeriod: { value: 'September 2026', confidence: 0.85 },
        employeeId: { value: 'LF-1024', confidence: 0.90 },
      },
      extractedAt: new Date().toISOString(),
      modelVersion: 'rule-engine-1.0',
    },
  }

  it('renders recognized document intelligence with high confidence and extracted entities', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DocumentIntelligencePanel document={mockSalarySlipDoc} />
      </QueryClientProvider>
    )

    // Heading and detected type
    expect(screen.getByText('Automated Pre-Check Analysis')).toBeDefined()
    expect(screen.getByText('PAYSLIP')).toBeDefined()
    expect(screen.getAllByText('95% High').length).toBeGreaterThanOrEqual(1)

    // Advisory warning
    expect(
      screen.getByText(/Field values below are automated suggestions/i)
    ).toBeDefined()

    // Extracted entities
    expect(screen.getByText('Rahul Sharma')).toBeDefined()
    expect(screen.getByText('ABCDE1234F')).toBeDefined()
    expect(screen.getByText('ABC Technologies Pvt. Ltd.')).toBeDefined()
    expect(screen.getByText('₹ 85,000')).toBeDefined()
    expect(screen.getByText('₹ 71,200')).toBeDefined()
    expect(screen.getByText('September 2026')).toBeDefined()
    expect(screen.getByText('LF-1024')).toBeDefined()

    // "View Original File" button
    expect(screen.getByRole('button', { name: /View Original File/i })).toBeDefined()
  })

  it('handles UNKNOWN classification status gracefully with manual review advisory', () => {
    const unknownDoc: DocumentItem = {
      ...mockSalarySlipDoc,
      title: 'Commercial_Agreement.png',
      extractedData: {
        classification: {
          status: 'UNKNOWN',
          detectedType: null,
          confidence: 0,
          matchedKeywords: [],
        },
        fields: {},
        extractedAt: new Date().toISOString(),
        modelVersion: 'rule-engine-1.0',
      },
    }

    render(
      <QueryClientProvider client={queryClient}>
        <DocumentIntelligencePanel document={unknownDoc} />
      </QueryClientProvider>
    )

    expect(screen.getByText('Unrecognized Document Category')).toBeDefined()
    expect(
      screen.getByText(/could not be confidently matched to a standard Salary Slip/i)
    ).toBeDefined()
    expect(screen.getByRole('button', { name: /View Original File/i })).toBeDefined()
  })

  it('handles documents without extractedData (e.g. PDFs) cleanly without crashing', () => {
    const pdfDoc: DocumentItem = {
      ...mockSalarySlipDoc,
      mimeType: 'application/pdf',
      title: 'Tax_Assessment.pdf',
      extractedData: null,
    }

    render(
      <QueryClientProvider client={queryClient}>
        <DocumentIntelligencePanel document={pdfDoc} />
      </QueryClientProvider>
    )

    expect(screen.getByText('Standard PDF Document')).toBeDefined()
    expect(
      screen.getByText(/Automated optical pre-checks are optimized for scanned images/i)
    ).toBeDefined()
    expect(screen.getByRole('button', { name: /View Original File/i })).toBeDefined()
  })

  it('embeds DocumentIntelligencePanel in ReviewDocumentModal preserving approval workflow', () => {
    const handleClose = vi.fn()
    const handleSuccess = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <ReviewDocumentModal
          document={mockSalarySlipDoc}
          isOpen={true}
          action="APPROVE"
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      </QueryClientProvider>
    )

    // Modal header
    expect(screen.getByRole('heading', { name: 'Approve Document' })).toBeDefined()

    // Intelligence panel embedded
    expect(screen.getByText('Automated Pre-Check Analysis')).toBeDefined()
    expect(screen.getByText('Rahul Sharma')).toBeDefined()
    expect(screen.getByText('ABCDE1234F')).toBeDefined()

    // Action button
    const approveBtn = screen.getByRole('button', { name: /Confirm Approval/i })
    expect(approveBtn).toBeDefined()
  })

  it('enforces rejection reason in ReviewDocumentModal when rejecting', async () => {
    const handleClose = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <ReviewDocumentModal
          document={mockSalarySlipDoc}
          isOpen={true}
          action="REJECT"
          onClose={handleClose}
        />
      </QueryClientProvider>
    )

    expect(screen.getByRole('heading', { name: 'Reject Document' })).toBeDefined()
    expect(screen.getByText(/Quick Rejection Reasons/i)).toBeDefined()

    // Select quick rejection reason
    const quickReason = screen.getByRole('button', { name: 'Illegible or blurry scan' })
    fireEvent.click(quickReason)

    const input = screen.getByPlaceholderText(/Salary slips are password-protected/i) as HTMLInputElement
    expect(input.value).toBe('Illegible or blurry scan')
  })

  // AI-4 Cross-Document Review Signals UI Tests
  describe('AI-4: Cross-Document Review Signals Display', () => {
    it('displays "No cross-document inconsistencies detected" when reviewSignals is empty', () => {
      const cleanDoc: DocumentItem = {
        ...mockSalarySlipDoc,
        extractedData: {
          ...mockSalarySlipDoc.extractedData!,
          reviewSignals: [],
        },
      }

      render(
        <QueryClientProvider client={queryClient}>
          <DocumentIntelligencePanel document={cleanDoc} />
        </QueryClientProvider>
      )

      expect(screen.getByText('Cross-Document Review Signals')).toBeDefined()
      expect(
        screen.getByText('No cross-document inconsistencies detected')
      ).toBeDefined()
    })

    it('renders neutral advisory review signals when inconsistencies are detected', () => {
      const flaggedDoc: DocumentItem = {
        ...mockSalarySlipDoc,
        extractedData: {
          ...mockSalarySlipDoc.extractedData!,
          reviewSignals: [
            {
              id: 'sig_1',
              type: 'IDENTITY_MISMATCH',
              severity: 'WARNING',
              message: 'Identity information differs across documents',
              details: 'Borrower name on this document differs from PAN Card.',
              field: 'borrowerName',
              relatedDocumentIds: ['doc-999'],
              relatedDocumentTitles: ['PAN Card'],
            },
            {
              id: 'sig_2',
              type: 'INCOME_INCONSISTENCY',
              severity: 'WARNING',
              message: 'Income figures may require review',
              details: 'Extracted annual income figures differ significantly between Salary Slip and Tax Return.',
              field: 'grossIncome',
              relatedDocumentIds: ['doc-888'],
              relatedDocumentTitles: ['ITR Assessment'],
            },
          ],
        },
      }

      render(
        <QueryClientProvider client={queryClient}>
          <DocumentIntelligencePanel document={flaggedDoc} />
        </QueryClientProvider>
      )

      expect(screen.getByText('2 signals')).toBeDefined()
      expect(
        screen.getByText('Identity information differs across documents')
      ).toBeDefined()
      expect(screen.getByText('Income figures may require review')).toBeDefined()
      expect(
        screen.getByText('Borrower name on this document differs from PAN Card.')
      ).toBeDefined()
      expect(screen.getByText('PAN Card')).toBeDefined()
      expect(screen.getByText('ITR Assessment')).toBeDefined()
    })
  })
})
