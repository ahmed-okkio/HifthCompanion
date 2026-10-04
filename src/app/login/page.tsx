'use client';
import { useState } from 'react';
import { useClientValue } from '@/hooks/useClientValue';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import AuthBrand from '@/components/AuthBrand';
import { useI18n } from '@/components/I18nProvider';
import { safeNext } from '@/lib/nextParam';

export default function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Resolved after mount to keep the ?next= carry-over out of SSR (hydration).
  const search = useClientValue(() => location.search, '');

  async function handleLogin() {
    setLoading(true);
    setError('');
    // A leftover dev mock-mode cookie swaps in the mock client, which can't sign in. A real login always means real mode.
    document.cookie = 'x-e2e-test=; Max-Age=0; path=/';
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else window.location.assign(safeNext(new URLSearchParams(location.search).get('next')));
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 overflow-x-hidden bg-surface-app bg-radial-[120%_80%_at_50%_-10%] from-accent-muted to-transparent to-60%">
      <div className="w-full max-w-sm animate-fade-in-scale">
        <AuthBrand subtitle={t('auth.signInSubtitle')} />

        {/* Card */}
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-secondary">
                {t('auth.email')}
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="you@example.com"
                className="input"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-secondary">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
                  className="input pe-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute inset-y-0 end-0 flex items-center px-3 text-muted hover:text-secondary"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs font-medium px-3 py-2 rounded-md animate-fade-in bg-danger-muted text-danger border border-danger-muted">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="btn btn-primary w-full min-h-11 text-body mt-1"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('auth.signingIn')}
                </span>
              ) : t('auth.signInAction')}
            </button>
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center mt-5 text-sm text-muted">
          {t('auth.noAccount')}{' '}
          <Link href={`/signup${search}`}
                className="font-semibold hover:underline text-green-600">
            {t('auth.signUpLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
