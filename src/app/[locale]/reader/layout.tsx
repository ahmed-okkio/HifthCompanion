import ReaderLayoutClient from '@/components/ReaderLayoutClient';

/**
 * Reader layout: a user-agnostic static shell (PRD 0016 C2/C4). User, sets and chrome are
 * read client-side (ReaderLayoutClient); auth + onboarding stay with the proxy. Sits ABOVE
 * the [page] segment, so page turns keep the canvas mounted.
 */
export default function ReaderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ReaderLayoutClient>{children}</ReaderLayoutClient>;
}
