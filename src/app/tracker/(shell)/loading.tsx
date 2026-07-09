import CircleSkeleton from '@/components/tracker/CircleSkeleton';

// Instant skeleton for the tracker INDEX (/tracker). Without this, clicking the Circles
// nav item had no loading boundary while the index awaited memberships + redirected to
// the first circle — so nothing showed (not even the rail fallback) until it resolved.
export default function Loading() {
  return <CircleSkeleton />;
}
