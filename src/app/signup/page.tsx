'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import AuthBrand from '@/components/AuthBrand';
import { useI18n } from '@/components/I18nProvider';

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
    else { setMessage(t('auth.checkEmail')); setIsError(false); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 overflow-x-hidden"
         style={{
           background:
             'radial-gradient(120% 80% at 50% -10%, var(--accent-muted), transparent 60%), var(--bg-base)',
         }}>
      <div className="w-full max-w-sm animate-fade-in-scale">
        <AuthBrand subtitle={t('auth.signUpSubtitle')} />

        {/* Card */}
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5"
                       style={{ color: 'var(--text-secondary)' }}>
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
                <label className="block text-xs font-semibold mb-1.5"
                       style={{ color: 'var(--text-secondary)' }}>
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
              <label className="block text-xs font-semibold mb-1.5"
                     style={{ color: 'var(--text-secondary)' }}>
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
              <label className="block text-xs font-semibold mb-1.5"
                     style={{ color: 'var(--text-secondary)' }}>
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
                  {t('auth.creating')}
                </span>
              ) : t('auth.createAction')}
            </button>
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('auth.haveAccount')}{' '}
          <Link href="/login"
                className="font-semibold hover:underline"
                style={{ color: 'var(--text-accent)' }}>
            {t('auth.logInLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
