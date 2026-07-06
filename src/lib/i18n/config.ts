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

const EASTERN_ARABIC = '٠١٢٣٤٥٦٧٨٩';

/** Convert Western (0-9) digits to Eastern Arabic numerals. Locale-gated:
 *  a no-op for non-Arabic locales so callers can wrap unconditionally. */
export function localizeDigits(input: string | number, locale: Locale): string {
  const s = String(input);
  return locale === 'ar' ? s.replace(/[0-9]/g, (d) => EASTERN_ARABIC[+d]) : s;
}
