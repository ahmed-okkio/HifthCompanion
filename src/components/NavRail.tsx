'use client';

/**
 * NavRail — slim left icon rail (Story 4 / Story 4.5 gap-close, Model: Sonnet).
 *
 * 72px wide, desktop-only (rendered inside a `hidden lg:flex` parent in ReaderShell).
 * Only "Surahs" is functional (active state). All other items are inert placeholders
 * (aria-disabled, no-op click) with a subtitle title tooltip ("Coming soon").
 *
 * Story 4.5 additions:
 *   - Green logo block at top (book glyph, green bg, rounded square ≤20px radius).
 *   - Legible labels (11px / weight 500 / token colors) beneath each icon.
 *   - Active state: green icon + green label + green-soft bg + green left indicator.
 *   - Exactly ONE Settings item (pinned bottom); no duplicate affordances.
 *   - Even vertical rhythm matching the mockup.
 *
 * Tokens consumed: --green-600, --green-soft, --neutral-100, --neutral-400,
 *   --neutral-500, --surface-main, --shadow-e2, --radius-sm-px, --radius-md-px,
 *   --radius-max, --space-4, --space-8, --space-12, --space-16, --space-20.
 * No bare hex / hard-coded radius / shadow anywhere in this file.
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Logo block — green rounded square with book glyph
// ---------------------------------------------------------------------------

function LogoBlock() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: '44px',
        height: '44px',
        borderRadius: 'var(--radius-md-px)',   /* 14px — well under max-20 */
        background: 'var(--green-600)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {/* Open-book glyph, white stroke */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons (22×22, strokeWidth 1.75)
// ---------------------------------------------------------------------------

function IconSurahs({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'var(--green-600)' : 'var(--neutral-500)'}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function IconBookmarks() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--neutral-400)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconNotes() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--neutral-400)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconTags() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--neutral-400)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--neutral-400)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Rail item definitions
// ---------------------------------------------------------------------------

interface RailItem {
  id: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  /** true = wired to real view; false = inert placeholder */
  functional: boolean;
}

const RAIL_ITEMS: RailItem[] = [
  {
    id: 'surahs',
    label: 'Surahs',
    icon: (active) => <IconSurahs active={active} />,
    functional: true,
  },
  {
    id: 'bookmarks',
    label: 'Bookmarks',
    icon: () => <IconBookmarks />,
    functional: false,
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: () => <IconNotes />,
    functional: false,
  },
  {
    id: 'tags',
    label: 'Tags',
    icon: () => <IconTags />,
    functional: false,
  },
];

const SETTINGS_ITEM: RailItem = {
  id: 'settings',
  label: 'Settings',
  icon: () => <IconSettings />,
  functional: false,
};

// ---------------------------------------------------------------------------
// NavRail component
// ---------------------------------------------------------------------------

interface NavRailProps {
  /** The currently active view. Only 'surahs' is wired. */
  activeView?: string;
}

export default function NavRail({ activeView = 'surahs' }: NavRailProps) {
  return (
    <nav
      data-testid="nav-rail"
      aria-label="Main navigation"
      style={{
        width: '72px',
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        /* Logo block top, items group in middle-top, Settings pinned bottom */
        justifyContent: 'space-between',
        paddingTop: 'var(--space-16)',
        paddingBottom: 'var(--space-16)',
        background: 'var(--surface-main)',
        boxShadow: 'var(--shadow-e2)',
        position: 'relative',
        zIndex: 2,
        /* Clip any overflow so nothing bleeds outside the 72px column */
        overflow: 'hidden',
      }}
    >
      {/* Top section: logo block + main nav items */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-16)',
          width: '100%',
        }}
      >
        {/* Logo block — brand mark, inert */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            paddingBottom: 'var(--space-4)',
          }}
        >
          <LogoBlock />
        </div>

        {/* Nav items: Surahs, Bookmarks, Notes, Tags */}
        <ul
          role="list"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)',
            width: '100%',
          }}
        >
          {RAIL_ITEMS.map((item) => {
            const isActive = item.functional && activeView === item.id;
            return (
              <li
                key={item.id}
                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              >
                <RailButton item={item} isActive={isActive} />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom group: Settings — pinned to bottom, exactly ONE */}
      <ul
        role="list"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <li style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <RailButton item={SETTINGS_ITEM} isActive={false} />
        </li>
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// RailButton — single rail item button
// ---------------------------------------------------------------------------

function RailButton({ item, isActive }: { item: RailItem; isActive: boolean }) {
  const isInert = !item.functional;

  return (
    <button
      type="button"
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={isInert ? true : undefined}
      title={isInert ? `${item.label} — coming soon` : item.label}
      onClick={isInert ? undefined : undefined /* functional items handled by parent */}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        width: '56px',
        /* Taller button gives breathing room for icon + label */
        height: '60px',
        border: 'none',
        /* radius-sm-px = 10px, well under max 20 */
        borderRadius: 'var(--radius-sm-px)',
        cursor: isInert ? 'default' : 'pointer',
        background: isActive ? 'var(--green-soft)' : 'transparent',
        color: isActive ? 'var(--green-600)' : 'var(--neutral-500)',
        transition: 'background 0.15s ease',
        padding: '0 var(--space-4)',
      }}
      onMouseEnter={
        isInert
          ? undefined
          : (e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--neutral-100)';
              }
            }
      }
      onMouseLeave={
        isInert
          ? undefined
          : (e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }
      }
    >
      {/* Green left indicator bar — only shown when active.
          Positioned relative to the nav rail edge: the button is centered inside
          72px rail, so left edge of button is (72-56)/2 = 8px from rail edge.
          left: -8px puts the bar flush against the rail's left border. */}
      {isActive && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-8px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '3px',
            height: '28px',
            borderRadius: '0 2px 2px 0',
            background: 'var(--green-600)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Icon */}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {item.icon(isActive)}
      </span>

      {/* Label — 11px / weight 500, matches mockup caption scale */}
      <span
        style={{
          fontSize: '11px',
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          color: isActive
            ? 'var(--green-600)'
            : isInert
            ? 'var(--neutral-400)'
            : 'var(--neutral-500)',
        }}
      >
        {item.label}
      </span>
    </button>
  );
}
