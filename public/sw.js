/* HifthCompanion service worker — M4-1: offline app shell only.
   Scope is deliberately narrow: pre-cache the app shell + an offline fallback,
   serve cached navigations when the network is unavailable. We do NOT cache
   quran-pages images or bulk data here — that is deferred (M4-3). */

const CACHE_VERSION = "hc-shell-v1";
const SHELL_URLS = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {
        // Best-effort: if "/offline" route is absent the install must still
        // succeed so navigations can fall back to the cached "/".
        return caches.open(CACHE_VERSION).then((cache) => cache.add("/"));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; never interfere with auth/POST/etc.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only.
  if (url.origin !== self.location.origin) return;

  // Never cache the heavy page imagery or data — out of M4-1 scope.
  if (url.pathname.startsWith("/quran-pages/")) return;

  // Navigation (app shell) requests: cache-first, fall back to network, then
  // to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).catch(
          () => caches.match("/offline") || caches.match("/")
        );
      })
    );
    return;
  }
});

/* M4-3: Web Push. Payload is JSON {title, body, url}. We keep parsing tolerant
   so a malformed/empty push still surfaces a generic notification. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "HifthCompanion";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing tab on the target path if one is open.
        for (const client of clients) {
          if (client.url.includes(target) && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
