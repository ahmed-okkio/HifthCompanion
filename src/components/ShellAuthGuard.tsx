"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isProtected } from "@/lib/protectedPaths";

/** Redirect only with no stored auth token at all: a stored session whose refresh failed on a
 *  flaky network is still that user's (the server re-checks on the next proxied request). */
export function shouldRedirect(hasSession: boolean, cookie: string): boolean {
  return !hasSession && !/(?:^|;\s*)sb-[^=]*auth-token/.test(cookie);
}

/**
 * PRD 0016 E8 [SEC]: a shell served by the service worker never passes the proxy, so the
 * client re-checks the session. Online with no session -> /login?next=. Offline keeps the
 * shell (cached data is bound to the last user id; no session means none is restored).
 */
export function ShellAuthGuard() {
  useEffect(() => {
    const { pathname, search } = window.location;
    // Only a SW-controlled page can be a shell; uncontrolled loads came through the proxy.
    if (!navigator.serviceWorker?.controller || !isProtected(pathname) || !navigator.onLine) return;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!shouldRedirect(!!data.session, document.cookie)) return;
        window.location.replace(`/login?next=${encodeURIComponent(pathname + search)}`);
      })
      .catch(() => {});
  }, []);
  return null;
}
