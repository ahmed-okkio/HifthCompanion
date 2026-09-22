import { describe, it, expect } from 'vitest';
import { orderWirdViews } from '@/lib/wirdRate';

// O4a: the H5a ordering rule — outstanding first in creation order, then
// done-today — including that completing a wird moves it after the outstanding
// ones on the next load.

const v = (id: string, done_today: boolean) => ({ id, done_today });

describe('orderWirdViews (H5a / O4a)', () => {
  it('keeps outstanding first in creation order, done-today after', () => {
    const views = [v('a', false), v('b', true), v('c', false), v('d', true)];
    expect(orderWirdViews(views).map((w) => w.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('preserves creation order within each group', () => {
    const views = [v('a', true), v('b', false), v('c', true), v('d', false)];
    // outstanding b, d (creation order) then done a, c (creation order)
    expect(orderWirdViews(views).map((w) => w.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('all outstanding: order unchanged', () => {
    const views = [v('a', false), v('b', false)];
    expect(orderWirdViews(views).map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('completing a wird moves it after the outstanding ones on the next load', () => {
    // First load: three outstanding, creation order a, b, c.
    const before = [v('a', false), v('b', false), v('c', false)];
    expect(orderWirdViews(before).map((w) => w.id)).toEqual(['a', 'b', 'c']);

    // 'a' is completed today → its done_today flips. Next load re-orders.
    const after = before.map((w) => (w.id === 'a' ? v('a', true) : w));
    expect(orderWirdViews(after).map((w) => w.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const views = [v('a', true), v('b', false)];
    const snapshot = views.map((w) => w.id);
    orderWirdViews(views);
    expect(views.map((w) => w.id)).toEqual(snapshot);
  });
});
