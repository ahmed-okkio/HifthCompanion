# 0016 build log

## Phase 2: cacheComponents + `/wird` spike (commit 65729b4)

### Verdict: E1 NO-GO

Vercel's CDN rejects a browser-originated PPR resume POST. The shell + postponedState pipeline works,
the SW precaches it, and the fallback works. The resume request never reaches the function.

Preview: `https://hifth-companion-dfz7a5ry1-okkio-s-projects.vercel.app` (deployment
`dpl_Fd4QDmiFMy2dyUd8ZhpuU5AjMfmF`, build `ZVavR9lTBcjiIzHeZZzt6`). No Vercel Authentication on it.

`POST /wird` with `next-resume: 1` and the build's postponedState as the body:

| Variant | Result |
|---|---|
| no content-type (what the SW sends: Blob body) | **405**, `X-Vercel-Cache: HIT`, `X-Matched-Path: /en/wird`, empty body |
| `text/plain` (fetch default for a string body) | 405 HIT |
| `application/x-www-form-urlencoded` | 405 HIT |
| + `x-deployment-id: <dpl>` or `?dpl=<dpl>` (skew pin) | 405 |
| `multipart/form-data` | 500 MISS, full HTML document (server-action path) |
| `next-action: 0` | 404 BYPASS |
| `POST /en/wird` (internal path) | 404 |

The edge answers POSTs to the prerendered PPR route from cache and returns 405 for them. The resume
protocol is only reachable from Vercel's own CDN-to-function hop, not from a client.

### Browser evidence

A real Chromium (Playwright `chromium.launch`) ran against the preview, logged out:
- SW installed and controlling the page. Caches: `hc-shell-v2`, `hc-ppr-ZVavR9lTBcjiIzHeZZzt6`, `hc-static-v1`.
- Shell manifest in the cache: `{buildId, dpl: "dpl_Fd4Q…", locales: [en, ar], routes: ["/wird"], resumeOk: false}`.
  The install-time probe saw the 405 and turned the shell path off.
- The browser's own resume POST: `{status: 405, x-vercel-cache: "HIT", length: 0}`.
- Reload of `/wird`: answered by the SW (`fromServiceWorker: true`) through the **network fallback** (D5).
  Status 200, then the normal redirect to `/login`.
- D1: 37/37 `/_next/static/*` responses on the reload came from the SW.
- Console: only two pre-existing 500s (unauthenticated `saveTimezone` server-action POST; production shows the same).
- Screenshot: `docs/prd/0016-evidence/e1-preview-wird.png`.

chrome-agent was not used. Playwright's bundled Chromium gave scripted access to
`fromServiceWorker()` and CacheStorage in fewer steps. It is the same engine.

### What does work (local `next start`)

- `next build` with `cacheComponents` reports every app route as ◐ Partial Prerender.
- **Where the shell lives** (no adapter needed): `.next/server/app/{locale}/{route}.html` is the
  shell. It ends after the bootstrap `<script>` with body/html still open. `.next/server/app/{locale}/{route}.meta`
  (JSON) has `postponed`. `scripts/build-shells.mjs` runs after `next build` and copies both to
  `public/_shell/{buildId}/{locale}/` plus `public/_shell/manifest.json` (with `VERCEL_DEPLOYMENT_ID`).
  Vercel serves these files.
- Shell + resume response (holes only, ends with `</body></html>`) is **byte-identical** to the normal
  GET. When the server honours the resume, the SW-concatenated document hydrates correctly: one
  `<main>`, all boundaries resolved, no console errors.
- `next start` caveat: outside minimal mode, Next only honours `next-resume` on POSTs it treats as
  possible server actions (`application/x-www-form-urlencoded`). Any other content-type gets the full
  document. The SW probe detects that (`<!doctype` prefix) and stays on network.

### Other findings

- Under `cacheComponents` the prerendered shell sees the internal `/{locale}/x` path from
  `usePathname()`, while the client sees `/x`. That caused hydration error #418 on every page and
  wiped input typed before hydration. Fixed with `src/lib/i18n/usePathname.ts`, which strips the hidden locale.
- Next keeps the previous route mounted in a hidden `<Activity>`. Loose text locators in e2e can match
  the hidden page (fixed one in tracker.spec).

### Options after NO-GO (author decision)

1. PRD fallback: keep D1 only (shipped) and continue with Phases 1 and 3 for in-app navigation
   (static shells from the CDN already make the server-side path fast). Drop D2–D7 SW resume.
2. Have the SW do a GET for the whole page instead of a resume. The document must still be
   one stream, so a cached shell can't be combined with a fresh full page. This means no instant cold launch.
3. Raise it with Vercel (POST to PPR route is 405 at the edge) or self-host. Out of scope.
