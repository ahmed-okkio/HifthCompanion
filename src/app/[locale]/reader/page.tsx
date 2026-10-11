'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { spreadUrl } from '@/lib/quran';
import { SPREAD_MODE_KEY } from '@/components/SpreadToggle';

export default function ReaderIndexPage() {
  const router = useRouter();
  useEffect(() => {
    const raw = localStorage.getItem('pinnedSurahPage');
    const n = raw ? parseInt(raw, 10) : NaN;
    const page = !isNaN(n) && n > 0 ? n : 1;
    // Honor the persisted double-page preference (desktop only) so the bookmarked surah
    // opens directly as a spread instead of flashing single-page first.
    const spread =
      localStorage.getItem(SPREAD_MODE_KEY) === '1' &&
      window.matchMedia('(min-width: 1024px)').matches;
    router.replace(`/reader/${spread ? spreadUrl(page) : page}`);
  }, [router]);
  return null;
}
