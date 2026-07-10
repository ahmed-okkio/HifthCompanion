'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Gates the circle rail's reveal on the circle CONTENT being ready, so the whole view
 * appears together on first open instead of the (fast/cached) rail popping in before the
 * (slow) circle content. The rail shows a skeleton until MarkCircleReady mounts.
 *
 * Latches true and stays true: once past the first reveal, navigating BETWEEN circles
 * keeps the rail real (no re-skeleton) — the content skeleton (loading.tsx) covers that
 * case. Leaving the tracker unmounts this provider, so a later re-entry gates again.
 */
const CircleReadyContext = createContext<{ ready: boolean; markReady: () => void }>({
  ready: false,
  markReady: () => {},
});

export function CircleReadyProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  return <CircleReadyContext.Provider value={{ ready, markReady }}>{children}</CircleReadyContext.Provider>;
}

export function useCircleReady() {
  return useContext(CircleReadyContext);
}

/** Rendered by each circle page's content: signals the rail it can reveal. */
export default function MarkCircleReady() {
  const { markReady } = useCircleReady();
  useEffect(() => markReady(), [markReady]);
  return null;
}
