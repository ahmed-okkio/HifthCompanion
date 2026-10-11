'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import AuthBrand from '@/components/AuthBrand';
import { useI18n } from '@/components/I18nProvider';
import { safeNext } from '@/lib/nextParam';

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // null = checking; false = no recovery session (link bad, expired, or opened in another browser).
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  async function handleSave() {
    if (!password) return;
    setLoading(true);
    setError('');
    const { error } = await createClient().auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); }
    else window.location.assign(safeNext(null));
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 overflow-x-hidden bg-surface-app bg-radial-[120%_80%_at_50%_-10%] from-accent-muted to-transparent to-60%">
      <div className="w-full max-w-sm animate-fade-in-scale">
        <AuthBrand subtitle={t('auth.resetSubtitle')} />

        <div className="card p-6 sm:p-8">
          {hasSession === false ? (
            <div className="flex flex-col gap-4 text-sm">
              <p className="text-danger">{t('auth.resetLinkInvalid')}</p>
              <Link href="/forgot-password" className="btn btn-primary w-full min-h-11 text-body">
                {t('auth.requestNewLink')}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold mb-1.5 text-secondary">
                  {t('auth.newPassword')}
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="••••••••"
                  className="input"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-xs font-medium px-3 py-2 rounded-md animate-fade-in bg-danger-muted text-danger border border-danger-muted">
                  {error}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={loading || !password || hasSession !== true}
                className="btn btn-primary w-full min-h-11 text-body mt-1"
              >
                {loading ? t('auth.saving') : t('auth.saveAction')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
