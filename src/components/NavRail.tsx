'use client';

/**
 * NavRail — slim left icon rail.
 *
 * 96px wide, desktop-only (rendered inside a `hidden lg:flex` parent). Now used
 * on EVERY app surface (reader + tracker + sets) via ReaderShell and AppShell,
 * so the rail is the single cross-page navigation spine.
 *
 * Functional items (`surahs`, `circles`) are real `next/link` links; active
 * state is derived from the route via `usePathname()`. The remaining items
 * (Bookmarks/Notes/Tags/Settings) stay inert placeholders ("coming soon").
 *
 * The item definitions (`RAIL_ITEMS` + `SETTINGS_ITEM`) and the active-state
 * helper (`isRailItemActive`) are exported so the mobile drawer
 * (`MobileNavDrawer`) renders the exact same set — one source of truth.
 *
 * Tokens consumed: --green-600, --green-soft, --neutral-100, --neutral-400,
 *   --neutral-500, --surface-main, --shadow-e2, --radius-sm, --radius-md,
 *   --space-4, --space-16. No bare hex / hard-coded radius / shadow.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from './I18nProvider';
import { LAST_CIRCLE_KEY, LAST_READER_PAGE_KEY } from '@/lib/tracker/lastCircle';

// RAIL_ITEMS.label stays English (module-level, no hook access) — both NavRail
// and MobileNavDrawer look the id up in LABEL_KEYS (exported) to localize it.
export const LABEL_KEYS: Record<string, 'nav.wird' | 'nav.myMushaf' | 'nav.circles' | 'nav.sets' | 'nav.sharedMushafs'> = {
  wird: 'nav.wird',
  surahs: 'nav.myMushaf',
  circles: 'nav.circles',
  sets: 'nav.sets',
  shared: 'nav.sharedMushafs',
};

// ---------------------------------------------------------------------------
// Logo block — green rounded square with book glyph
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Inline SVG icons (22×22, strokeWidth 1.75)
// ---------------------------------------------------------------------------

function strokeColor(active: boolean) {
  return active ? 'var(--green-600)' : 'var(--neutral-500)';
}

function IconWird({ active }: { active: boolean }) {
  // Bookmark glyph — the place you've reached in your wird.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor(active)} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconSurahs({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor(active)} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function IconCircles({ active }: { active: boolean }) {
  // Group / people glyph — represents the Hifth Circles (teacher's students).
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor(active)} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconShared({ active }: { active: boolean }) {
  // Stacked books glyph — other people's mushafs shared WITH the viewer.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor(active)} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="13" width="15" height="6" rx="1.5" />
      <line x1="7" y1="13" x2="7" y2="19" />
      <rect x="6" y="5" width="15" height="6" rx="1.5" />
      <line x1="10" y1="5" x2="10" y2="11" />
    </svg>
  );
}

function IconSets({ active }: { active: boolean }) {
  // Archive / collection glyph — mirrors the reader top-bar "My Sets" icon.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={strokeColor(active)} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Rail item definitions — single source of truth (rail + mobile drawer)
// ---------------------------------------------------------------------------

export interface RailItemDef {
  id: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  /** Target route when functional; absent => inert placeholder. */
  href?: string;
  /** Pathname prefixes that mark this item active. */
  matchPrefixes?: string[];
}

export const RAIL_ITEMS: RailItemDef[] = [
  {
    id: 'wird',
    label: 'Wird',
    icon: (active) => <IconWird active={active} />,
    href: '/wird',
    matchPrefixes: ['/wird'],
  },
  {
    id: 'surahs',
    label: 'My Mushaf',
    icon: (active) => <IconSurahs active={active} />,
    href: '/reader',
    matchPrefixes: ['/reader'],
  },
  {
    id: 'circles',
    label: 'Circles',
    icon: (active) => <IconCircles active={active} />,
    href: '/tracker',
    matchPrefixes: ['/tracker'],
  },
  {
    id: 'sets',
    label: 'Sets',
    icon: (active) => <IconSets active={active} />,
    href: '/sets',
    matchPrefixes: ['/sets'],
  },
  {
    id: 'shared',
    label: 'Shared Mushafs',
    icon: (active) => <IconShared active={active} />,
    href: '/shared',
    matchPrefixes: ['/shared', '/share'],
  },
];

