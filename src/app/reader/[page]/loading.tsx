// Segment-level Suspense boundary for the notes column. Without this, a page turn
// re-suspends this async segment and the fallback bubbles up to the reader layout's
// <Suspense fallback={ReaderShellSkeleton}> — flashing the ENTIRE shell (nav rail,
// surah sidebar, canvas). Scoping the boundary here keeps the persistent shell +
// Fabric canvas mounted; only the right-hand notes column swaps on navigation.
const SHIMMER: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0.08) 50%, rgba(15,23,42,0.04) 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s linear infinite',
  borderRadius: 'var(--radius-md, 8px)',
};

export default function NotesColumnLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:self-stretch lg:min-h-0 lg:max-h-full lg:overflow-y-auto lg:pr-1">
      <div style={{ ...SHIMMER, height: 180, width: '100%' }} />
      <div style={{ ...SHIMMER, height: 96, width: '100%' }} />
    </div>
  );
}
