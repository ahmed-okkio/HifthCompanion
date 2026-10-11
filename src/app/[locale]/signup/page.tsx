'use client';
import { useState } from 'react';
import { useClientValue } from '@/hooks/useClientValue';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import AuthBrand from '@/components/AuthBrand';
import { useI18n } from '@/components/I18nProvider';
import { safeNext } from '@/lib/nextParam';

export default function SignupPage() {
  const supabase = createClient();
  const { t } = useI18n();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  // Resolved after mount to keep the ?next= carry-over out of SSR (hydration).
  const search = useClientValue(() => location.search, '');

  const ready = !!firstName.trim() && !!lastName.trim() && !!email && !!password;

  async function handleSignup() {
    if (!ready) return;
    setLoading(true);
    setMessage('');
    const next = safeNext(new URLSearchParams(location.search).get('next'));
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Thread `next` through the email-confirm link so the callback lands the
        // new user back on their invite (or /reader) after confirming.
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // Mirrored into a public.profiles row by the on_auth_user_created
        // trigger so tracker rosters can show real display names.
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      },
    });
    if (error) { setMessage(error.message); setIsError(true); }
    else { setMessage(t('auth.checkEmail')); setIsError(false); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 overflow-x-hidden bg-surface-app bg-radial-[120%_80%_at_50%_-10%] from-accent-muted to-transparent to-60%">
      <div className="w-full max-w-sm animate-fade-in-scale">
        <AuthBrand subtitle={t('auth.signUpSubtitle')} />

        {/* Card */}
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-secondary">
                  {t('auth.firstName')}
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
                <label className="block text-xs font-semibold mb-1.5 text-secondary">
                  {t('auth.lastName')}
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
              <label className="block text-xs font-semibold mb-1.5 text-secondary">
                {t('auth.email')}
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
              <label className="block text-xs font-semibold mb-1.5 text-secondary">
                {t('auth.password')}
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
              <div className={`text-xs font-medium px-3 py-2 rounded-md animate-fade-in border ${isError ? 'bg-danger-muted text-danger border-danger-muted' : 'bg-accent-muted text-green-600 border-accent-border'}`}>
                {message}
              </div>
            )}

            <button
              onClick={handleSignup}
              disabled={loading || !ready}
              className="btn btn-primary w-full min-h-11 text-body mt-1"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('auth.creating')}
                </span>
              ) : t('auth.createAction')}
            </button>
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center mt-5 text-sm text-muted">
          {t('auth.haveAccount')}{' '}
          <Link href={`/login${search}`}
                className="font-semibold hover:underline text-green-600">
            {t('auth.logInLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
