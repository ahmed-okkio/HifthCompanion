import table from './shellRewrites.json';

/**
 * PRD 0016 D3 for dynamic routes: visible pattern -> static route that serves it. The proxy
 * rewrites to it, build-shells ships its shell under the pattern, and the SW matches the pattern.
 * The page reads its segments from the visible URL after hydration (usePathname wrapper).
 *
 * One matching rule, shared with public/sw.js (matchRoute; src/tests/shellMatch.test.ts runs the
 * same cases against both): an exact key wins (so the literal "/tracker/covering" beats
 * "/tracker/:circleId"), else the first ":param" pattern, compiled with metacharacters escaped.
 */
const TABLE = table as Record<string, string>;
const PATTERNS = Object.keys(TABLE)
  .filter((p) => p.includes(':'))
  .map((p) => ({ re: new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^/]+')}$`), target: TABLE[p] }));

/** Static route serving this visible pathname, or null when it is not a mapped route. */
export function shellRewrite(pathname: string): string | null {
  if (Object.hasOwn(TABLE, pathname)) return TABLE[pathname];
  return PATTERNS.find((r) => r.re.test(pathname))?.target ?? null;
}
