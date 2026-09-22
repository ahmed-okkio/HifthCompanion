import { Sk } from '@/components/Skeleton';

// Instant skeleton for /wird — a single centred card standing in for the pager.
// Sized like the pager (flex-1, min-h-0, clipped), never by its content: a
// fixed-height skeleton could outgrow a short screen and leave the page
// scrolled after a pull-to-refresh.
export default function Loading() {
  return (
    <main className="w-full flex-1 min-h-0 flex flex-col items-center" style={{ overflow: 'hidden' }}>
      <div className="w-full flex-1 min-h-0 flex flex-col items-center px-4 pt-8 pb-4" style={{ maxWidth: 520 }}>
        <div className="w-full flex flex-col gap-2 mb-6">
          <Sk w={120} h={24} />
          <Sk w={160} h={13} />
        </div>
        <Sk w="100%" h="100%" r={20} style={{ flex: '1 1 0', minHeight: 0, maxHeight: 360 }} />
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map((i) => <Sk key={i} w={8} h={8} r={999} />)}
        </div>
      </div>
    </main>
  );
}
