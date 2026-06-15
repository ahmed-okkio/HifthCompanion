# Slice 2 — Auth (Sign Up / Login / Logout)

## Goal
Users can create accounts with email + password, verify their email, log in, and log out. Unauthenticated users are redirected away from protected routes.

---

## Dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr
```

---

## Supabase Setup
1. In Supabase dashboard → **Authentication → Providers** → Email: enabled, confirm email: ON.
2. Set Site URL to your Vercel URL (e.g. `https://quran-annotator.vercel.app`).
3. Set Redirect URLs to include `https://quran-annotator.vercel.app/auth/callback`.

---

## Environment Variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

---

## Implementation

### `lib/supabase/client.ts` — browser client
```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `lib/supabase/server.ts` — server client
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### `middleware.ts` — protect routes
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const protectedPaths = ['/sets', '/reader']; // reader will need auth from slice 4 onward
  const isProtected = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/sets/:path*'], // only /sets is protected in this slice
};
```

> Note: `/reader` is left public here — annotation writing will require auth and be enforced at the component level in slice 4.

### `app/auth/callback/route.ts` — handle email confirmation redirect
```ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/reader/1`);
}
```

### `app/signup/page.tsx`
```tsx
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
```

### `app/login/page.tsx`
```tsx
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
```

### Logout button (add to nav)
```tsx
'use client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return <button onClick={logout} className="text-sm text-red-400">Log out</button>;
}
```

---

## Free-tier Checklist
- ✅ Supabase Auth free tier: 50,000 MAU — plenty for launch
- ✅ Email confirmations use Supabase's built-in SMTP (free, limited to 3/hr on free tier — fine for low volume; switch to Resend later if needed)
- ✅ No extra services needed

## Done When
A user can register, receive a confirmation email, click the link, be redirected to `/reader/1`, and log out. Visiting `/sets` while logged out redirects to `/login`.
