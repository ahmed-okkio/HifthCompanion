'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.push('/reader/1');
  }

  return (
    <div className="max-w-sm mx-auto mt-20 flex flex-col gap-4">
      <h1 className="text-xl font-bold">Log In</h1>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="border p-2 rounded" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="border p-2 rounded" />
      <button onClick={handleLogin} className="bg-emerald-700 text-white p-2 rounded">Log In</button>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <a href="/signup" className="text-sm text-blue-600 underline">No account? Sign up</a>
    </div>
  );
}
