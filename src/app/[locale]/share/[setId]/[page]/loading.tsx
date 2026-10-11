// Segment-level Suspense boundary for the notes column: without it a share page turn awaits
// the whole dynamic segment (capability resolve + both pages' notes) before the router
// commits. With it the persistent ReaderShell + Fabric canvas swap instantly and only the
// notes column shimmers. (Was re-exported from reader/[page]/loading.tsx, removed in 0016 M5.)
const SHIMMER = 'w-full rounded-md skeleton';

export default function NotesColumnLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:self-stretch lg:min-h-0 lg:max-h-full lg:overflow-y-auto lg:pr-1">
      <div className={`${SHIMMER} h-45`} />
      <div className={`${SHIMMER} h-24`} />
    </div>
  );
}
