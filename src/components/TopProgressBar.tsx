"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// YouTube-style top loading strip. No Next-native equivalent and no lib installed,
// so we detect navigation starts by intercepting same-origin link clicks + back/forward,
// and end when the pathname/search actually change.
// ponytail: click-intercept covers Link + <a>; router.push() calls won't trigger it —
// wire a manual start() if programmatic navs need the bar later.
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);

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
  useEffect(() => {
    setActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <div aria-hidden className={`top-progress ${active ? "top-progress--active" : ""}`} />
  );
}
