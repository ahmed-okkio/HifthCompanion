"use client";

import { useEffect } from "react";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

/** Tell the SW which locale's shell to serve (PRD 0016 D7). Resolves on ack, or after 1s. */
export function postLocale(locale: Locale): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return Promise.resolve();
  const { controller } = navigator.serviceWorker;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    setTimeout(resolve, 1000);
    controller.postMessage({ type: "locale", locale }, [channel.port2]);
  });
}

// M4-1: registers the service worker (public/sw.js), one registration URL per build (D2).
// Renders nothing — side-effect only. Guarded by feature detection so it is a
// no-op where service workers are unavailable (older browsers, some SSR hosts).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Never run the SW in development: Next's dev server serves freshly-hashed
    // chunks on every load, which a caching SW will fight with (reload loops).
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    // Ask for persistent storage so the browser never evicts the cached Mushaf pages under
    // storage pressure (or Safari's 7-day rule). Best-effort: a denial just keeps eviction possible.
    navigator.storage?.persist?.().catch(() => {});

    navigator.serviceWorker
      .register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`)
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // The cookie, not <html lang>: a shell-served page carries the SW's current guess.
        const m = document.cookie.match(new RegExp(String.raw`(?:^|;\s*)${LOCALE_COOKIE}=([^;]+)`));
        const locale = m?.[1];
        if (isLocale(locale)) reg.active?.postMessage({ type: "locale", locale });
      })
      .catch(() => {
        // Registration failure must never break the app — swallow silently.
      });
  }, []);

  return null;
}
