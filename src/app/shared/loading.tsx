import { Sk } from '@/components/Skeleton';

// Instant skeleton for /shared — header (title/subtitle + count badge) + shared-set rows.
export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 w-full" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col gap-2">
          <Sk w={180} h={22} />
          <Sk w={240} h={13} />
        </div>
        <Sk w={64} h={24} r={999} />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Sk key={i} h={52} r={16} />
        ))}
      </div>
    </main>
  );
}
