'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthBrand from '@/components/AuthBrand';
import { useI18n } from '@/components/I18nProvider';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else router.push('/reader');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 overflow-x-hidden"
         style={{
           background:
             'radial-gradient(120% 80% at 50% -10%, var(--accent-muted), transparent 60%), var(--bg-base)',
         }}>
      <div className="w-full max-w-sm animate-fade-in-scale">
        <AuthBrand subtitle={t('auth.signInSubtitle')} />

        {/* Card */}
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col gap-4">
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
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="you@example.com"
                className="input"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5"
                     style={{ color: 'var(--text-secondary)' }}>
                {t('auth.password')}
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {error && (
              <div className="text-xs font-medium px-3 py-2 rounded-md animate-fade-in"
                   style={{
                     background: 'var(--danger-muted)',
                     color: 'var(--danger)',
                     border: '1px solid rgba(248, 113, 113, 0.2)',
                   }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="btn btn-primary w-full min-h-[44px]"
              style={{ fontSize: '14px', marginTop: '4px' }}
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
        <p className="text-center mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('auth.noAccount')}{' '}
          <Link href="/signup"
                className="font-semibold hover:underline"
                style={{ color: 'var(--text-accent)' }}>
            {t('auth.signUpLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
