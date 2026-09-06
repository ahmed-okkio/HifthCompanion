/* HifthCompanion service worker: offline app shell + a permanent Mushaf page cache.
   The page PNGs are content-immutable (604 fixed files) but Supabase storage serves them
   with `cache-control: no-cache`, so the HTTP cache revalidates every single one on every
   page flip. Cache-first out of CacheStorage skips the network entirely — a page already
   read stays instant until the user clears site data. */

const CACHE_VERSION = "hc-shell-v2";
const SHELL_URLS = ["/", "/offline"];

/* Mushaf page imagery. Kept in its own cache so a shell version bump never evicts 70MB of
   already-downloaded pages. Cross-origin (Supabase storage), matched on path not host so a
   storage move doesn't need a SW edit. */
const PAGE_CACHE = "hc-pages-v1";
const PAGE_IMAGE_RE = /\/storage\/v1\/object\/public\/[^/]*tajweed[^/]*\/\d+\.png$/;

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
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION && k !== PAGE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; never interfere with auth/POST/etc.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Mushaf pages: CACHE-FIRST, no expiry. Handled before the same-origin gate because the
  // images live on Supabase storage. A hit never touches the network; a miss stores the
  // response for good. Only `ok` (CORS) responses are stored — an opaque no-cors response
  // can't be validated and pads the quota, so it falls through uncached.
  if (PAGE_IMAGE_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(PAGE_CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone()).catch(() => {});
              return response;
            })
        )
      )
    );
    return;
  }

  // Same-origin only.
  if (url.origin !== self.location.origin) return;

  // Navigation requests: NETWORK-FIRST. Always serve the live page so route
  // changes and updated build chunks load correctly; only fall back to the
  // cached shell when the network is unavailable. (Cache-first here caused an
  // infinite reload loop: a stale cached "/" referenced old build chunks, Next
  // forced a version-mismatch reload, which re-served the same stale "/".)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Refresh the offline fallback copy of the app shell in the background.
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match("/offline").then((m) => m || caches.match("/")))
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
