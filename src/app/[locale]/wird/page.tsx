import { Suspense } from 'react';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';
import WirdScreen, { WirdSkeleton } from '@/components/wird/WirdScreen';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const dict = getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: dict['wird.pageTitle'] };
}

/**
 * /wird — the daily screen. A user-agnostic static shell (PRD 0016 C2): the data
 * is read client-side through TanStack Query (WirdScreen). Suspense is only for
 * WirdPager's useSearchParams; auth is enforced by the proxy.
 */
export default function WirdPage() {
  return (
    <Suspense fallback={<WirdSkeleton />}>
      <WirdScreen />
    </Suspense>
  );
}
