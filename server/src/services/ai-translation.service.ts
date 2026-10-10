import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { maskEmail } from '../utils/mask.js';
import { getSharedRedisClient } from '../queues/redis.connection.js';

export interface TranslationResult {
  translatedText: string;
  targetLang: 'en' | 'de';
  isAiTranslated: boolean;
  cached: boolean;
  fallback: boolean;
  warning?: string;
}

// In-memory fallback cache with TTL for local testing or Redis outages
interface CacheEntry {
  value: string;
  expiresAt: number;
}
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_SECONDS = 86400; // 24 hours

// Patterns indicating sensitive data that MUST NOT be sent to external AI providers
const SENSITIVE_PATTERNS = [
  // JWT tokens
  /\bey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  // Private keys / secrets
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  // Passwords or explicit secret assignments
  /\b(password|passphrase|secret|apiKey|bearer|token|auth)\s*[:=]\s*[^\s]+/i,
  // Credit card numbers (standard 13-19 digit groupings)
  /\b(?:\d{4}[ -]?){3}\d{4}\b/,
  // IBAN patterns (e.g. DE followed by 20 alphanumeric characters)
  /\b[A-Z]{2}\d{2}[A-Z0-9]{12,30}\b/,
  // Indian Aadhaar / PAN format
  /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/,
  /\b\d{4}\s\d{4}\s\d{4}\b/,
  // German Tax ID (Steuer-ID / 11 digits)
  /\b\d{11}\b/,
];

/**
 * Detects whether the input string contains sensitive customer, credential, or financial data.
 */
export function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Computes a deterministic cache key for translation, isolated per brokerage/tenant.
 */
export function getCacheKey(
  brokerageId: string | null | undefined,
  targetLang: string,
  text: string
): string {
  const scope = brokerageId ? String(brokerageId) : 'platform';
  const hash = crypto.createHash('sha256').update(text.trim()).digest('hex');
  return `leadflow:translate:${scope}:${targetLang}:${hash}`;
}

export class AiTranslationService {
  /**
   * Retrieves cached translation from Redis or in-memory fallback.
   */
  private async getFromCache(cacheKey: string): Promise<string | null> {
    try {
      if (!env.isTest) {
        const redis = getSharedRedisClient();
        if (redis.status === 'ready') {
          const cached = await redis.get(cacheKey);
          if (cached) return cached;
        }
      }
    } catch {
      // Redis error fallback to in-memory cache
    }

    const memEntry = memoryCache.get(cacheKey);
    if (memEntry) {
      if (Date.now() < memEntry.expiresAt) {
        return memEntry.value;
      }
      memoryCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Stores translation result into Redis and in-memory cache.
   */
  private async saveToCache(cacheKey: string, value: string): Promise<void> {
    try {
      if (!env.isTest) {
        const redis = getSharedRedisClient();
        if (redis.status === 'ready') {
          await redis.setex(cacheKey, CACHE_TTL_SECONDS, value);
        }
      }
    } catch {
      // Non-fatal, memory cache fallback persists
    }

    memoryCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    });
  }

  /**
   * Translates eligible free-text between English and German.
   */
  async translate(params: {
    text: string;
    targetLang: 'en' | 'de';
    sourceLang?: 'en' | 'de' | undefined;
    context?: string | undefined;
    brokerageId?: string | null | undefined;
  }): Promise<TranslationResult> {
    const { text, targetLang, context, brokerageId } = params;
    const trimmed = text.trim();

    // 1. Safeguard: Detect sensitive customer, credential, or financial data first
    if (containsSensitiveData(trimmed)) {
      logger.warn(
        { context, targetLang, brokerageId },
        'Sensitive data pattern detected; skipped AI translation to preserve data confidentiality'
      );
      return {
        translatedText: trimmed,
        targetLang,
        isAiTranslated: false,
        cached: false,
        fallback: true,
        warning: 'Sensitive data pattern detected; dynamic AI translation skipped for data privacy.',
      };
    }

    // 2. Safeguard: Check if AI translation is enabled & configured
    if (!env.ENABLE_AI_TRANSLATION || !env.GROQ_API_KEY) {
      return {
        translatedText: trimmed,
        targetLang,
        isAiTranslated: false,
        cached: false,
        fallback: true,
      };
    }

    // 3. Cache lookup (isolated per tenant/brokerage)
    const cacheKey = getCacheKey(brokerageId, targetLang, trimmed);
    const cachedResult = await this.getFromCache(cacheKey);
    if (cachedResult) {
      return {
        translatedText: cachedResult,
        targetLang,
        isAiTranslated: true,
        cached: true,
        fallback: false,
      };
    }

    // 4. Sanitize general PII (e.g. mask emails)
    let sanitizedText = trimmed;
    const emailMatches = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatches) {
      for (const email of emailMatches) {
        sanitizedText = sanitizedText.replaceAll(email, maskEmail(email));
      }
    }

    // 5. Upstream call to Groq completions API with strict 5-second timeout
    try {
      const targetLanguageName = targetLang === 'de' ? 'German' : 'English';
      const systemPrompt =
        'You are an authoritative mortgage and institutional banking translator for LeadFlow. ' +
        `Translate the provided user text accurately into ${targetLanguageName}, preserving mortgage domain conventions. ` +
        'Return ONLY the direct translated text. Do NOT include markdown code blocks, explanations, formatting markers, or quotation marks.';

      const response = await fetch(`${env.GROQ_API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: sanitizedText },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, statusText: response.statusText },
          'Upstream Groq API responded with error; falling back to original text'
        );
        return {
          translatedText: trimmed,
          targetLang,
          isAiTranslated: false,
          cached: false,
          fallback: true,
        };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const translatedContent = data.choices?.[0]?.message?.content?.trim();

      if (!translatedContent) {
        return {
          translatedText: trimmed,
          targetLang,
          isAiTranslated: false,
          cached: false,
          fallback: true,
        };
      }

      // Persist in cache
      await this.saveToCache(cacheKey, translatedContent);

      return {
        translatedText: translatedContent,
        targetLang,
        isAiTranslated: true,
        cached: false,
        fallback: false,
      };
    } catch (err: any) {
      logger.warn(
        { err: err?.message || err },
        'AI translation request failed or timed out; falling back gracefully'
      );
      return {
        translatedText: trimmed,
        targetLang,
        isAiTranslated: false,
        cached: false,
        fallback: true,
      };
    }
  }

  /**
   * Clears the in-memory cache (primarily for automated testing).
   */
  clearMemoryCache(): void {
    memoryCache.clear();
  }
}

export const aiTranslationService = new AiTranslationService();
