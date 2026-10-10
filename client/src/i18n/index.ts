import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import de from './locales/de.json';

export const SUPPORTED_LANGUAGES = ['en', 'de'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const STORAGE_KEY = 'leadflow_language';
export const LANGUAGE_STORAGE_KEY = STORAGE_KEY;

// Resolve initial language preference from localStorage with fallback to English
export function getSavedLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'de' || saved === 'en') {
        return saved;
      }
    } catch {
      // Fallback on storage errors
    }
  }
  return 'en';
}

export const getStoredLanguage = getSavedLanguage;

const initialLanguage = getSavedLanguage();

// Synchronize document element language tag
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage;
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes values safely
  },
  saveMissing: false,
  missingKeyHandler: (lngs, ns, key) => {
    if (import.meta.env?.DEV) {
      console.warn(
        `[i18n Missing Key] Language: [${lngs.join(', ')}] Namespace: "${ns}" Key: "${key}"`
      );
    }
  },
});

/**
 * Switch language, persist in localStorage, and synchronize the HTML lang attribute.
 */
export function changeLanguage(lang: SupportedLanguage): void {
  i18n.changeLanguage(lang);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors in restricted contexts
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    window.dispatchEvent(
      new CustomEvent('leadflow_language_changed', {
        detail: { language: lang, lang },
      })
    );
  }
}

export const setAppLanguage = changeLanguage;

/**
 * Returns currently active language code.
 */
export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language === 'de' ? 'de' : 'en') as SupportedLanguage;
}

export default i18n;
