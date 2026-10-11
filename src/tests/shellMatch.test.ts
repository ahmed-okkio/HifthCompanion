import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { shellRewrite } from '@/lib/shellRewrites';
import table from '@/lib/shellRewrites.json';

// One matching rule (PRD 0016 M6): the SW's matchRoute (public/sw.js, between the
// <shell-match> markers) and the proxy's shellRewrite must agree on every case.
const sw = readFileSync('public/sw.js', 'utf8');
const src = sw.slice(sw.indexOf('// <shell-match>'), sw.indexOf('// </shell-match>'));
const matchRoute = new Function(`${src}; return matchRoute;`)() as (r: Record<string, string>, p: string) => string | null;

const CASES: [string, string | null][] = [
  ['/reader/9', '/reader/view'],
  ['/reader/9-10', '/reader/view'],
  ['/reader', null],
  ['/tracker', '/tracker'],
  ['/tracker/covering', '/tracker/covering'], // literal beats /tracker/:circleId
  ['/tracker/abc-123', '/tracker/circle'],
  ['/tracker/abc/student/m1', '/tracker/student'],
  ['/tracker/abc/student', null],
  ['/tracker/join/code1', null],
  ['/tracker/a/b', null],
  ['/sets', null],
  ['/shared', '/shared'],
  ['/settings', '/settings'],
  ['/install', '/install'],
  ['/settings/x', null],
  ['/share/abc', '/share/set'],
  ['/share/abc/9', '/share/view'],
  ['/share/abc/9-10', '/share/view'],
  ['/share', null],
  ['/share/abc/9/x', null],
];

describe('shell route matching', () => {
  it.each(CASES)('%s -> %s (proxy and SW agree)', (path, want) => {
    expect(shellRewrite(path)).toBe(want);
    expect(matchRoute(table, path)).toBe(want);
  });

  it('escapes regex metacharacters in patterns', () => {
    const t = { '/a.b/:id': 'x', '/c+/:id': 'y' };
    expect(matchRoute(t, '/a.b/1')).toBe('x');
    expect(matchRoute(t, '/aXb/1')).toBeNull();
    expect(matchRoute(t, '/c+/1')).toBe('y');
    expect(matchRoute(t, '/cc/1')).toBeNull();
  });
});
