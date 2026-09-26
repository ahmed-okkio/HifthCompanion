'use client';

/**
 * MobileNavDrawer — left slide-in exposing the same items as the desktop
 * NavRail, for viewports below `lg` where the rail is hidden. Mirrors the
 * overlay/panel/open-state pattern of MobileSurahDrawer. Used by both
 * ReaderShell and AppShell so every page has the cross-app nav on mobile.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RAIL_ITEMS, LABEL_KEYS, isRailItemActive, type RailItemDef } from './NavRail';
import { useI18n } from './I18nProvider';
import { LAST_CIRCLE_KEY, LAST_READER_PAGE_KEY } from '@/lib/tracker/lastCircle';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileNavDrawer({ open, onOpenChange }: Props) {
  const pathname = usePathname() ?? '';
  const { locale, t } = useI18n();
  // Anchored to the inline-start edge (insetInlineStart: 0 → left in LTR, right in RTL).
  // The hidden transform must push it off that same edge: -X in LTR, +X in RTL. Mixing
  // a logical anchor with a fixed physical translateX is what broke the RTL drawer.
  const hiddenTransform = locale === 'ar' ? 'translateX(105%)' : 'translateX(-105%)';

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const items = RAIL_ITEMS;

  // Circles → last-viewed circle, My Mushaf → last-viewed page (one hop). See NavRail.
  const [lastCircle, setLastCircle] = useState<string | null>(null);
  const [lastReaderPage, setLastReaderPage] = useState<string | null>(null);
  useEffect(() => {
    setLastCircle(localStorage.getItem(LAST_CIRCLE_KEY));
    setLastReaderPage(localStorage.getItem(LAST_READER_PAGE_KEY));
  }, [open, pathname]);
  const hrefFor = (item: RailItemDef) => {
    if (item.id === 'circles' && lastCircle) return `/tracker/${lastCircle}`;
    if (item.id === 'surahs' && lastReaderPage) return `/reader/${lastReaderPage}`;
    return item.href;
  };

  return (
    <>
      {open && (
        <div
          onClick={() => onOpenChange(false)}
          aria-hidden
          className="lg:hidden fixed inset-0 z-(--z-sticky) bg-overlay"
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="lg:hidden flex flex-col fixed inset-y-0 start-0 z-50 w-[78vw] max-w-80 bg-surface-main shadow-e3 transition-transform duration-300 ease-sheet will-change-transform"
        // eslint-disable-next-line shadcn/no-inline-styles -- open-state + locale-dependent transform
        style={{ transform: open ? 'translateX(0)' : hiddenTransform }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-subtle">
          <Link href="/reader" onClick={() => onOpenChange(false)} className="flex items-center gap-2 min-w-0 no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={t('nav.logoAlt')} className="h-10 w-auto object-contain" />
            <span className="text-primary font-display text-lg tracking-normal">Hifth Companion</span>
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('nav.closeNavigation')}
            className="btn btn-ghost btn-icon btn-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <ul role="list" className="thin-scroll m-0 flex list-none flex-col gap-0.5 overflow-y-auto p-2">
          {items.map((item) => (
            <li key={item.id}>
              <Row
                item={item}
                href={hrefFor(item)}
                label={LABEL_KEYS[item.id] ? t(LABEL_KEYS[item.id]) : item.label}
                active={isRailItemActive(item, pathname)}
                onNavigate={() => onOpenChange(false)}
                comingSoon={t('nav.comingSoon', { label: LABEL_KEYS[item.id] ? t(LABEL_KEYS[item.id]) : item.label })}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Row({ item, href, label, active, onNavigate, comingSoon }: { item: RailItemDef; href?: string; label: string; active: boolean; onNavigate: () => void; comingSoon: string }) {
  const isInert = !item.href;

  const cls = `flex w-full min-h-12 items-center gap-3 rounded-md border-none px-3 text-left text-body no-underline ${
    active ? 'bg-green-soft text-green-600 font-bold' : `bg-transparent font-medium ${isInert ? 'text-neutral-400' : 'text-primary'}`
  } ${isInert ? 'cursor-default' : 'cursor-pointer'}`;

  const inner = (
    <>
      <span className="flex items-center justify-center shrink-0">{item.icon(active)}</span>
      <span>{label}</span>
      {isInert && <span className="ml-auto text-micro uppercase tracking-wide text-muted">soon</span>}
    </>
  );

  if (isInert) {
    return (
      <button type="button" aria-disabled title={comingSoon} className={cls}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href ?? item.href!} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={cls}>
      {inner}
    </Link>
  );
}
