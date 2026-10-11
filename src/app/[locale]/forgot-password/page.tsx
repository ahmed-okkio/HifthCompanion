'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import AuthBrand from '@/components/AuthBrand';
import { useI18n } from '@/components/I18nProvider';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!email) return;
    setLoading(true);
    setMessage('');
    // The link lands on /auth/callback, which exchanges the code for a recovery session.
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
    });
    // Same message whether or not the account exists, so the form can't probe for emails.
    if (error) { setMessage(error.message); setIsError(true); }
    else { setMessage(t('auth.resetEmailSent')); setIsError(false); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 overflow-x-hidden bg-surface-app bg-radial-[120%_80%_at_50%_-10%] from-accent-muted to-transparent to-60%">
      <div className="w-full max-w-sm animate-fade-in-scale">
        <AuthBrand subtitle={t('auth.forgotSubtitle')} />

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
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="you@example.com"
                className="input"
                autoFocus
              />
            </div>

            {message && (
              <div role="status" className={`text-xs font-medium px-3 py-2 rounded-md animate-fade-in border ${isError ? 'bg-danger-muted text-danger border-danger-muted' : 'bg-accent-muted text-green-600 border-accent-border'}`}>
                {message}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={loading || !email}
              className="btn btn-primary w-full min-h-11 text-body mt-1"
            >
              {loading ? t('auth.sending') : t('auth.sendResetAction')}
            </button>
          </div>
        </div>

        <p className="text-center mt-5 text-sm text-muted">
          <Link href="/login" className="font-semibold hover:underline text-green-600">
            {t('auth.logInLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
