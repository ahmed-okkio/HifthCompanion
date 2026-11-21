'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname, useHydrated } from '@/lib/i18n/usePathname';
import { spreadUrl } from '@/lib/quran';
import { prefersSpread } from '@/components/SpreadToggle';
import { pinStorageKey } from '@/lib/bookmark';

// Share entry point, static shell for every /share/<setId> (src/lib/shellRewrites.json): honor
// this set's own bookmark (default page) before handing off to /share/<setId>/<page>. Page 1 fallback.
export default function ShareIndexPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const setId = usePathname().split('/')[2];
  useEffect(() => {
    if (!hydrated) return;
    const raw = localStorage.getItem(pinStorageKey(`/share/${setId}`));
    const n = raw ? parseInt(raw, 10) : NaN;
    const page = !isNaN(n) && n > 0 ? n : 1;
    router.replace(`/share/${setId}/${prefersSpread() ? spreadUrl(page) : page}`);
  }, [hydrated, router, setId]);
  return null;
}
