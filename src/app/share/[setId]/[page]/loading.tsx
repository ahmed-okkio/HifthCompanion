// Same segment-level Suspense boundary the reader has (reader/[page]/loading.tsx), for the
// same reason: without it a share page turn awaits the whole dynamic segment — capability
// resolve + both pages' notes — before the router commits, so the flip feels like a load.
// With it the persistent ReaderShell + Fabric canvas swap instantly and only the notes
// column shimmers.
export { default } from '@/app/reader/[page]/loading';
