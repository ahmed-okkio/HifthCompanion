import table from './shellRewrites.json';

/**
 * PRD 0016 D3 for dynamic routes: visible pattern -> static route that serves it. The proxy
 * rewrites to it, build-shells ships its shell under the pattern, and the SW matches the pattern.
 * The page reads its segments from the visible URL after hydration (usePathname wrapper).
 * M6/M7 add entries here (e.g. "/tracker/:circleId": "/tracker/circle").
 */
const RULES = Object.entries(table as Record<string, string>).map(([pattern, target]) => ({
  re: new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`),
  target,
}));

/** Static route serving this visible pathname, or null when it is not a mapped dynamic route. */
export function shellRewrite(pathname: string): string | null {
  return RULES.find((r) => r.re.test(pathname))?.target ?? null;
}
