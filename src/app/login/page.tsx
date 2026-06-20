'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else router.push('/reader/1');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
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
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px' }}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5"
                     style={{ color: 'var(--text-secondary)' }}>
                Email
              </label>
              <input
                type="email"
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
                Password
              </label>
              <input
                type="password"
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
              className="btn btn-primary w-full"
              style={{ padding: '10px 16px', fontSize: '14px', marginTop: '4px' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
          No account?{' '}
          <Link href="/signup"
                className="font-semibold hover:underline"
                style={{ color: 'var(--text-accent)' }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
