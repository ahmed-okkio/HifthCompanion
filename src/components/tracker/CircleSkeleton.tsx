import { Sk } from '@/components/Skeleton';

/**
 * Content skeleton for a circle view — mirrors TeacherCircle/StudentCircle's 3-col grid
 * (profile column, main column with tabs + cards, right aside). Shared by the tracker
 * index and [circleId] loading.tsx so clicking Circles shows an instant skeleton whether
 * the index redirects to a circle or renders directly. The header + rail live in the
 * (shell) layout and stay mounted; only this inner content shimmers.
 */
export default function CircleSkeleton() {
  return (
    <main className="px-4 py-6 w-full" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="max-w-[96rem] mx-auto w-full grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_300px] items-start">
        {/* Left: profile card + panel */}
        <div className="flex flex-col gap-3">
          <div className="card flex flex-col items-center gap-3" style={{ padding: 22 }}>
            <Sk w={64} h={64} r={32} />
            <Sk w={140} h={20} />
            <Sk w={100} h={14} />
          </div>
          <Sk h={48} r={12} />
        </div>

        {/* Middle: tab bar + card grid */}
        <div className="flex flex-col gap-6 min-w-0">
          <div className="flex gap-2">
            <Sk w={110} h={38} r={10} />
            <Sk w={110} h={38} r={10} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Sk key={i} h={72} r={16} />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Sk key={i} h={56} r={12} />
            ))}
          </div>
        </div>

        {/* Right aside */}
        <div className="hidden lg:flex flex-col gap-6">
          <Sk h={180} r={16} />
          <Sk h={120} r={16} />
        </div>
      </div>
    </main>
  );
}
