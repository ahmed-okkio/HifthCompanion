'use client';
import { usePathname, useRouter } from 'next/navigation';
import { spreadOf, spreadUrl } from '@/lib/quran';
import { useI18n } from '@/components/I18nProvider';

/** localStorage key holding the persisted spread/single preference ('1' = spread). */
export const SPREAD_MODE_KEY = 'reader-spread-mode';

/**
 * M5 — desktop spread/single mode toggle (C1–C4, E2). Renders next to the zoom control.
 * Writes the preference to localStorage and client-navigates N↔N-M with the existing pairing
 * helpers. Desktop-only (`hidden lg:flex`) and /reader-only (share routes never go spread).
 */
export default function SpreadToggle({ page, active, basePath }: { page: number; active: boolean; basePath?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const base = basePath ?? '/reader';
  if (!pathname.startsWith(`${base}/`)) return null; // not on this route

  const toggle = () => {
    if (active) {
      localStorage.setItem(SPREAD_MODE_KEY, '0');
      router.push(`${base}/${spreadOf(page)[0]}`); // back to the lower page (C2)
    } else {
      localStorage.setItem(SPREAD_MODE_KEY, '1');
      router.push(`${base}/${spreadUrl(page)}`);
    }
  };

  return (
    <button
      type="button"
      data-testid="spread-toggle"
      aria-pressed={active}
      onClick={toggle}
      className="hidden lg:flex items-center gap-2"
      style={{
        marginTop: 'var(--space-12)',
        height: '52px',
        padding: '0 var(--space-16)',
        background: active ? 'var(--neutral-100)' : 'var(--surface-main)',
        borderRadius: 'var(--radius-lg-px)',
        border: '1px solid rgba(15, 23, 42, 0.05)',
        boxShadow: 'var(--shadow-e2)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--neutral-600)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = active ? 'var(--neutral-100)' : 'var(--surface-main)'; }}
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="4" width="8" height="16" rx="1" strokeWidth={2} />
        <rect x="13" y="4" width="8" height="16" rx="1" strokeWidth={2} />
      </svg>
      {active ? t('reader.singlePage') : t('reader.doublePage')}
    </button>
  );
}
