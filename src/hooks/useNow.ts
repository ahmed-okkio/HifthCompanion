import { useEffect, useState } from 'react';
import { useClientValue } from '@/hooks/useClientValue';

/** Presentational wall clock: null during SSR + hydration (first render matches the
 *  server's), then the mount time, refreshed every `ms` while `enabled`. */
export function useNow(ms: number, enabled = true): Date | null {
  const [mountClock] = useState(() => new Date());
  const [ticked, setTicked] = useState<Date | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setTicked(new Date());
    const first = setTimeout(tick);
    const id = setInterval(tick, ms);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [ms, enabled]);
  return useClientValue(() => ticked ?? mountClock, null);
}
