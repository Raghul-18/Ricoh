export const SUPPORTED_LOCALES = [
  { locale: 'en-GB', language: 'en', currency: 'GBP', label: 'English (UK)' },
  { locale: 'en-US', language: 'en', currency: 'USD', label: 'English (US)' },
  { locale: 'en-IN', language: 'en', currency: 'INR', label: 'English (India)' },
  { locale: 'fr-CA', language: 'fr', currency: 'CAD', label: 'Francais (Canada)' },
  { locale: 'fr-FR', language: 'fr', currency: 'EUR', label: 'Francais' },
  { locale: 'de-DE', language: 'de', currency: 'EUR', label: 'Deutsch' },
];

export const REPORTING_CURRENCY = 'GBP';

export function findLocaleConfig(localeCode) {
  if (!localeCode) return null;
  const normalized = String(localeCode).trim();
  return (
    SUPPORTED_LOCALES.find((entry) => entry.locale.toLowerCase() === normalized.toLowerCase()) ||
    SUPPORTED_LOCALES.find((entry) => entry.language.toLowerCase() === normalized.toLowerCase()) ||
    null
  );
}

export function detectBrowserLocale() {
  if (typeof navigator === 'undefined') return SUPPORTED_LOCALES[0];
  const candidates = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
  for (const candidate of candidates) {
    const exact = findLocaleConfig(candidate);
    if (exact) return exact;
    const short = findLocaleConfig(String(candidate).split('-')[0]);
    if (short) return short;
  }
  return SUPPORTED_LOCALES[0];
}
