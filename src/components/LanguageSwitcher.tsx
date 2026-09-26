'use client';

import { locales, type Locale } from '@/lib/i18n/config';
import { saveLocale } from '@/lib/services/profile';
import { useI18n } from './I18nProvider';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-xs text-secondary">
      <span className="sr-only">{t('lang.label')}</span>
      <select
        aria-label={t('lang.label')}
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          // Best-effort DB persist so server-sent email knows this language.
          // Fire-and-forget: setLocale reloads the page, and a failed save must
          // never block the switch — the cookie remains the source of truth.
          void saveLocale(next, Intl.DateTimeFormat().resolvedOptions().timeZone).catch(() => {});
          setLocale(next);
        }}
        className="input input-sm"
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {t(l === 'ar' ? 'lang.ar' : 'lang.en')}
          </option>
        ))}
      </select>
    </label>
  );
}
