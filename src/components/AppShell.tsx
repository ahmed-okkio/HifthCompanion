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
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
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

      <div className="flex">
        {/* Rail BELOW the header (sticky under the 72px bar), content to its right. */}
        <div
          className="hidden lg:block flex-shrink-0"
          style={{ position: 'sticky', top: 72, alignSelf: 'flex-start', width: 72, height: 'calc(100dvh - 72px)' }}
        >
          <NavRail />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen} />
    </div>
  );
}
