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
 *   --neutral-500, --surface-main, --shadow-e2, --radius-sm-px, --radius-md-px,
 *   --space-4, --space-16. No bare hex / hard-coded radius / shadow.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from './I18nProvider';

// RAIL_ITEMS.label stays English (module-level, no hook access) — both NavRail
// and MobileNavDrawer look the id up in LABEL_KEYS (exported) to localize it.
export const LABEL_KEYS: Record<string, 'nav.myMushaf' | 'nav.circles' | 'nav.sets' | 'nav.sharedMushafs'> = {
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

  const resolveActive = (item: RailItemDef) =>
    activeView !== undefined ? item.id === activeView : isRailItemActive(item, pathname);

  return (
    <nav
      data-testid="nav-rail"
      aria-label={t('nav.mainNavigation')}
      style={{
        width: '96px',
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 'var(--space-16)',
        paddingTop: 'var(--space-16)',
        paddingBottom: 'var(--space-16)',
        background: 'var(--surface-main)',
        boxShadow: 'var(--shadow-e2)',
        position: 'relative',
        zIndex: 2,
        overflow: 'hidden',
      }}
    >
      {/* Top section: main nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-16)', width: '100%' }}>
        <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', width: '100%' }}>
          {RAIL_ITEMS.map((item) => (
            <li key={item.id} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <RailButton item={item} isActive={resolveActive(item)} label={LABEL_KEYS[item.id] ? t(LABEL_KEYS[item.id]) : item.label} />
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

function RailButton({ item, isActive, label }: { item: RailItemDef; isActive: boolean; label: string }) {
  const { t } = useI18n();
  const isInert = !item.href;

  const sharedStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-4)',
    width: '80px',
    height: '60px',
    border: 'none',
    borderRadius: 'var(--radius-sm-px)',
    cursor: isInert ? 'default' : 'pointer',
    background: isActive ? 'var(--green-soft)' : 'transparent',
    color: isActive ? 'var(--green-600)' : 'var(--neutral-500)',
    transition: 'background 0.15s ease',
    padding: '0 var(--space-4)',
    textDecoration: 'none',
  };

  const hoverIn = isInert
    ? undefined
    : (e: React.MouseEvent<HTMLElement>) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--neutral-100)';
      };
  const hoverOut = isInert
    ? undefined
    : (e: React.MouseEvent<HTMLElement>) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
      };

  const inner = (
    <>
      {isActive && (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', left: '-8px', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '28px', borderRadius: '0 2px 2px 0', background: 'var(--green-600)', pointerEvents: 'none' }}
        />
      )}
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon(isActive)}</span>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          textAlign: 'center',
          userSelect: 'none',
          color: isActive ? 'var(--green-600)' : isInert ? 'var(--neutral-400)' : 'var(--neutral-500)',
        }}
      >
        {label}
      </span>
    </>
  );

  if (isInert) {
    return (
      <button type="button" aria-label={label} aria-disabled title={t('nav.comingSoon', { label })} style={sharedStyle}>
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={item.href!}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      title={label}
      style={sharedStyle}
      onMouseEnter={hoverIn}
      onMouseLeave={hoverOut}
    >
      {inner}
    </Link>
  );
}
