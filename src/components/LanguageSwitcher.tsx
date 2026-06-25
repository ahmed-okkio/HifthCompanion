'use client';

import { locales } from '@/lib/i18n/config';
import { useI18n } from './I18nProvider';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
      <span className="sr-only">{t('lang.label')}</span>
      <select
        aria-label={t('lang.label')}
        value={locale}
        onChange={(e) => setLocale(e.target.value as (typeof locales)[number])}
        className="rounded border px-2 py-1 text-xs"
        style={{ background: 'var(--surface-main)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
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
