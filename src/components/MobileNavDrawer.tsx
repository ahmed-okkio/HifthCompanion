'use client';

/**
 * MobileNavDrawer — left slide-in exposing the same items as the desktop
 * NavRail, for viewports below `lg` where the rail is hidden. Mirrors the
 * overlay/panel/open-state pattern of MobileSurahDrawer. Used by both
 * ReaderShell and AppShell so every page has the cross-app nav on mobile.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RAIL_ITEMS, isRailItemActive, type RailItemDef } from './NavRail';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileNavDrawer({ open, onOpenChange }: Props) {
  const pathname = usePathname() ?? '';

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const items = RAIL_ITEMS;

  return (
    <>
      {open && (
        <div
          onClick={() => onOpenChange(false)}
          aria-hidden
          className="lg:hidden"
          style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.4)' }}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="lg:hidden flex flex-col"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          insetInlineStart: 0,
          zIndex: 50,
          width: '78vw',
          maxWidth: 320,
          background: 'var(--surface-main)',
          boxShadow: 'var(--shadow-e3)',
          transform: open ? 'translateX(0)' : 'translateX(-105%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: 'var(--space-16)', borderBottom: '1px solid var(--border-subtle)' }}>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 'var(--radius-md-px)', background: 'var(--green-600)', color: '#fff' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </span>
            <span className="font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Hifth Companion</span>
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close navigation"
            className="flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm-px)', background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <ul role="list" className="thin-scroll" style={{ listStyle: 'none', margin: 0, padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          {items.map((item) => (
            <li key={item.id}>
              <Row item={item} active={isRailItemActive(item, pathname)} onNavigate={() => onOpenChange(false)} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Row({ item, active, onNavigate }: { item: RailItemDef; active: boolean; onNavigate: () => void }) {
  const isInert = !item.href;

  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-12)',
    width: '100%',
    minHeight: 48,
    padding: '0 var(--space-12)',
    borderRadius: 'var(--radius-md-px)',
    border: 'none',
    background: active ? 'var(--green-soft)' : 'transparent',
    color: active ? 'var(--green-600)' : isInert ? 'var(--neutral-400)' : 'var(--text-primary)',
    textDecoration: 'none',
    fontSize: '0.9375rem',
    fontWeight: active ? 700 : 500,
    cursor: isInert ? 'default' : 'pointer',
    textAlign: 'left',
  };

  const inner = (
    <>
      <span className="flex items-center justify-center shrink-0">{item.icon(active)}</span>
      <span>{item.label}</span>
      {isInert && <span className="ml-auto text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>soon</span>}
    </>
  );

  if (isInert) {
    return (
      <button type="button" aria-disabled title={`${item.label} — coming soon`} style={style}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={item.href!} onClick={onNavigate} aria-current={active ? 'page' : undefined} style={style}>
      {inner}
    </Link>
  );
}
