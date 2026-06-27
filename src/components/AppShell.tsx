'use client';

/**
 * AppShell — shared chrome for the non-reader pages (tracker, sets).
 *
 * Gives those pages the same cross-app navigation as the reader:
 *   - desktop: fixed 72px NavRail on the left + content padded past it
 *   - top: AppHeader (brand + breadcrumb + page actions + ProfileMenu)
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
      {/* Desktop rail — fixed, full height */}
      <div className="hidden lg:block" style={{ position: 'fixed', insetBlock: 0, insetInlineStart: 0, width: 72, zIndex: 40 }}>
        <NavRail />
      </div>

      <div className="lg:ps-[72px]">
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
        {children}
      </div>

      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen} />
    </div>
  );
}
