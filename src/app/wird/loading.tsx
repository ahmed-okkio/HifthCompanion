import { Sk } from '@/components/Skeleton';

// Instant skeleton for /wird — a single centred card standing in for the pager.
export default function Loading() {
  return (
    <main className="w-full h-full flex flex-col items-center" style={{ overflowY: 'auto' }}>
      <div className="w-full flex flex-col items-center px-4 pt-8" style={{ maxWidth: 520 }}>
        <div className="w-full flex flex-col gap-2 mb-6">
          <Sk w={120} h={24} />
          <Sk w={160} h={13} />
        </div>
        <Sk w="100%" h={360} r={20} />
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map((i) => <Sk key={i} w={8} h={8} r={999} />)}
        </div>
      </div>
    </main>
  );
}
