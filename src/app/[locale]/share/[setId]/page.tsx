'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { spreadUrl } from '@/lib/quran';
import { SPREAD_MODE_KEY } from '@/components/SpreadToggle';
import { pinStorageKey } from '@/lib/bookmark';

// Share entry point: honor this set's own bookmark (default page) before handing
// off to the capability-resolving `[page]` route. Falls back to page 1.
export default function ShareIndexPage() {
  const router = useRouter();
  const { setId } = useParams<{ setId: string }>();
  useEffect(() => {
    const raw = localStorage.getItem(pinStorageKey(`/share/${setId}`));
    const n = raw ? parseInt(raw, 10) : NaN;
    const page = !isNaN(n) && n > 0 ? n : 1;
    const spread =
      localStorage.getItem(SPREAD_MODE_KEY) === '1' &&
      window.matchMedia('(min-width: 1024px)').matches;
    router.replace(`/share/${setId}/${spread ? spreadUrl(page) : page}`);
  }, [router, setId]);
  return null;
}
