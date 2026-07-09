import CircleRail from './CircleRail';
import { railCircles } from '@/lib/tracker/railCircles';
import { getMyMembershipsWithCircle } from '@/lib/services/membership';

/**
 * Server component that fetches the viewer's circles and renders the rail. Streamed
 * via <Suspense> from the tracker (shell) layout so the memberships fetch doesn't block
 * the page's loading.tsx. Fallback: CircleRailFallback.
 */
export default async function CircleRailData() {
  return <CircleRail circles={railCircles(await getMyMembershipsWithCircle())} />;
}

/** Skeleton circle-rail column shown while CircleRailData streams. */
export function CircleRailFallback() {
  return (
    <nav className="flex justify-center w-full p-3 lg:h-full lg:w-auto lg:items-stretch lg:p-0" aria-hidden>
      <div
        className="flex flex-row lg:flex-col items-center gap-2 w-full lg:w-auto lg:h-full rounded-2xl lg:rounded-none border lg:border-y-0 lg:border-s-0"
        style={{
          padding: 'var(--space-8) var(--space-12)',
          background: 'var(--surface-main)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-e1)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(90deg, var(--neutral-100), var(--neutral-200), var(--neutral-100))',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s linear infinite',
            }}
          />
        ))}
      </div>
    </nav>
  );
}
