import SetsScreen from '@/components/SetsScreen';

/**
 * /sets — a user-agnostic static shell (PRD 0016 C2): sets are read client-side
 * through TanStack Query (SetsScreen). Auth and onboarding are enforced by the proxy.
 */
export default function SetsPage() {
  return <SetsScreen />;
}
