import { createClient } from '@/lib/supabase/server';
import { getMyChrome } from '@/lib/services/profile';
import ProfileMenu from './ProfileMenu';

/**
 * Server component that fetches the signed-in user's chrome and renders ProfileMenu.
 * Rendered inside a <Suspense> in the app-section layouts so the chrome fetch streams
 * — the layout returns immediately, letting the page's loading.tsx show INSTANTLY
 * instead of being blocked behind an awaited layout. Fallback: ProfileMenuFallback.
 */
export default async function ProfileMenuAsync() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const account = await getMyChrome(user);
  return <ProfileMenu name={account.name} email={account.email} />;
}

/** Neutral avatar-sized shimmer shown while ProfileMenuAsync streams. */
export function ProfileMenuFallback() {
  return (
    <div
      aria-hidden
      className="size-9 rounded-full bg-linear-to-r from-neutral-100 via-neutral-200 to-neutral-100 bg-size-[200%_100%] animate-[shimmer_1.4s_linear_infinite]"
    />
  );
}
