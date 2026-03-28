import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { db } from '../lib/backendClient';
import { detectBrowserLocale, findLocaleConfig, REPORTING_CURRENCY, SUPPORTED_LOCALES } from '../lib/localeConfig';
import { translate } from '../lib/translations';

const LocaleContext = createContext(null);

function resolvePreferences(profile) {
  const detected = detectBrowserLocale();
  const preferred = findLocaleConfig(profile?.locale_code) || detected;
  return {
    locale: preferred.locale,
    language: profile?.language_code || preferred.language,
    currency: profile?.primary_currency_code || preferred.currency,
    detected,
  };
}

export function LocaleProvider({ children }) {
  const { user, profile, refreshProfile } = useAuth();
  const [state, setState] = useState(() => {
    const detected = detectBrowserLocale();
    return {
      locale: detected.locale,
      language: detected.language,
      currency: detected.currency,
      ready: false,
    };
  });
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!profile) {
      const detected = detectBrowserLocale();
      setState({
        locale: detected.locale,
        language: detected.language,
        currency: detected.currency,
        ready: true,
      });
      return;
    }

    const next = resolvePreferences(profile);
    setState({
      locale: next.locale,
      language: next.language,
      currency: next.currency,
      ready: true,
    });

    if (!initializedRef.current && user?.id && (!profile.locale_code || !profile.primary_currency_code || !profile.language_code)) {
      initializedRef.current = true;
      db.profiles()
        .update({
          locale_code: next.locale,
          language_code: next.language,
          primary_currency_code: next.currency,
        })
        .eq('id', user.id)
        .then(() => refreshProfile?.())
        .catch(() => undefined);
    }
  }, [profile, user?.id, refreshProfile]);

  const updatePreferences = async ({ locale, language, currency }) => {
    if (!user?.id) return;
    const nextConfig = findLocaleConfig(locale) || findLocaleConfig(language) || detectBrowserLocale();
    const payload = {
      locale_code: locale || nextConfig.locale,
      language_code: language || nextConfig.language,
      primary_currency_code: currency || nextConfig.currency,
    };
    const { error } = await db.profiles().update(payload).eq('id', user.id);
    if (error) throw error;
    setState({
      locale: payload.locale_code,
      language: payload.language_code,
      currency: payload.primary_currency_code,
      ready: true,
    });
    await refreshProfile?.();
  };

  const value = useMemo(() => {
    const formatCurrency = (amount, currencyCode = state.currency, options = {}) =>
      new Intl.NumberFormat(state.locale, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: options.maximumFractionDigits ?? 2,
      }).format(Number(amount || 0));

    const formatNumber = (value, options = {}) =>
      new Intl.NumberFormat(state.locale, options).format(Number(value || 0));

    const formatDate = (value, options = {}) => {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value);
      return new Intl.DateTimeFormat(state.locale, options).format(date);
    };

    return {
      locale: state.locale,
      language: state.language,
      primaryCurrency: state.currency,
      reportingCurrency: REPORTING_CURRENCY,
      supportedLocales: SUPPORTED_LOCALES,
      ready: state.ready,
      setPreferences: updatePreferences,
      t: (key, values) => translate(state.locale, key, values),
      formatCurrency,
      formatNumber,
      formatDate,
    };
  }, [state]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be inside LocaleProvider');
  return ctx;
}
