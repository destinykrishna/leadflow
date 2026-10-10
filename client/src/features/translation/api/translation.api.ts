import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api.types'

export interface TranslateRequestPayload {
  text: string
  targetLang: 'en' | 'de'
  sourceLang?: 'en' | 'de'
  context?: 'lead_note' | 'document_note' | 'task_description' | 'email_preview' | 'general_note'
}

export interface TranslationResultData {
  translatedText: string
  targetLang: 'en' | 'de'
  isAiTranslated: boolean
  cached: boolean
  fallback: boolean
  warning?: string
}

/**
 * Translates eligible free-text using the authenticated backend endpoint POST /api/translate.
 * Never exposes the AI provider / Groq key to the browser client.
 */
export async function translateText(payload: TranslateRequestPayload): Promise<TranslationResultData> {
  const res = await api.post<ApiResponse<TranslationResultData>>('/translate', payload)
  if (!res.data.data) {
    throw new Error('Translation failed: empty response received from server')
  }
  return res.data.data
}
