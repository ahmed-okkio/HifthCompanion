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
import AppHeader from './AppHeader';
import NavRail from './NavRail';
import MobileNavDrawer from './MobileNavDrawer';
import ProfileMenu from './ProfileMenu';

export default function AppShell({
  breadcrumb,
  actions,
  user,
  children,
}: {
  breadcrumb?: string;
  /** Page-specific header actions, shown left of the profile menu. */
  actions?: ReactNode;
  user: { name: string; email: string };
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
            <ProfileMenu name={user.name} email={user.email} />
          </>
        }
      />

      <div className="flex flex-1 min-h-0">
        {/* Rail BELOW the header, stretched to the full content height so it
            grows with the page (align-stretch is the flex default). */}
        <div className="hidden lg:block flex-shrink-0" style={{ width: 96 }}>
          <NavRail />
        </div>
        <div className="flex-1 min-w-0 min-h-0" style={{ overflow: 'hidden' }}>{children}</div>
      </div>

      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen} />
    </div>
  );
}
