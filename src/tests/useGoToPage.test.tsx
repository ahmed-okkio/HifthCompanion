import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useGoToPage } from '../hooks/useGoToPage';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => '/reader/1'),
  useSearchParams: vi.fn(() => new URLSearchParams('')),
}));

const w = window as any;

describe('useGoToPage', () => {
  let push: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    push = vi.fn();
    (useRouter as any).mockReturnValue({ push });
    (usePathname as any).mockReturnValue('/reader/1');
    (useSearchParams as any).mockReturnValue(new URLSearchParams(''));
    delete w.__hifthCanvasSkeletons;
    delete w.__hifthFlushReaderCanvas;
  });

  it('paints the skeleton before awaiting the flush, then pushes', async () => {
    const order: string[] = [];
    w.__hifthCanvasSkeletons = new Set([() => order.push('skeleton')]);
    let releaseFlush: () => void = () => {};
    w.__hifthFlushReaderCanvas = () =>
      new Promise<void>(resolve => { order.push('flush'); releaseFlush = resolve; });

    const { result } = renderHook(() => useGoToPage());
    let done: Promise<boolean>;
    await act(async () => { done = result.current.goToPage(50); });

    // The skeleton must already be up while the save is still in flight.
    expect(order).toEqual(['skeleton', 'flush']);
    expect(push).not.toHaveBeenCalled();

    await act(async () => { releaseFlush(); await done; });
    expect(push).toHaveBeenCalledWith('/reader/50', { scroll: false });
  });

  it('builds spread segments, keeps the query, and drops a stale ?page=', async () => {
    (useSearchParams as any).mockReturnValue(new URLSearchParams('set=abc&page=9'));
    const { result } = renderHook(() => useGoToPage({ isSpread: true }));
    await act(async () => { await result.current.goToPage(50); });
    expect(push).toHaveBeenCalledWith('/reader/49-50?set=abc', { scroll: false });
  });

  it('does not navigate to the page already open', async () => {
    (usePathname as any).mockReturnValue('/reader/50');
    const { result } = renderHook(() => useGoToPage());
    let navigated: boolean | undefined;
    await act(async () => { navigated = await result.current.goToPage(50); });
    expect(navigated).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('honours the share base path', async () => {
    const { result } = renderHook(() => useGoToPage({ basePath: '/share/s1' }));
    await act(async () => { await result.current.goToPage(700); });
    // 700 > TOTAL_PAGES, so it clamps to the last page.
    expect(push).toHaveBeenCalledWith('/share/s1/604', { scroll: false });
  });
});
