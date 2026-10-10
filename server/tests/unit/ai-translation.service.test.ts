import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  aiTranslationService,
  containsSensitiveData,
} from '../../src/services/ai-translation.service.js';
import { env } from '../../src/config/env.js';

describe('AiTranslationService (Unit)', () => {
  beforeEach(() => {
    aiTranslationService.clearMemoryCache();
    vi.restoreAllMocks();
  });

  describe('Sensitive Data Detection', () => {
    it('detects JWT tokens as sensitive', () => {
      const mockJwt = ['ey' + 'JhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'ey' + 'JzdWIiOiIxMjM0NTY3ODkwIn0', 'dummy_mock_sig'].join('.');
      expect(containsSensitiveData(`Authorization: Bearer ${mockJwt}`)).toBe(true);
    });

    it('detects passwords and secrets as sensitive', () => {
      expect(containsSensitiveData(['pass', 'word: mock_test_phrase'].join(''))).toBe(true);
      expect(containsSensitiveData('apiKey = mock_test_key_sample')).toBe(true);
    });

    it('detects credit card numbers as sensitive', () => {
      expect(containsSensitiveData('Card number: 4532 1122 3344 5566')).toBe(true);
    });

    it('detects IBAN numbers as sensitive', () => {
      expect(containsSensitiveData('IBAN: DE89370400440532013000')).toBe(true);
    });

    it('does not flag normal mortgage notes as sensitive', () => {
      expect(
        containsSensitiveData('Borrower is looking to buy an apartment in Berlin Mitte with 20% equity.')
      ).toBe(false);
      expect(
        containsSensitiveData('Payslips verified for the last 3 months with permanent contract.')
      ).toBe(false);
    });
  });

  describe('Translation Workflow & Safeguards', () => {
    it('returns original text when AI translation is disabled by default', async () => {
      (env as any).ENABLE_AI_TRANSLATION = false;
      const result = await aiTranslationService.translate({
        text: 'Self-employed software consultant seeking mortgage',
        targetLang: 'de',
      });

      expect(result.translatedText).toBe('Self-employed software consultant seeking mortgage');
      expect(result.isAiTranslated).toBe(false);
      expect(result.fallback).toBe(true);
    });

    it('skips AI translation and returns original text when sensitive data is detected', async () => {
      (env as any).ENABLE_AI_TRANSLATION = true;
      (env as any).GROQ_API_KEY = 'mock_groq_api_key';

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await aiTranslationService.translate({
        text: 'Applicant token: mock-restricted-token-abc',
        targetLang: 'de',
      });

      expect(result.translatedText).toBe('Applicant token: mock-restricted-token-abc');
      expect(result.isAiTranslated).toBe(false);
      expect(result.fallback).toBe(true);
      expect(result.warning).toContain('Sensitive data pattern detected');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('calls Groq completions API and caches result when enabled', async () => {
      (env as any).ENABLE_AI_TRANSLATION = true;
      (env as any).GROQ_API_KEY = 'mock_groq_api_key';

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Gehaltsabrechnungen für die letzten 3 Monate eingereicht.',
              },
            },
          ],
        }),
      } as any);

      const result = await aiTranslationService.translate({
        text: 'Salary slips submitted for the last 3 months.',
        targetLang: 'de',
      });

      expect(result.translatedText).toBe(
        'Gehaltsabrechnungen für die letzten 3 Monate eingereicht.'
      );
      expect(result.isAiTranslated).toBe(true);
      expect(result.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify the fetch call targeted Groq's API endpoint with expected headers
      expect(mockFetch).toHaveBeenCalledWith(
        `${env.GROQ_API_BASE_URL}/chat/completions`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.GROQ_MODEL,
            messages: [
              {
                role: 'system',
                content:
                  'You are an authoritative mortgage and institutional banking translator for LeadFlow. ' +
                  'Translate the provided user text accurately into German, preserving mortgage domain conventions. ' +
                  'Return ONLY the direct translated text. Do NOT include markdown code blocks, explanations, formatting markers, or quotation marks.',
              },
              { role: 'user', content: 'Salary slips submitted for the last 3 months.' },
            ],
            temperature: 0.1,
            max_tokens: 1000,
          }),
        })
      );

      // Second call should hit in-memory cache without calling fetch again
      const cachedResult = await aiTranslationService.translate({
        text: 'Salary slips submitted for the last 3 months.',
        targetLang: 'de',
      });

      expect(cachedResult.translatedText).toBe(
        'Gehaltsabrechnungen für die letzten 3 Monate eingereicht.'
      );
      expect(cachedResult.cached).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('falls back gracefully to original text on upstream network error', async () => {
      (env as any).ENABLE_AI_TRANSLATION = true;
      (env as any).GROQ_API_KEY = 'mock_groq_api_key';

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network timeout'));

      const result = await aiTranslationService.translate({
        text: 'Urgent follow-up needed for property evaluation.',
        targetLang: 'de',
      });

      expect(result.translatedText).toBe('Urgent follow-up needed for property evaluation.');
      expect(result.isAiTranslated).toBe(false);
      expect(result.fallback).toBe(true);
    });

    it('enforces multi-tenant cache isolation between different brokerages', async () => {
      (env as any).ENABLE_AI_TRANSLATION = true;
      (env as any).GROQ_API_KEY = 'mock_groq_api_key';

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Übersetzung für Maklerbüro.' } }],
        }),
      } as any);

      const brokerageA = '65f1a2b3c4d5e6f7a8b9c0d1';
      const brokerageB = '65f1a2b3c4d5e6f7a8b9c0d2';

      // Brokerage A translates text -> hits upstream API
      const resultA = await aiTranslationService.translate({
        text: 'Standard translation for tenant isolation test.',
        targetLang: 'de',
        brokerageId: brokerageA,
      });
      expect(resultA.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Brokerage A repeats -> hits cache
      const resultACached = await aiTranslationService.translate({
        text: 'Standard translation for tenant isolation test.',
        targetLang: 'de',
        brokerageId: brokerageA,
      });
      expect(resultACached.cached).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Brokerage B translates the exact same text -> cannot access Brokerage A's cache
      const resultB = await aiTranslationService.translate({
        text: 'Standard translation for tenant isolation test.',
        targetLang: 'de',
        brokerageId: brokerageB,
      });
      expect(resultB.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('redacts all occurrences of email addresses before sending to upstream AI', async () => {
      (env as any).ENABLE_AI_TRANSLATION = true;
      (env as any).GROQ_API_KEY = 'mock_groq_api_key';

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Kontaktieren Sie Kundenbetreuung.' } }],
        }),
      } as any);

      await aiTranslationService.translate({
        text: 'Please contact client at john.doe@example.com or backup at john.doe@example.com for docs.',
        targetLang: 'de',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callOptions = mockFetch.mock.calls[0]?.[1] as { body?: string } | undefined;
      const callBody = JSON.parse(callOptions?.body || '{}');
      const userMessage = callBody.messages?.find((m: any) => m.role === 'user')?.content;

      // Both email occurrences must be masked and raw email absent
      expect(userMessage).not.toContain('john.doe@example.com');
      expect(userMessage).toContain('j***e@example.com');
    });
  });
});
