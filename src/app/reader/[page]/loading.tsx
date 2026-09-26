// Segment-level Suspense boundary for the notes column. Without this, a page turn
// re-suspends this async segment and the fallback bubbles up to the reader layout's
// <Suspense fallback={ReaderShellSkeleton}> — flashing the ENTIRE shell (nav rail,
// surah sidebar, canvas). Scoping the boundary here keeps the persistent shell +
// Fabric canvas mounted; only the right-hand notes column swaps on navigation.
const SHIMMER = 'w-full rounded-md skeleton';

export default function NotesColumnLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:self-stretch lg:min-h-0 lg:max-h-full lg:overflow-y-auto lg:pr-1">
      <div className={`${SHIMMER} h-45`} />
      <div className={`${SHIMMER} h-24`} />
    </div>
  );
}
