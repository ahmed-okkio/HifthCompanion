'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SignupPage() {
  const supabase = createClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const ready = !!firstName.trim() && !!lastName.trim() && !!email && !!password;

  async function handleSignup() {
    if (!ready) return;
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || location.origin}/auth/callback`,
        // Mirrored into a public.profiles row by the on_auth_user_created
        // trigger so tracker rosters can show real display names.
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      },
    });
    if (error) { setMessage(error.message); setIsError(true); }
    else { setMessage('Check your email to confirm your account.'); setIsError(false); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 overflow-x-hidden"
         style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm animate-fade-in-scale">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/reader/1">
            <span className="text-3xl font-bold" style={{ color: 'var(--text-accent)' }}>
              حفظ
            </span>
          </Link>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Create your account
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5"
                       style={{ color: 'var(--text-secondary)' }}>
                  First name
                </label>
                <input
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignup()}
                  placeholder="Omar"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5"
                       style={{ color: 'var(--text-secondary)' }}>
                  Last name
                </label>
                <input
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignup()}
                  placeholder="Ahmed"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5"
                     style={{ color: 'var(--text-secondary)' }}>
                Email
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignup()}
                placeholder="you@example.com"
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5"
                     style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignup()}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {message && (
              <div className="text-xs font-medium px-3 py-2 rounded-md animate-fade-in"
                   style={{
                     background: isError ? 'var(--danger-muted)' : 'var(--accent-muted)',
                     color: isError ? 'var(--danger)' : 'var(--text-accent)',
                     border: `1px solid ${isError ? 'rgba(248, 113, 113, 0.2)' : 'var(--border-accent)'}`,
                   }}>
                {message}
              </div>
            )}

            <button
              onClick={handleSignup}
              disabled={loading || !ready}
              className="btn btn-primary w-full min-h-[44px]"
              style={{ fontSize: '14px', marginTop: '4px' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </span>
              ) : 'Create Account'}
            </button>
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login"
                className="font-semibold hover:underline"
                style={{ color: 'var(--text-accent)' }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
