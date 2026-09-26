'use client';
import { usePathname } from 'next/navigation';
import { spreadOf } from '@/lib/quran';
import { useGoToPage } from '@/hooks/useGoToPage';
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
  const pathname = usePathname();
  const base = basePath ?? '/reader';
  const { goToPage } = useGoToPage({ basePath: base });
  if (!pathname.startsWith(`${base}/`)) return null; // not on this route

  const toggle = () => {
    localStorage.setItem(SPREAD_MODE_KEY, active ? '0' : '1');
    // C2: leaving spread lands on the lower page of the pair.
    void goToPage(active ? spreadOf(page)[0] : page, !active);
  };

  return (
    <button
      type="button"
      data-testid="spread-toggle"
      aria-pressed={active}
      onClick={toggle}
      className="hidden lg:flex items-center gap-2 bg-surface-main hover:bg-neutral-100 mt-3 h-13 px-4 rounded-lg border border-neutral-950/5 shadow-e2 cursor-pointer text-small font-medium text-neutral-600 whitespace-nowrap select-none"
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="4" width="8" height="16" rx="1" strokeWidth={2} />
        <rect x="13" y="4" width="8" height="16" rx="1" strokeWidth={2} />
      </svg>
      {active ? t('reader.singlePage') : t('reader.doublePage')}
    </button>
  );
}
