import CircleSkeleton from '@/components/tracker/CircleSkeleton';

// Instant skeleton while a circle's server component runs its (many) fetches. The
// header + rail live in the (shell) layout and stay mounted; only the content shimmers.
export default function Loading() {
  return <CircleSkeleton />;
}
