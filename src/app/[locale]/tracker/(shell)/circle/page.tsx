import { CircleScreen } from '@/components/tracker/screens';

/** Static shell for every /tracker/<circleId> (proxy rewrite, src/lib/shellRewrites.json). */
export default function CirclePage() {
  return <CircleScreen />;
}
