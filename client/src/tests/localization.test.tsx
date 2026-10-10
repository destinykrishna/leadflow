import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n, { LANGUAGE_STORAGE_KEY, setAppLanguage, getStoredLanguage } from '@/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { formatCurrency, formatDate } from '@/lib/format'
import { sanitizeIndianMortgageText, formatBrokerageName } from '@/lib/presentation'

describe('LeadFlow Frontend Localization (English / German)', () => {
  beforeEach(async () => {
    localStorage.clear()
    await setAppLanguage('en')
  })

  afterEach(async () => {
    await setAppLanguage('en')
    localStorage.clear()
  })

  describe('1. Localization Foundation & Persistence', () => {
    it('initializes with English as the default language', () => {
      expect(i18n.language).toBe('en')
      expect(document.documentElement.lang).toBe('en')
      expect(i18n.t('common.confirm')).toBe('Confirm')
      expect(i18n.t('nav.pipeline')).toBe('Pipeline')
    })

    it('switches to German and persists in localStorage under leadflow_language', async () => {
      await setAppLanguage('de')

      expect(i18n.language).toBe('de')
      expect(document.documentElement.lang).toBe('de')
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de')
      expect(getStoredLanguage()).toBe('de')

      // Key UI translations in German
      expect(i18n.t('common.confirm')).toBe('Bestätigen')
      expect(i18n.t('nav.pipeline')).toBe('Pipeline')
      expect(i18n.t('nav.leads')).toBe('Interessenten')
      expect(i18n.t('nav.clients')).toBe('Kunden')
      expect(i18n.t('nav.documents')).toBe('Dokumente')
      expect(i18n.t('nav.tasks')).toBe('Aufgaben')
      expect(i18n.t('auth.signInTitle')).toBe('Anmelden')
    })

    it('synchronizes HTML lang attribute when language toggles back and forth', async () => {
      await setAppLanguage('de')
      expect(document.documentElement.lang).toBe('de')

      await setAppLanguage('en')
      expect(document.documentElement.lang).toBe('en')
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
    })

    it('dispatches custom event on language change for non-react subscribers', async () => {
      const listener = vi.fn()
      window.addEventListener('leadflow_language_changed', listener)

      await setAppLanguage('de')

      expect(listener).toHaveBeenCalled()
      const event = listener.mock.calls[0][0] as CustomEvent
      expect(event.detail.language).toBe('de')

      window.removeEventListener('leadflow_language_changed', listener)
    })
  })

  describe('2. LanguageToggle Component Interactions', () => {
    it('renders compact language selector and toggles between EN and DE', async () => {
      render(<LanguageToggle variant="compact" />)

      const deButton = screen.getByRole('button', { name: /Zu Deutsch wechseln|DE/i })
      expect(deButton).toBeInTheDocument()
      expect(screen.getByText('EN')).toBeInTheDocument()

      fireEvent.click(deButton)

      expect(i18n.language).toBe('de')
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de')
    })

    it('renders segmented language selector with active highlight', async () => {
      render(<LanguageToggle variant="segmented" />)

      const deButton = screen.getByRole('button', { name: /Deutsch|DE/i })
      expect(deButton).toBeInTheDocument()

      fireEvent.click(deButton)

      expect(i18n.language).toBe('de')
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de')
    })
  })

  describe('3. Locale-Aware Presentation & INR Currency Convention', () => {
    it('formats INR currency preserving the Indian Rupee symbol and value in English', () => {
      const formatted = formatCurrency(4500000, 'en')
      expect(formatted).toContain('₹')
      expect(formatted).toMatch(/45,00,000|4,500,000/)
    })

    it('formats INR currency preserving the Indian Rupee symbol and value in German', () => {
      const formatted = formatCurrency(4500000, 'de')
      expect(formatted).toContain('₹')
      // Numeric value preserved
      expect(formatted.replace(/[^\d]/g, '')).toBe('4500000')
    })

    it('formats dates in English and German according to active locale', () => {
      const dateStr = '2025-06-15T10:00:00.000Z'
      const enDate = formatDate(dateStr, 'en')
      const deDate = formatDate(dateStr, 'de')

      expect(enDate).toBeTruthy()
      expect(deDate).toBeTruthy()
      // German dates use dot notation (e.g. 15.06.2025 or 15. Jun 2025)
      expect(deDate).toMatch(/15/)
    })

    it('ensures German mortgage terminology is NOT overwritten by sanitizeIndianMortgageText', async () => {
      await setAppLanguage('de')

      const germanText = 'Kreditantrag für Baufinanzierung eingereicht'
      const sanitizedInGerman = sanitizeIndianMortgageText(germanText)

      // When language is German, it must return German text without corruption
      expect(sanitizedInGerman).toBe(germanText)

      const germanBrokerage = 'Berliner Baufinanzierung GmbH'
      expect(formatBrokerageName(germanBrokerage)).toBe(germanBrokerage)
    })
  })

  describe('4. Missing Key Safeguards', () => {
    it('does not use AI fallback for static translation keys', () => {
      // Non-existent key should return the key or defaultValue, never an AI call
      const missing = i18n.t('nonexistent.static.key', { defaultValue: 'Default Static Text' })
      expect(missing).toBe('Default Static Text')
    })

    it('both en and de dictionaries contain complete domain coverage', () => {
      const enKeys = [
        'common.confirm',
        'common.cancel',
        'common.save',
        'common.delete',
        'nav.pipeline',
        'nav.leads',
        'nav.clients',
        'nav.documents',
        'nav.tasks',
        'auth.signInTitle',
        'pipeline.title',
        'pipeline.stages.NEW',
        'pipeline.stages.WON',
        'leads.title',
        'clients.title',
        'documents.title',
        'tasks.title',
        'portal.case.title',
        'admin.brokerages.title',
      ]

      for (const key of enKeys) {
        const enVal = i18n.t(key, { lng: 'en' })
        const deVal = i18n.t(key, { lng: 'de' })

        expect(enVal).toBeTruthy()
        expect(deVal).toBeTruthy()
        expect(enVal).not.toBe(key)
        expect(deVal).not.toBe(key)
      }
    })
  })
})
