"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// YouTube-style top loading strip. No Next-native equivalent and no lib installed,
// so we detect navigation starts by intercepting same-origin link clicks + back/forward,
// and end when the pathname/search actually change. Programmatic navs (router.push/
// replace) are caught by watching Next's RSC fetches for a different route. Server
// actions and same-route router.refresh() are skipped: their buttons show their own spinner.
// Mushaf page flips have their own skeleton (loading.tsx), so the strip would double up.
const mushafPrefix = (path: string) => path.match(/^\/(?:reader|share\/[^/]+)\/[^/]+$/) && path.slice(0, path.lastIndexOf("/"));
const isPageFlip = (from: string, to: string) => { const a = mushafPrefix(from); return !!a && a === mushafPrefix(to); };

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [inflight, setInflight] = useState(0);

  // Count in-flight RSC fetches that change route (not prefetches, not refreshes).
  useEffect(() => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const raw = input instanceof Request ? input.url : String(input);
      const tracked = h.has("RSC") && !h.has("Next-Router-Prefetch")
        && new URL(raw, location.href).pathname !== location.pathname
        && !isPageFlip(location.pathname, new URL(raw, location.href).pathname);
      if (!tracked) return orig(input, init);
      setInflight((n) => n + 1);
      return orig(input, init).finally(() => setInflight((n) => n - 1));
    };
    return () => { window.fetch = orig; };
  }, []);

  // Start on same-origin navigations.
  useEffect(() => {
    const start = () => setActive(true);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (isPageFlip(location.pathname, url.pathname)) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, []);

  // End when the route resolves. Brief delay so the fill animation reads.
  const [route, setRoute] = useState({ pathname, searchParams });
  if (route.pathname !== pathname || route.searchParams !== searchParams) {
    setRoute({ pathname, searchParams });
    setActive(false);
  }

  return (
    <div aria-hidden className={`top-progress ${active || inflight > 0 ? "top-progress--active" : ""}`} />
  );
}
