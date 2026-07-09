import { Sk } from '@/components/Skeleton';

// Instant skeleton for /sets — mirrors the header (title/subtitle + count badge)
// and the SetsList rows.
export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 w-full" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col gap-2">
          <Sk w={160} h={22} />
          <Sk w={220} h={13} />
        </div>
        <Sk w={64} h={24} r={999} />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Sk key={i} h={64} r={16} />
        ))}
      </div>
    </main>
  );
}
