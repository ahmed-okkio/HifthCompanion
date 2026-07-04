'use client';

/**
 * ProfileMenu — avatar trigger + dropdown, replaces the old red LogoutButton.
 *
 * Like a typical site account menu: the avatar opens a panel with the user's
 * name + email, the language switcher, an (inert) Settings entry, and Log out.
 * Closes on outside-click and Escape.
 *
 * Logged-out callers should render a Login link instead of this component.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/tracker/ui';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useI18n } from '@/components/I18nProvider';

export default function ProfileMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/login');
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('menu.account')}
        className="flex items-center justify-center rounded-full"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, minHeight: 44, minWidth: 44 }}
      >
        <Avatar seed={name} size={36} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('menu.account')}
          className="thin-scroll"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            insetInlineEnd: 0,
            width: 248,
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--surface-main)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg-px)',
            boxShadow: 'var(--shadow-e3)',
            zIndex: 60,
            overflow: 'hidden',
          }}
        >
          {/* Header — name + email */}
          <div className="flex items-center gap-3" style={{ padding: 'var(--space-12)', borderBottom: '1px solid var(--border-subtle)' }}>
            <Avatar seed={name} size={40} />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{name}</span>
              {email && <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{email}</span>}
            </div>
          </div>

          {/* Language switcher */}
          <div className="flex items-center justify-between" style={{ padding: '10px var(--space-12)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('lang.label')}</span>
            <LanguageSwitcher />
          </div>

          {/* My hifth — navigate to the memorization editor */}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); router.push('/profile'); }}
            className="flex items-center gap-2 w-full text-left"
            style={{ padding: '10px var(--space-12)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover, var(--accent-muted))'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>{t('menu.myHifth')}</span>
          </button>

          {/* Log out */}
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex items-center gap-2 w-full text-left"
            style={{ padding: '10px var(--space-12)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.8125rem', fontWeight: 600 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-muted)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{t('menu.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
