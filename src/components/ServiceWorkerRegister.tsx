"use client";

import { useEffect } from "react";

// M4-1: registers the offline app-shell service worker (public/sw.js).
// Renders nothing — side-effect only. Guarded by feature detection so it is a
// no-op where service workers are unavailable (older browsers, some SSR hosts).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure must never break the app — swallow silently.
    });
  }, []);

  return null;
}
