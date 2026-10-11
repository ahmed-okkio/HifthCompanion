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

### Outcome (2026-10-11)

Author chose a new architecture (PRD v2). Branch rebased onto master (SW hotfix 9063f6e). SW resume
code, `scripts/build-shells.mjs` and its `.gitignore`/`package.json` hooks removed; `sw.js` keeps the
hotfix (no authenticated HTML cached) plus `/_next/static` cache-first. Full e2e: 86 passed, 1 flaky
(`tracker.spec.ts:19`, passed on retry).

## Milestone ladder (v2)

Serial slices; each ends with tsc + build:check + test + the area e2e, and its contract IDs PASS.

| M | Goal | Files likely touched | Contract IDs |
|---|------|----------------------|--------------|
| M1 | Query infra: `QueryClientProvider` + IndexedDB persister, buster `${userId}:${buildId}`, discard on mismatch, clear on logout/user switch; e2e mock data path decided (PRD dec. 17) | `package.json` (`@tanstack/react-query`, `@tanstack/react-query-persist-client`, `idb-keyval`), `src/lib/query/{client,persist,keys}.ts`, `src/app/[locale]/layout.tsx`, `src/components/ProfileMenu.tsx` (signOut), `src/lib/supabase/{client,mock}.ts`, Vitest | E5, E6, E7 (unit), F3 (persist part) |
| M2 | Convert `/wird` (+ `/wird/manage`): client data sections, skeleton only without cache, mutations invalidate; route becomes a complete static shell | `src/app/[locale]/wird/**`, wird components/actions, `src/tests/e2e/wird*.spec.ts` | C2–C4, C6, E1–E4, E9, E10 (wird) |
| M3 | Static shell per route + offline: postbuild shell copy with postponed-check, per-build SW registration, shell precache, cache-first shell navigations, purge, locale postMessage, client auth redirect on shell launch | `scripts/build-shells.mjs` (new version), `package.json`, `.gitignore`, `public/sw.js`, SW registration component, `playwright.config.ts` (`pwa` project, `serviceWorkers:'block'` elsewhere) | C5, D2–D9, E8, F1 |
| M4 | Convert `/sets` | `src/app/[locale]/sets/**`, sets components | C2–C4, C6, E1–E4, E9 (sets) |
| M5 | Convert `/reader` + `/reader/[page]` (params client-side) | `src/app/[locale]/reader/**`, `ReaderShell`, annotation hooks | same (reader) |
| M6 | Convert `/tracker/**` (resolves B3 for tracker layouts) | `src/app/[locale]/tracker/**`, `src/components/tracker/**` | same + B3 (tracker) |
| M7 | Convert `/share/**` + `/shared` (resolves B3 for share layout) | `src/app/[locale]/share/**`, `shared/**` | same + B3 (share) |
| M8 | Convert `/settings`, `/install` | those routes | same |
| M9 | `pwa` e2e area + flaky tracker fixes (`tracker.spec.ts:41`, `:109`, `:19`) | `src/tests/e2e/pwa.spec.ts`, `tracker.spec.ts`, `package.json` (`test:e2e:pwa`) | F2a–F2e, F4 |
| M10 | Final verification on a Vercel preview from a real browser (cold launch offline, user switch) | build log evidence | all, F5 |

## Known gaps / M10 checks

- **Onboarding gate skipped on deep-link shell launch.** A SW-served shell never passes the proxy, so a user who has not finished onboarding and opens `/wird` (or `/wird/manage`) directly lands on the shell, not the onboarding redirect. ShellAuthGuard only checks for a stored session.
- **Vercel build command must be `package.json` `build`** (it runs `build-shells`). Check the deploy build log for the `build-shells: N routes x 2 locales, M assets -> public/_shell/<buildId>` line, and that `/_shell/<buildId>/manifest.json` returns 200 on the deployment.
- **Skew Protection.** Enable and verify Vercel Skew Protection. The SW now precaches each shell's `/_next/static` assets (manifest `assets`) and serves a shell only if all of them are cached, but lazy chunks loaded after boot (not referenced in the shell HTML) can still 404 after a deploy without it.
- **Offline cold launch after redeploy.** Verify on a device: install build N, deploy N+1, go offline before the N+1 SW installs, cold-launch a shell route. The N shell plus its precached chunks should still boot.
- **`hc-static-v1` grows without bound.** Hashed assets from every build accumulate and nothing evicts them. Purge by renaming the cache, or prune entries not in the current manifest on activate.
- **Dynamic routes via static shell routes (M5, author decision "SW maps to parent").** A `[page]` fallback
  prerender under `cacheComponents` keeps unfilled `P:` holes (`usePathname`/`useParams` postpone), so it cannot be
  a shell. Instead `src/lib/shellRewrites.json` maps a visible pattern to a static route (`/reader/:page` ->
  `/reader/view`): the proxy rewrites to it (visible URL unchanged), build-shells ships it under the pattern in the
  manifest, and the SW matches the pattern. `usePathname` (i18n wrapper) returns the shell path while hydrating and
  the visible path after, so the page reads its number from the URL. M6 added `/tracker/:circleId` ->
  `/tracker/circle` and `/tracker/:circleId/student/:membershipId` -> `/tracker/student`, plus literal entries
  `/tracker` and `/tracker/covering`: one rule in the proxy (`shellRewrites.ts`) and the SW (`matchRoute`,
  compiled patterns cached, metacharacters escaped), checked against each other by `shellMatch.test.ts`:
  an exact key wins, else the first pattern. M7 added `/share/:setId` -> `/share/set` (bookmark redirect),
  `/share/:setId/:page` -> `/share/view` and the literal `/shared`. Unmapped routes still fall back
  to `/offline.html`. M10: check `/reader/<n>` and `/tracker/<id>` deep links and back/forward on a device.
