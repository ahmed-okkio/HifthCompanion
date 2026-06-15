'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleSignup() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setMessage(error.message);
    else setMessage('Check your email to confirm your account.');
  }

  return (
    <div className="max-w-sm mx-auto mt-20 flex flex-col gap-4">
      <h1 className="text-xl font-bold">Sign Up</h1>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="border p-2 rounded" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="border p-2 rounded" />
      <button onClick={handleSignup} className="bg-emerald-700 text-white p-2 rounded">Create Account</button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
      <a href="/login" className="text-sm text-blue-600 underline">Already have an account? Log in</a>
    </div>
  );
}
