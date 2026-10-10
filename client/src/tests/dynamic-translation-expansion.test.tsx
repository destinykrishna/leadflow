import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TextTranslate, isEligibleDocumentText } from '@/features/leads/components/LeadNoteTranslate'
import { TaskDetailModal } from '@/features/tasks/components/TaskDetailModal'
import { DocumentsPage } from '@/features/documents/DocumentsPage'
import { api } from '@/lib/api'
import * as AuthHook from '@/hooks/useAuth'
import type { Task } from '@/types/task.types'
import type { DocumentItem } from '@/types/document.types'

describe('LeadFlow Dynamic Free-Text Translation Expansion', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Document Note Eligibility Filtering (System vs Human Text)', () => {
    it('returns false for routine system-generated OCR pre-check messages', () => {
      const routineOcrNote =
        'Automated technical pre-checks passed. Classified as PAYSLIP (confidence: 98%). Awaiting human verification.'
      expect(isEligibleDocumentText(routineOcrNote)).toBe(false)
      expect(isEligibleDocumentText(`Note: ${routineOcrNote}`)).toBe(false)
    })

    it('returns false for routine system-generated automated verification checks', () => {
      const routinePassedNote = 'Automated verification check passed successfully.'
      expect(isEligibleDocumentText(routinePassedNote)).toBe(false)

      const routineFailedNote = 'Automated verification check failed: Unreadable document scan.'
      expect(isEligibleDocumentText(routineFailedNote)).toBe(false)
    })

    it('returns false when document metadata indicates system generation', () => {
      expect(
        isEligibleDocumentText('System processed OCR document', {
          metadata: { isAutomated: true },
        })
      ).toBe(false)

      expect(
        isEligibleDocumentText('Classification result: PAYSLIP', {
          metadata: { source: 'SYSTEM' },
        })
      ).toBe(false)
    })

    it('returns false for empty, null, or whitespace notes', () => {
      expect(isEligibleDocumentText('')).toBe(false)
      expect(isEligibleDocumentText('   ')).toBe(false)
      expect(isEligibleDocumentText(null)).toBe(false)
      expect(isEligibleDocumentText(undefined)).toBe(false)
    })

    it('returns true for human advisor rejection reasons', () => {
      const rejectionReason = 'Salary slips are password-protected; please upload unencrypted PDF.'
      expect(
        isEligibleDocumentText(rejectionReason, {
          rejectionReason,
          status: 'REJECTED',
        })
      ).toBe(true)

      const stampMissingReason = 'Finanzamt stamp is unreadable due to low resolution. Please upload original PDF.'
      expect(isEligibleDocumentText(stampMissingReason)).toBe(true)
    })

    it('returns true for human verification notes entered during review', () => {
      const humanNote = 'Cross-verified with HDFC bank statement credits on page 4.'
      expect(
        isEligibleDocumentText(humanNote, {
          verifiedBy: 'adv-123',
        })
      ).toBe(true)
    })
  })

  describe('2. Subtle Inline Link Presentation (variant="link")', () => {
    it('renders subtle "Translate to German" link instead of bulky toolbar dropdown', () => {
      render(
        <TextTranslate
          text="Salary slip missing company seal or signature"
          context="document_note"
          label="Rejection Note"
          variant="link"
          testIdPrefix="link-test-"
        />
      )

      // The button text is literally "Translate to German"
      const linkBtn = screen.getByTestId('link-test-translate-button')
      expect(linkBtn).toBeInTheDocument()
      expect(linkBtn).toHaveTextContent(/Translate to German/i)
      // Switch target button is available
      expect(screen.getByTestId('link-test-target-lang-select')).toHaveTextContent('(to EN)')
      // Bulky select element is not rendered
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('toggles target language between German and English via subtle switch', () => {
      render(
        <TextTranslate
          text="Gehaltsabrechnung fehlt Stempel oder Unterschrift"
          context="document_note"
          label="Rejection Note"
          variant="link"
          testIdPrefix="link-toggle-"
        />
      )

      const toggleBtn = screen.getByTestId('link-toggle-target-lang-select')
      const linkBtn = screen.getByTestId('link-toggle-translate-button')
      expect(linkBtn).toHaveTextContent(/Translate to German/i)

      fireEvent.click(toggleBtn)
      expect(linkBtn).toHaveTextContent(/Translate to English/i)
      expect(toggleBtn).toHaveTextContent('(to DE)')
    })

    it('translates inline and shows result without modifying original text', async () => {
      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            translatedText: 'Gehaltsabrechnung fehlt Firmenstempel oder Unterschrift.',
            targetLang: 'de',
            isAiTranslated: true,
            cached: false,
            fallback: false,
          },
        },
      })

      render(
        <div>
          <span data-testid="doc-original">Salary slip missing company seal or signature</span>
          <TextTranslate
            text="Salary slip missing company seal or signature"
            context="document_note"
            label="Rejection Note"
            variant="link"
            testIdPrefix="link-run-"
          />
        </div>
      )

      fireEvent.click(screen.getByTestId('link-run-translate-button'))

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/translate', {
          text: 'Salary slip missing company seal or signature',
          targetLang: 'de',
          context: 'document_note',
        })
      })

      // Original text remains preserved
      expect(screen.getByTestId('doc-original')).toHaveTextContent(
        'Salary slip missing company seal or signature'
      )

      // Translated result rendered inline below
      await waitFor(() => {
        expect(screen.getByTestId('link-run-translated-note-box')).toBeInTheDocument()
      })
      expect(screen.getByText('Gehaltsabrechnung fehlt Firmenstempel oder Unterschrift.')).toBeInTheDocument()
      expect(screen.getByText('AI')).toBeInTheDocument()
    })
  })

  describe('3. DocumentsPage Clean Presentation (Hiding Automated Notes)', () => {
    const mockDocuments: DocumentItem[] = [
      {
        _id: 'doc-auto-1',
        brokerageId: 'brokerage-1',
        title: 'leadflow_ocr_test_salary_slip',
        type: 'PAYSLIP',
        status: 'PENDING_REVIEW',
        verificationNotes:
          'Automated technical pre-checks passed. Classified as PAYSLIP (confidence: 98%). Awaiting human verification.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'doc-auto-2',
        brokerageId: 'brokerage-1',
        title: 'QA Verification Payslip',
        type: 'PAYSLIP',
        status: 'VERIFIED',
        verificationNotes: 'Automated verification check passed successfully.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'doc-human-3',
        brokerageId: 'brokerage-1',
        title: 'October 2026 Salary Slip',
        type: 'PAYSLIP',
        status: 'REJECTED',
        rejectionReason: 'Salary slips are password-protected; please upload unencrypted PDF.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    it('hides translation links on automated system notes and displays only on eligible human rejection notes', async () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue({
        user: {
          id: 'user-1',
          email: 'advisor@leadflow.de',
          name: 'Advisor Elena',
          role: 'ADVISOR',
          status: 'ACTIVE',
          brokerageId: 'brokerage-1',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      })

      vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          success: true,
          data: {
            documents: mockDocuments,
            pagination: { total: 3, page: 1, limit: 50, pages: 1 },
          },
        },
      })

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DocumentsPage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('leadflow_ocr_test_salary_slip')).toBeInTheDocument()
      })

      // Automated pre-check note: translation action MUST NOT exist
      expect(screen.queryByTestId('docs-page-doc-auto-1-note-translate-button')).not.toBeInTheDocument()

      // Automated verified check note: translation action MUST NOT exist
      expect(screen.queryByTestId('docs-page-doc-auto-2-note-translate-button')).not.toBeInTheDocument()

      // Human rejection note on rejected document: translation action MUST exist as subtle link
      const humanRejectBtn = screen.getByTestId('docs-page-doc-human-3-rejection-translate-button')
      expect(humanRejectBtn).toBeInTheDocument()
      expect(humanRejectBtn).toHaveTextContent(/Translate to German/i)
    })
  })

  describe('4. Task Detail Modal Integration', () => {
    const mockTask: Task = {
      _id: 'task-101',
      brokerageId: 'brokerage-1',
      title: 'Review Expat Tax Clearance',
      description: 'Borrower uploaded 2025 Finanzamt tax clearance certificate with handwritten annotations.',
      status: 'PENDING',
      priority: 'HIGH',
      leadId: {
        _id: 'lead-1',
        firstName: 'Arjun',
        lastName: 'Mehta',
        status: 'QUALIFIED',
      },
      assignedTo: {
        _id: 'user-1',
        name: 'Sarah Connor',
        email: 'sarah@leadflow.de',
      },
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    it('renders translation toolbar for task description and translates without altering original task description', async () => {
      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            translatedText: 'Kreditnehmer hat die Unbedenklichkeitsbescheinigung des Finanzamts 2025 mit handschriftlichen Anmerkungen hochgeladen.',
            targetLang: 'de',
            isAiTranslated: true,
            cached: false,
            fallback: false,
          },
        },
      })

      vi.spyOn(AuthHook, 'useAuth').mockReturnValue({
        user: {
          id: 'user-1',
          email: 'sarah@leadflow.de',
          name: 'Sarah Connor',
          role: 'ADVISOR',
          status: 'ACTIVE',
          brokerageId: 'brokerage-1',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      })

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>
      )

      // Original task description is visible
      expect(
        screen.getByText('Borrower uploaded 2025 Finanzamt tax clearance certificate with handwritten annotations.')
      ).toBeInTheDocument()

      const taskTranslateBtn = screen.getByTestId('task-translate-button')
      expect(taskTranslateBtn).toBeInTheDocument()

      fireEvent.click(taskTranslateBtn)

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/translate', {
          text: 'Borrower uploaded 2025 Finanzamt tax clearance certificate with handwritten annotations.',
          targetLang: 'de',
          context: 'task_description',
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('task-translated-note-box')).toBeInTheDocument()
      })
      expect(
        screen.getByText(
          'Kreditnehmer hat die Unbedenklichkeitsbescheinigung des Finanzamts 2025 mit handschriftlichen Anmerkungen hochgeladen.'
        )
      ).toBeInTheDocument()

      expect(
        screen.getByText('Borrower uploaded 2025 Finanzamt tax clearance certificate with handwritten annotations.')
      ).toBeInTheDocument()
    })
  })
})
