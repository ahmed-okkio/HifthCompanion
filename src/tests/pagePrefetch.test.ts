import { describe, it, expect, beforeEach, vi } from 'vitest';

import { prefetchPageImages } from '@/lib/pagePrefetch';

/** Captures the src of every Image the prefetcher creates, and drives the chain by hand. */
function installImageSpy() {
  const requested: string[] = [];
  let pending: (() => void) | null = null;
  class FakeImage {
    crossOrigin = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(v: string) {
      requested.push(v);
      pending = () => this.onload?.();
    }
  }
  vi.stubGlobal('Image', FakeImage);
  // requestIdleCallback isn't in jsdom; the module falls back to setTimeout, which fake
  // timers drive. Flush one link of the chain per call.
  const step = () => { vi.runOnlyPendingTimers(); const p = pending; pending = null; p?.(); };
  return { requested, step };
}

const page = (url: string) => Number(url.match(/(\d+)\.png$/)![1]);

describe('prefetchPageImages', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('fetches nearest-first in both directions, clamped to the Mushaf, never twice', () => {
    const { requested, step } = installImageSpy();

    prefetchPageImages(3, 3);
    for (let i = 0; i < 10; i++) step();

    // 3 itself, then ±1, ±2, ±3 — page 0 and below don't exist.
    expect(requested.map(page)).toEqual([3, 4, 2, 5, 1, 6]);

    // A second pass over an overlapping window only fetches what's new.
    requested.length = 0;
    prefetchPageImages(4, 3);
    for (let i = 0; i < 10; i++) step();
    expect(requested.map(page)).toEqual([7]);
  });

  it('clamps at the end of the Mushaf', () => {
    const { requested, step } = installImageSpy();
    prefetchPageImages(603, 3);
    for (let i = 0; i < 10; i++) step();
    expect(requested.map(page)).toEqual([603, 604, 602, 601, 600]);
  });
});
