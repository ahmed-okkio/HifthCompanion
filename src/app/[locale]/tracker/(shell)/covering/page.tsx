import { CoveringScreen } from '@/components/tracker/screens';

/**
 * 0013 G1 — the substitute's own temporary "circle". A literal route: its exact
 * shellRewrites entry wins over "/tracker/:circleId" in the proxy, SW and build-shells.
 */
export default function CoveringPage() {
  return <CoveringScreen />;
}