/** Whether `item` should render as active for the given pathname. */
export function isRailItemActive(item: RailItemDef, pathname: string): boolean {
  if (!item.href || !item.matchPrefixes) return false;
  return item.matchPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p));
}

// ---------------------------------------------------------------------------
// NavRail component
// ---------------------------------------------------------------------------

interface NavRailProps {
  /** Optional explicit override; by default active state is route-derived. */
  activeView?: string;
}

export default function NavRail({ activeView }: NavRailProps) {
  const pathname = usePathname() ?? '';
  const { t } = useI18n();

  // Optimistic selection: highlight the tapped item immediately, before the (slower)
  // cross-section navigation commits. Cleared once the pathname actually changes.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const routeActiveId = RAIL_ITEMS.find((i) => isRailItemActive(i, pathname))?.id;
  const activeId = pending ?? routeActiveId;

  // Send "Circles" straight to the last-viewed circle so it's a single navigation
  // (one skeleton). Hitting /tracker instead redirects to a circle — a double hop
  // that flashes the index skeleton, then blank, then the circle skeleton.
  const [lastCircle, setLastCircle] = useState<string | null>(null);
  const [lastReaderPage, setLastReaderPage] = useState<string | null>(null);
  useEffect(() => {
    setLastCircle(localStorage.getItem(LAST_CIRCLE_KEY));
    setLastReaderPage(localStorage.getItem(LAST_READER_PAGE_KEY));
  }, [pathname]);
  const hrefFor = (item: RailItemDef) => {
    if (item.id === 'circles' && lastCircle) return `/tracker/${lastCircle}`;
    if (item.id === 'surahs' && lastReaderPage) return `/reader/${lastReaderPage}`;
    return item.href;
  };

  const resolveActive = (item: RailItemDef) =>
    activeView !== undefined ? item.id === activeView : item.id === activeId;

  return (
    <nav
      data-testid="nav-rail"
      aria-label={t('nav.mainNavigation')}
      className="relative z-2 flex h-full w-24 shrink-0 flex-col items-center justify-start gap-4 overflow-hidden bg-surface-main py-4 shadow-e2"
    >
      {/* Top section: main nav items */}
      <div className="flex w-full flex-col items-center gap-4">
        <ul role="list" className="m-0 flex w-full list-none flex-col items-center gap-1 p-0">
          {RAIL_ITEMS.map((item) => (
            <li key={item.id} className="flex w-full justify-center">
              <RailButton item={item} href={hrefFor(item)} isActive={resolveActive(item)} label={LABEL_KEYS[item.id] ? t(LABEL_KEYS[item.id]) : item.label} onNavigate={() => setPending(item.id)} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// RailButton — single rail item (link when functional, inert button otherwise)
// ---------------------------------------------------------------------------

function RailButton({ item, href, isActive, label, onNavigate }: { item: RailItemDef; href?: string; isActive: boolean; label: string; onNavigate?: () => void }) {
  const { t } = useI18n();
  const isInert = !item.href;

  const sharedClass = `relative flex h-15 w-20 flex-col items-center justify-center gap-1 rounded-sm border-none px-1 no-underline transition-colors duration-150 ${
    isInert ? 'cursor-default' : 'cursor-pointer'
  } ${isActive ? 'bg-green-soft text-green-600' : `bg-transparent text-neutral-500${isInert ? '' : ' hover:bg-neutral-100'}`}`;

  const inner = (
    <>
      {isActive && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -left-2 h-7 w-0.75 -translate-y-1/2 rounded-r-xs bg-green-600"
        />
      )}
      <span className="flex shrink-0 items-center justify-center">{item.icon(isActive)}</span>
      <span
        className={`text-meta leading-none font-medium tracking-normal text-center select-none ${isActive ? 'text-green-600' : isInert ? 'text-neutral-400' : 'text-neutral-500'}`}
      >
        {label}
      </span>
    </>
  );

  if (isInert) {
    return (
      <button type="button" aria-label={label} aria-disabled title={t('nav.comingSoon', { label })} className={sharedClass}>
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={href ?? item.href!}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      title={label}
      className={sharedClass}
      onClick={onNavigate}
    >
      {inner}
    </Link>
  );
}
