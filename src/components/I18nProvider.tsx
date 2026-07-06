'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { LOCALE_COOKIE, localizeDigits, type Locale } from '@/lib/i18n/config';
import { getDictionary, type MessageKey } from '@/lib/i18n/dictionaries';

type I18nContextValue = {
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** Format a number/string with locale-appropriate digits (Eastern Arabic in ar). */
  fmtNum: (value: string | number) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const dict = useMemo(() => getDictionary(locale), [locale]);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      let str: string = dict[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      // Localize any digits in the final string (interpolated or literal).
      return localizeDigits(str, locale);
    },
    [dict, locale],
  );

  const fmtNum = useCallback(
    (value: string | number) => localizeDigits(value, locale),
    [locale],
  );

  const setLocale = useCallback((next: Locale) => {
    // Persist for a year; server layout reads this cookie to set lang/dir.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, t, fmtNum, setLocale }),
    [locale, t, fmtNum, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
