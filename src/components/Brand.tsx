'use client';

import Link from 'next/link';
import { useI18n } from './I18nProvider';

/**
 * The app wordmark — logo + "Hifth Companion" in the brand font. Single source
 * of truth so every top bar (ReaderNav, AppHeader) renders an identical,
 * identically-sized brand. Links to the reader home.
 *
 * Plain <img> from /public on purpose (next/image optimizer failed to render
 * the logo on Vercel).
 *
 * Client component — both its consumers (AppHeader, ReaderNav) are client
 * components that render it inline (not via children), so it must stay
 * client-renderable itself.
 */
export default function Brand() {
  const { t } = useI18n();
  return (
    <Link href="/reader" className="flex items-center gap-3 min-w-0" style={{ textDecoration: 'none', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt={t('nav.logoAlt')} style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
      <span
        className="whitespace-nowrap"
        style={{
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-brand), system-ui, sans-serif',
          fontSize: '1.2rem',
          fontWeight: 400,
          letterSpacing: '0.01em',
        }}
      >
        Hifth Companion
      </span>
    </Link>
  );
}
