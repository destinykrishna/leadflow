import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api } from '@/lib/api'
import { LeadNoteTranslate } from '@/features/leads/components/LeadNoteTranslate'
import { translateText } from '@/features/translation/api/translation.api'
import { LeadDetailView } from '@/features/leads/components/LeadDetailView'
import * as AuthHook from '@/hooks/useAuth'
import * as LeadsApi from '@/features/leads/api/leads.api'
import type { Lead } from '@/types/pipeline.types'

describe('LeadFlow Lead Notes Translation UI & Contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Success State & Non-Overwriting Note Preservation', () => {
    it('successfully translates lead note to German without modifying the original note', async () => {
      const originalNote = 'Borrower is an expat software engineer in Berlin requesting 80% LTV financing.'
      const translatedText = 'Kreditnehmer ist ein Expat-Softwareingenieur in Berlin, der eine 80% Finanzierung anfragt.'

      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            translatedText,
            targetLang: 'de',
            isAiTranslated: true,
            cached: false,
            fallback: false,
          },
        },
      })

      render(
        <div>
          <p data-testid="original-note">{originalNote}</p>
          <LeadNoteTranslate notes={originalNote} />
        </div>
      )

      // Verify original note is rendered
      expect(screen.getByTestId('original-note')).toHaveTextContent(originalNote)

      // Trigger translate
      const translateBtn = screen.getByRole('button', { name: /Translate/i })
      expect(translateBtn).not.toBeDisabled()
      fireEvent.click(translateBtn)

      // Wait for translation to appear
      await waitFor(() => {
        expect(screen.getByTestId('translated-note-box')).toBeInTheDocument()
      })

      // Verify translated text and metadata
      expect(screen.getByTestId('translated-note-box')).toHaveTextContent(translatedText)
      expect(screen.getByText(/Translated Note \(German\)/i)).toBeInTheDocument()
      expect(screen.getByText('AI')).toBeInTheDocument()

      // CRITICAL: Verify original note is completely preserved and NOT overwritten
      expect(screen.getByTestId('original-note')).toHaveTextContent(originalNote)

      // Verify endpoint payload contract
      expect(postSpy).toHaveBeenCalledTimes(1)
      expect(postSpy).toHaveBeenCalledWith('/translate', {
        text: originalNote,
        targetLang: 'de',
        context: 'lead_note',
      })
    })

    it('allows dismissing the translated box while preserving the original note', async () => {
      const originalNote = 'Pre-approved loan inquiry for property in Munich.'
      vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            translatedText: 'Vorab genehmigte Kreditanfrage für Immobilie in München.',
            targetLang: 'de',
            isAiTranslated: true,
            cached: true,
            fallback: false,
          },
        },
      })

      render(
        <div>
          <p data-testid="original-note">{originalNote}</p>
          <LeadNoteTranslate notes={originalNote} />
        </div>
      )

      fireEvent.click(screen.getByRole('button', { name: /Translate/i }))

      await waitFor(() => {
        expect(screen.getByTestId('translated-note-box')).toBeInTheDocument()
      })

      // Dismiss the translation
      const dismissBtn = screen.getByLabelText(/Dismiss translation/i)
      fireEvent.click(dismissBtn)

      // Box disappears, original note remains
      expect(screen.queryByTestId('translated-note-box')).not.toBeInTheDocument()
      expect(screen.getByTestId('original-note')).toHaveTextContent(originalNote)
    })
  })

  describe('2. Language Selection (English / German)', () => {
    it('supports translating to English when English target language is selected', async () => {
      const originalNote = 'Kunde möchte Zinsbindung für 10 Jahre festschreiben.'
      const translatedEnglish = 'Client wants to lock in interest rate for 10 years fixed.'

      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            translatedText: translatedEnglish,
            targetLang: 'en',
            isAiTranslated: true,
            cached: false,
            fallback: false,
          },
        },
      })

      render(<LeadNoteTranslate notes={originalNote} />)

      // Select English from target language selector
      const langSelect = screen.getByLabelText(/Target language/i)
      fireEvent.change(langSelect, { target: { value: 'en' } })
      expect(langSelect).toHaveValue('en')

      // Click translate
      fireEvent.click(screen.getByRole('button', { name: /Translate/i }))

      await waitFor(() => {
        expect(screen.getByTestId('translated-note-box')).toBeInTheDocument()
      })

      expect(screen.getByText(/Translated Note \(English\)/i)).toBeInTheDocument()
      expect(screen.getByText(translatedEnglish)).toBeInTheDocument()

      expect(postSpy).toHaveBeenCalledWith('/translate', {
        text: originalNote,
        targetLang: 'en',
        context: 'lead_note',
      })
    })

    it('supports switching between languages and updating translation target', async () => {
      const originalNote = 'General lead inquiry observation.'
      const postSpy = vi.spyOn(api, 'post')
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              translatedText: 'Allgemeine Interessentenbeobachtung.',
              targetLang: 'de',
              isAiTranslated: false,
              cached: true,
              fallback: true,
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              translatedText: 'General lead inquiry observation.',
              targetLang: 'en',
              isAiTranslated: false,
              cached: true,
              fallback: true,
            },
          },
        })

      render(<LeadNoteTranslate notes={originalNote} />)

      const langSelect = screen.getByLabelText(/Target language/i)

      // 1. Translate to German
      fireEvent.change(langSelect, { target: { value: 'de' } })
      fireEvent.click(screen.getByRole('button', { name: /Translate/i }))

      await waitFor(() => {
        expect(screen.getByText(/Allgemeine Interessentenbeobachtung/i)).toBeInTheDocument()
      })

      // 2. Switch to English and translate again
      fireEvent.change(langSelect, { target: { value: 'en' } })
      fireEvent.click(screen.getByRole('button', { name: /Translate/i }))

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledTimes(2)
      })

      expect(postSpy).toHaveBeenNthCalledWith(1, '/translate', expect.objectContaining({ targetLang: 'de' }))
      expect(postSpy).toHaveBeenNthCalledWith(2, '/translate', expect.objectContaining({ targetLang: 'en' }))
    })
  })

  describe('3. Loading State & Duplicate Request Prevention', () => {
    it('shows loading spinner, changes button text to Translating…, and disables the button while in-flight', async () => {
      let resolvePost: (value: unknown) => void = () => {}
      const postPromise = new Promise((resolve) => {
        resolvePost = resolve
      })

      vi.spyOn(api, 'post').mockReturnValueOnce(postPromise as never)

      render(<LeadNoteTranslate notes="Active application in progress." />)

      const translateBtn = screen.getByRole('button', { name: /Translate/i })
      fireEvent.click(translateBtn)

      // Verify loading state
      expect(screen.getByTestId('translate-spinner')).toBeInTheDocument()
      expect(screen.getByText(/Translating…/i)).toBeInTheDocument()
      expect(translateBtn).toBeDisabled()

      // Resolve pending request
      await act(async () => {
        resolvePost({
          data: {
            success: true,
            data: {
              translatedText: 'Laufender Antrag in Bearbeitung.',
              targetLang: 'de',
              isAiTranslated: true,
              cached: false,
              fallback: false,
            },
          },
        })
      })

      await waitFor(() => {
        expect(screen.queryByTestId('translate-spinner')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Translate/i })).toBeInTheDocument()
      })
    })

    it('prevents duplicate concurrent requests on rapid double-clicking', async () => {
      let resolvePost: (value: unknown) => void = () => {}
      const postPromise = new Promise((resolve) => {
        resolvePost = resolve
      })

      const postSpy = vi.spyOn(api, 'post').mockReturnValueOnce(postPromise as never)

      render(<LeadNoteTranslate notes="Single dispatch note test." />)

      const translateBtn = screen.getByRole('button', { name: /Translate/i })

      // Double-click rapidly
      fireEvent.click(translateBtn)
      fireEvent.click(translateBtn)
      fireEvent.click(translateBtn)

      // Only a single API call must be made
      expect(postSpy).toHaveBeenCalledTimes(1)

      // Clean up unresolved promise
      await act(async () => {
        resolvePost({
          data: {
            success: true,
            data: {
              translatedText: 'Übersetzung',
              targetLang: 'de',
              isAiTranslated: false,
              cached: false,
              fallback: false,
            },
          },
        })
      })
    })
  })

  describe('4. Error Handling & Resilience', () => {
    it('displays error notice on server failure without modifying the original note', async () => {
      const originalNote = 'Note before server failure.'
      vi.spyOn(api, 'post').mockRejectedValueOnce({
        response: {
          data: {
            error: {
              message: 'AI translation service temporarily unavailable. Rate limit reached.',
            },
          },
        },
      })

      render(
        <div>
          <p data-testid="original-note">{originalNote}</p>
          <LeadNoteTranslate notes={originalNote} />
        </div>
      )

      fireEvent.click(screen.getByRole('button', { name: /Translate/i }))

      await waitFor(() => {
        expect(screen.getByTestId('translate-error')).toBeInTheDocument()
      })

      // Error message rendered
      expect(screen.getByText(/AI translation service temporarily unavailable/i)).toBeInTheDocument()

      // Original note remains completely intact
      expect(screen.getByTestId('original-note')).toHaveTextContent(originalNote)
    })

    it('allows dismissing error alert notice', async () => {
      vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Network timeout connecting to server'))

      render(<LeadNoteTranslate notes="Some note." />)

      fireEvent.click(screen.getByRole('button', { name: /Translate/i }))

      await waitFor(() => {
        expect(screen.getByTestId('translate-error')).toBeInTheDocument()
      })

      const dismissErrorBtn = screen.getByLabelText(/Dismiss error/i)
      fireEvent.click(dismissErrorBtn)

      expect(screen.queryByTestId('translate-error')).not.toBeInTheDocument()
    })
  })

  describe('5. Empty Input Handling', () => {
    it('disables translate button when note is undefined', () => {
      render(<LeadNoteTranslate notes={undefined} />)
      const translateBtn = screen.getByRole('button', { name: /Translate/i })
      expect(translateBtn).toBeDisabled()
    })

    it('disables translate button when note is empty string or only whitespace', () => {
      const { rerender } = render(<LeadNoteTranslate notes="" />)
      expect(screen.getByRole('button', { name: /Translate/i })).toBeDisabled()

      rerender(<LeadNoteTranslate notes="   " />)
      expect(screen.getByRole('button', { name: /Translate/i })).toBeDisabled()
    })

    it('does not invoke API when note text is empty', () => {
      const postSpy = vi.spyOn(api, 'post')
      render(<LeadNoteTranslate notes="" />)

      const translateBtn = screen.getByRole('button', { name: /Translate/i })
      fireEvent.click(translateBtn)

      expect(postSpy).not.toHaveBeenCalled()
    })
  })

  describe('6. translateText API client function', () => {
    it('calls POST /api/translate with existing authenticated client and returns translation result', async () => {
      const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            translatedText: 'Geprüfter Antrag',
            targetLang: 'de',
            isAiTranslated: true,
            cached: false,
            fallback: false,
          },
        },
      })

      const res = await translateText({
        text: 'Verified application',
        targetLang: 'de',
        context: 'lead_note',
      })

      expect(postSpy).toHaveBeenCalledWith('/translate', {
        text: 'Verified application',
        targetLang: 'de',
        context: 'lead_note',
      })
      expect(res.translatedText).toBe('Geprüfter Antrag')
      expect(res.targetLang).toBe('de')
    })
  })

  describe('7. LeadDetailView Integration', () => {
    it('renders the translate control within LeadDetailView when lead has notes', async () => {
      const leadWithNotes: Lead = {
        _id: 'lead-test-1',
        brokerageId: 'brokerage-1',
        firstName: 'Stefan',
        lastName: 'Zweig',
        email: 'stefan@example.de',
        status: 'NEW',
        source: 'WEBSITE',
        score: 80,
        notes: 'Borrower requested follow-up next Tuesday regarding fixed rates.',
        customFields: {},
        __v: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.spyOn(AuthHook, 'useAuth').mockReturnValue({
        user: {
          id: 'adv-1',
          email: 'advisor@leadflow.de',
          name: 'Advisor',
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
      vi.spyOn(LeadsApi.leadsApi, 'getLeadById').mockResolvedValue(leadWithNotes)
      vi.spyOn(LeadsApi.leadsApi, 'getLeadTasks').mockResolvedValue([])
      vi.spyOn(LeadsApi.leadsApi, 'getLeadDocuments').mockResolvedValue([])
      vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [] } })

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LeadDetailView leadId="lead-test-1" initialLead={leadWithNotes} />
          </MemoryRouter>
        </QueryClientProvider>
      )

      expect(screen.getByText('Advisor Inquiry Notes')).toBeInTheDocument()
      expect(screen.getByText('Borrower requested follow-up next Tuesday regarding fixed rates.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Translate/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/Target language/i)).toBeInTheDocument()
    })
  })
})
