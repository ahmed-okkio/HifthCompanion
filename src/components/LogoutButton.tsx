'use client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <button
      onClick={logout}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
      style={{ color: 'var(--danger)', border: '1px solid rgba(248,113,113,0.2)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--danger-muted)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,113,113,0.4)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,113,113,0.2)';
      }}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span className="hide-mobile">Log out</span>
    </button>
  );
}
