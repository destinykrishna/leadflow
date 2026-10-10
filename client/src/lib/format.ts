/**
 * Resolves active client locale, prioritizing explicitly passed locale,
 * then stored preference, defaulting to English ('en').
 */
function resolveLocale(locale?: string): string {
  if (locale) return locale;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('leadflow_language');
      if (stored === 'de') return 'de';
    } catch {
      // Ignore storage errors
    }
  }
  return 'en';
}

/**
 * Currency formatting utility (Indian Rupee INR - ₹)
 * Formats using the active locale (e.g. ₹1,90,000 in EN or 1.90.000 ₹ in DE)
 * Preserves the underlying numeric amount and the application's INR currency standard.
 */
export function formatCurrency(amount?: number | null, locale?: string): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }
  const active = resolveLocale(locale);
  const intlLocale = active === 'de' ? 'de-DE' : 'en-IN';

  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Clean locale-aware date formatting (e.g. "25 Sep 2026" in EN or "25. Sep. 2026" in DE)
 */
export function formatDate(dateStr?: string | Date | null, locale?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';

  const active = resolveLocale(locale);
  const intlLocale = active === 'de' ? 'de-DE' : 'en-GB';

  return new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Relative time helper with locale support
 */
export function formatRelativeTime(dateStr?: string | Date | null, locale?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';

  const active = resolveLocale(locale);
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (active === 'de') {
    if (diffSec < 60) return 'Gerade eben';
    if (diffMin < 60) return `vor ${diffMin}m`;
    if (diffHours < 24) return `vor ${diffHours}h`;
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 30) return `vor ${diffDays}d`;
    return formatDate(d, 'de');
  }

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;

  return formatDate(d, 'en');
}
