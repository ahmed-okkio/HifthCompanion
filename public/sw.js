/* HifthCompanion service worker: offline app shell + a permanent Mushaf page cache.
   The page PNGs are content-immutable (604 fixed files) but Supabase storage serves them
   with `cache-control: no-cache`, so the HTTP cache revalidates every single one on every
   page flip. Cache-first out of CacheStorage skips the network entirely — a page already
   read stays instant until the user clears site data. */

// Per-build (PRD 0016 D2): registered as /sw.js?v=<buildId>; this build's shells + offline page.
const BUILD_ID = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_VERSION = `hc-shell-${BUILD_ID}`;
const SHELL_BASE = `/_shell/${BUILD_ID}`;
// User's locale, posted by the page (D7; cookieStore is not in Safari). Survives build swaps.
const LOCALE_CACHE = "hc-locale";
const LOCALE_KEY = "/__hc-locale";
const DEFAULT_LOCALE = "en";
// Static, user-agnostic page only. Never cache authenticated HTML: "/" redirects signed-in
// users to their own pages, and a cached copy would leak to the next user on the device.
const OFFLINE_URL = "/offline.html";

/* Mushaf page imagery. Kept in its own cache so a shell version bump never evicts 70MB of
   already-downloaded pages. Cross-origin (Supabase storage), matched on path not host so a
   storage move doesn't need a SW edit. */
const PAGE_CACHE = "hc-pages-v1";
// Hashed build assets: content-addressed, so cache-first is always correct. ponytail: grows across deploys; bump this name to purge.
const STATIC_CACHE = "hc-static-v1";
const PAGE_IMAGE_RE = /\/storage\/v1\/object\/public\/[^/]*tajweed[^/]*\/\d+\.png$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        await cache.add(new Request(OFFLINE_URL, { credentials: "omit" })).catch(() => {});
        // Shells are user-agnostic static files (D6): fetched without cookies. ponytail: a failed
        // shell fetch just leaves that route network-first; no retry until the next build.
        const manifest = await fetch(`${SHELL_BASE}/manifest.json`, { credentials: "omit" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (!manifest) return;
        await cache.put(`${SHELL_BASE}/manifest.json`, new Response(JSON.stringify(manifest)));
        // Skew: precache each shell's own /_next/static assets first (a later deploy may 404 them).
        // One fetch per URL, shared across shells; a shell is cached (= served) only when all of its
        // assets are, otherwise its route stays network-first.
        const statics = await caches.open(STATIC_CACHE);
        const fetched = new Map();
        const precache = (u) => {
          if (!fetched.has(u))
            fetched.set(
              u,
              statics.match(u).then((hit) =>
                hit ? true : statics.add(new Request(u, { credentials: "omit" })).then(() => true, () => false)
              )
            );
          return fetched.get(u);
        };
        await Promise.all(
          manifest.locales.flatMap((locale) =>
            Object.values(manifest.routes).map(async (file) => {
              const ok = await Promise.all((manifest.assets?.[`${locale}/${file}`] || []).map(precache));
              if (!ok.every(Boolean)) return;
              await cache.add(new Request(`${SHELL_BASE}/${locale}/${file}`, { credentials: "omit" })).catch(() => {});
            })
          )
        );
      })
      .catch(() => {}) // best-effort: install must still succeed
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
            .filter((k) => ![CACHE_VERSION, PAGE_CACHE, STATIC_CACHE, LOCALE_CACHE].includes(k))
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

  // /_next/static: CACHE-FIRST (immutable hashed filenames, no user data).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
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

  // Navigation requests: NETWORK-FIRST. Always serve the live page so route
  // changes and updated build chunks load correctly; only fall back to the
  // cached shell when the network is unavailable. (Cache-first here caused an
  // infinite reload loop: a stale cached "/" referenced old build chunks, Next
  // forced a version-mismatch reload, which re-served the same stale "/".)
  //
  // Exception (D3): routes with a shell for this build are answered CACHE-FIRST from the shell.
  // Safe from that loop: the shell and its chunks belong to this SW's own build.
  if (request.mode === "navigate") {
    const network = () =>
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((m) => m || Response.error()));
    event.respondWith(shellFor(url.pathname).catch(() => null).then((shell) => shell || network()));
    return;
  }
});

async function shellFor(pathname) {
  const cache = await caches.open(CACHE_VERSION);
  const manifestRes = await cache.match(`${SHELL_BASE}/manifest.json`);
  if (!manifestRes) return null;
  const { routes } = await manifestRes.json();
  const path = pathname.replace(/\/+$/, "") || "/";
  // Exact route, else a dynamic pattern ("/reader/:page", src/lib/shellRewrites.json).
  const file =
    routes[path] ||
    Object.entries(routes).find(([p]) => p.includes(":") && new RegExp(`^${p.replace(/:[^/]+/g, "[^/]+")}$`).test(path))?.[1];
  if (!file) return null;
  const stored = await caches.open(LOCALE_CACHE).then((c) => c.match(LOCALE_KEY));
  const locale = (stored && (await stored.text())) || DEFAULT_LOCALE;
  return cache.match(`${SHELL_BASE}/${locale}/${file}`);
}

// Page -> SW: {type: "locale", locale}. Acks on the transferred port so the page can reload after.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "locale" || !/^(en|ar)$/.test(data.locale)) return;
  event.waitUntil(
    caches
      .open(LOCALE_CACHE)
      .then((c) => c.put(LOCALE_KEY, new Response(data.locale)))
      .finally(() => event.ports[0] && event.ports[0].postMessage("ok"))
  );
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