- **Revalidating Server Actions on a rewritten route can hard-reload (M5).** An action whose response is marked
  revalidated (any Set-Cookie, e.g. a Supabase token refresh in `createClientAction`) makes the router refresh;
  on `/reader/<n>` racing a `?set=` navigation that refresh mismatched twice and Next fell back to a full page load
  (seen in e2e, where the proxy re-set `x-e2e-test` on every request; it now skips that on mapped routes). Prod hits it
  only on a token refresh during an action. M10: watch for reloads on set switch / note save.
- **Tracker flakes `tracker.spec.ts:19/41/109`: root cause (M6).** The create flow ran `router.push(/tracker/<id>)`
  and then immediately `router.refresh()` against a dynamic server page, and it only landed because every e2e action
  response was "revalidated" (the proxy re-set `x-e2e-test`), so the push, the refresh and the action's own refresh
  raced. Fixed: the tracker reads client-side, every write goes through `src/lib/tracker/actions.ts` (invalidates
  `qk.tracker`), create pushes to the new id only after the action resolves, and there is no `router.refresh()` in the
  tracker. The proxy no longer re-sets the e2e cookie on any mapped tracker route. A second cause surfaced with the
  persisted cache: components seed local state from props, so a stale restored snapshot stuck after the refetch
  (`:109` under parallel load). `useSynced` (tracker/ui) now follows the prop when the data changes. Gate: tracker
  `--repeat-each=5 --retries=0 --workers=1` 20/20, full suite 95/95. F4's 10x run is still M9's.
- **Tracker writes are still Server Actions (M6).** The writes stay server-side. E10 offline refusal uses `navigator.onLine`;
  on a lie-fi connection the action's own fetch fails and ActionButton surfaces it. The Manage-sessions tab now
  reads through TanStack (`qk.trackerManage`, `reads.getManageSlots`, browser client).
- **Substitute / share pickers search via a Server Action (M6).** `searchAccountsByEmail` is a user-typed account
  search, not a data section, so it stays a server action (needs the `accounts_by_email_prefix` RPC per keystroke;
  nothing to cache or show offline).
- **A3 e2e covers the shell guard only.** Under `PLAYWRIGHT_TEST` the proxy bypasses auth, so the signed-out
  `/tracker/<id>` → `/login?next=` test (pwa.spec) runs through the SW shell + ShellAuthGuard, not the proxy.
- **Teacher's view of a student's wird week uses the viewer's browser timezone (M6).** It used the saved profile
  timezone on the server. Same user in practice; differs only if the device zone and the saved zone disagree.
- **Persisted cache is throttled (1s).** A cold launch within ~1s of the first data load may find nothing persisted;
  the pwa e2e waits for `me`/`sets` in IDB before going offline.
- **`/sets` input before hydration.** On the static `/sets` shell, text typed before hydration is reset (seen as an
  e2e race; tests now retry the fill). Minor UX gap on slow devices.

- **Share capability is read client-side (M7).** `src/lib/share/reads.ts` (`loadShareCap`, `loadSharedWithMe`) replaces
  the server `services/share.ts`; `qk.share(setId)`, `qk.shared`, `qk.annotation(setId, page)`. A set RLS hides now renders
  **not found** (was an empty read-only canvas titled "Shared Set"); in prod that was already everything a guest or
  non-grantee could see, but the ShareCard copy "Anyone with this link can view" stays untrue under current RLS.
  The persisted capability is per user (buster), so a revoked grant shows the cached view offline until the next online
  refetch returns not found. M10: open a revoked share link online and confirm not found.
- **`/shared` is now a protected path (M7).** The proxy (with `next=`) and ShellAuthGuard enforce it, replacing the
  page's own `redirect('/login')`. `/share/**` stays public (RLS decides).
- **Only note writes are offline-guarded on share/reader (M7).** `useNotes` writes go through `src/lib/query/guarded.ts`
  (generalised from tracker `tracked()`, invalidates `['notes']`) and NotesPanel shows the error. Fabric canvas saves
  (annotationStore) are not wrapped: offline they fail through the store's existing error path.
- **Mock store mirrors annotation_sets RLS (M7).** Selects return only sets the acting user owns, collaborates on
  (`set_collaborators`) or covers (mock-only `covering` table, served by the `covering_sessions` RPC). Read-only share
  e2e acts as a dedicated substitute id (`shareFixture.ts`) so no covering row lands on the default mock user.