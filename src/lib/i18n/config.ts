export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';
export const LOCALE_COOKIE = 'locale';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'en' || value === 'ar';
}

/** Text direction for a locale. */
export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
