'use client';

/**
 * AppShell — shared chrome for the non-reader pages (tracker, sets).
 *
 * Gives those pages the same cross-app navigation as the reader, in the same
 * stacking order: AppHeader full-width on top, then a 72px NavRail BELOW it on
 * the left (sticky), with content to its right. Mirrors ReaderShell so the rail
 * never overlaps the header.
 *   - mobile: a hamburger in the header opens MobileNavDrawer
 *
 * The reader keeps its own ReaderShell layout; this is only for the simpler
 * scrolling pages.
 */

import { useState, type ReactNode } from 'react';
import AppHeader, { type Crumb } from './AppHeader';
import NavRail from './NavRail';
import MobileNavDrawer from './MobileNavDrawer';

export default function AppShell({
  breadcrumb,
  actions,
  profile,
  secondRail,
  children,
}: {
  breadcrumb?: string | Crumb[];
  /** Page-specific header actions, shown left of the profile menu. */
  actions?: ReactNode;
  /** Profile-menu slot (streamed via Suspense by the layout so chrome doesn't block
      the page's loading.tsx). */
  profile?: ReactNode;
  /** Optional secondary rail (e.g. the tracker circle picker), shown right of NavRail. */
  secondRail?: ReactNode;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-dvh overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Header on top, full width (sticky) */}
      <AppHeader
        breadcrumb={breadcrumb}
        onOpenNav={() => setNavOpen(true)}
        right={
          <>
            {actions}
            {profile}
          </>
        }
      />

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Rail BELOW the header, stretched to the full content height so it
            grows with the page (align-stretch is the flex default). */}
        {/* z above the circle rail (z-20) so the right-edge shadow casts over it,
            reading as a separator between the two rails. */}
        <div className="hidden lg:block flex-shrink-0 relative" style={{ width: 96, zIndex: 30, boxShadow: '1px 0 3px -2px rgba(15,23,42,0.10)' }}>
          <NavRail />
        </div>
        {/* Secondary rail: left column on desktop, full-width strip on mobile
            (CircleRail is responsive — its own classes flip orientation).
            Relative + raised z so its hover tooltips paint over the content column. */}
        {secondRail && <div className="flex-shrink-0 relative" style={{ zIndex: 20 }}>{secondRail}</div>}
        <div className="flex-1 min-w-0 min-h-0" style={{ overflow: 'hidden' }}>{children}</div>
      </div>

      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen} />
    </div>
  );
}
