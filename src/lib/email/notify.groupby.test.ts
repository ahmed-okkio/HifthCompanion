import { describe, it, expect } from 'vitest';

// ponytail: guards the one bit of real logic in notifySubstitution — the
// map-group idiom that fans assignments out to one email per key. A broken
// idiom (dropping rows / wrong key) is how a student silently misses their
// sub notice. Mirrors the exact expression used in notify.ts.
function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const g = new Map<string, T[]>();
  for (const r of rows) (g.get(key(r)) ?? g.set(key(r), []).get(key(r))!).push(r);
  return g;
}

describe('substitution grouping', () => {
  it('groups every row under its key, none dropped', () => {
    const rows = [
      { sub: 'A', at: '1' },
      { sub: 'A', at: '2' },
      { sub: 'B', at: '3' },
    ];
    const g = groupBy(rows, (r) => r.sub);
    expect(g.size).toBe(2);
    expect(g.get('A')!.map((r) => r.at)).toEqual(['1', '2']);
    expect(g.get('B')!.map((r) => r.at)).toEqual(['3']);
    expect([...g.values()].flat()).toHaveLength(rows.length);
  });
});
