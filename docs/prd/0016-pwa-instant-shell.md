# PRD 0016 — PWA instant shell (v2: app shell + client data cache)

> **Amended 2026-10-11, author-approved after E1 no-go.** v1 planned a SW that streamed a cached
> PPR shell then a `next-resume` POST for the data holes. Spike E1 (see
> `0016-pwa-instant-shell-build.md`) showed Vercel's edge answers that POST with **405** from cache,
> so a client can never resume a PPR route. v1 decisions 7–10 and the SW resume code are dropped
> (removed in commit "chore(0016): drop PPR shell/resume SW"). Phase 1 (proxy `getClaims`,
> onboarding cookie, hidden `[locale]`) and the Phase 2 `cacheComponents` / `usePathname` work stay.
>
> v2 is the standard app-shell model: the SW serves a cached, user-agnostic static shell per route;
> data sections are client components reading Supabase through TanStack Query, with the query cache
> persisted to IndexedDB. The acceptance contract (`0016-pwa-instant-shell-contract.md`) is the
> source of truth for "done".

## Problem / Goal

- Each tap and each cold launch waits on the network + server render before real UI appears.
- Goal: frame one on cold launch (online or offline) is real UI chrome **plus the last-known data**
  for the signed-in user; fresh data replaces it in the background. Skeletons only when nothing is
  cached yet.

## Principles

- **Shells hold UI, never user data.** The SW caches only build-time static HTML that contains no
  user data by construction. Authenticated HTML is never cached (hotfix 9063f6e stays true).
- **RLS is the security boundary.** The browser Supabase client reads with the user's JWT; RLS
  decides what it can see. Proxy gates are UX.
- **User data lives only in the per-user query cache**, which is wiped on logout and user switch.
- **Degrade to network.** No shell for a route/build → plain network navigation.

## Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | Target cold launch (online + offline) and in-app navigation | Unchanged from v1 |
| 2 | Keep Phase 1: proxy `getClaims()`, `hc-onboarded` cookie, hidden `[locale]` rewrite | Still removes per-request round-trips; independent of data model |
| 3 | Keep `cacheComponents: true` | It is what makes a route with no request-data reads prerender to a **complete** static document (see Findings) |
| 4 | **All data sections go client-only** (no server-rendered data, also on first online visit) | Any server read of cookies/params/Supabase makes the route postponed (◐), whose shell is an open document that needs the resume Vercel rejects. Client-only gives one code path, a complete static shell, and the same behaviour online/offline. Cost: the very first visit (empty cache) shows skeletons until the client fetch lands — accepted |
| 5 | Data via **TanStack Query** (`@tanstack/react-query`) + `@tanstack/react-query-persist-client` with an IndexedDB persister (`idb-keyval` `get/set/del`, wrapped as an async-storage persister) | Industry standard SWR cache; persisted cache gives instant last-known data on cold launch |
| 6 | Defaults: `staleTime` ~30s, `gcTime` 7d, `maxAge` 7d, refetch on mount/focus/reconnect | Stale shown instantly, refreshed in background |
| 7 | Persisted cache **key/buster = `${userId}:${buildId}`**. On boot the provider reads the session user id; mismatch → discard. Logout and user switch (`onAuthStateChange` SIGNED_OUT / different user) → `queryClient.clear()` + delete the IDB entry before any render of the next user | [SEC] no cross-user data; build change drops shape-incompatible caches |
| 8 | No user id available (signed out, offline with no session) → no persisted cache restored | Never guess an identity |
| 9 | Mutations: existing server actions/client writes keep working; after success `invalidateQueries` on the affected keys, optimistic `setQueryData` where the UI already behaves optimistically | Minimal change; offline writes out of scope |
| 10 | Query keys are a small typed module (`src/lib/query/keys.ts`); fetchers use `createClient()` from `src/lib/supabase/client.ts` | One place to invalidate from; reuse existing client |
| 11 | Dynamic routes (`/reader/[page]`, `/share/[setId]/…`, `/tracker/[circleId]/…`) do **not** await `params` on the server; the client reads them with `useParams()`. One fallback shell per route pattern | Keeps the fallback shell complete; Next already emits `reader/[page].html` etc. |
| 12 | Shell pipeline: postbuild script copies each complete `.next/server/app/{locale}/{route}.html` (no `postponed` in `.meta`) to `public/_shell/{buildId}/{locale}/…` + `manifest.json`; the build fails if a listed app route is still postponed | Reuses the build output; checkable invariant |
| 13 | SW is versioned per deployment: registered as `/sw.js?v=<buildId>`; install precaches that build's shells (`credentials: 'omit'`); activate purges other `hc-shell-*` caches. Navigations to a route with a shell for the active build are served **cache-first** from the shell; everything else stays network-first with `/offline.html` fallback | Instant cold launch; new deploy swaps the whole set atomically; old chunks remain cached in `hc-static-v1` and on Vercel (skew) for any open old page |
| 14 | Shell locale: the page posts its locale to the SW (`postMessage`) and the SW stores it in its cache; default locale when unknown | SW cannot read cookies portably (`cookieStore` is not in Safari) |
| 15 | Auth on a shell-served launch: the proxy is skipped, so the client checks the session; no session online → `router.replace('/login?next=…')`; offline with a session → show cached data | Proxy still guards every network navigation; RLS guards data |
| 16 | Keep `/_next/static/*` cache-first (`hc-static-v1`), Mushaf page cache and push handlers unchanged | Already shipped/working |
| 17 | E2E: browser mock client and server mock store are separate stores today (`IS_SERVER` in `mock.ts`). Client fetches in e2e must see server-seeded data: route the e2e browser mock through a test-only API to the server store, or seed via the client store — decided in M1 | Otherwise every converted e2e loses its fixtures |

## Findings — static shell under `cacheComponents` (2026-10-11 build)

- `.next/server/app/{locale}/{route}.html` + `.meta` exist for every app route.
- Routes whose server tree reads no request data (`login`, `signup`, `onboarding`) are **complete**
  documents (end in `</html>`, no `postponed` in `.meta`).
- Every data route (`wird`, `wird/manage`, `sets`, `reader`, `reader/[page]`, `tracker/*`,
  `share/*`, `shared`, `settings`, `install`) is currently postponed: the HTML stops after the
  bootstrap script, body/html open, holes waiting for a resume.
- Dynamic segments already get a fallback shell file (`reader/[page].html`, `share/[setId]/[page].html`).
- Conclusion: viable. Converting a route's data to client components (and not awaiting params on
  the server) flips it to a complete static document, which the SW can serve as-is; its Suspense
  holes are client components that fetch after hydration. Nothing in
  `node_modules/next/dist/docs` covers offline shells (`progressive-web-apps.md` only points at
  Serwist); the PPR platform guide covers only resume, which is what failed.

## Phases → see "Milestone ladder (v2)" in `0016-pwa-instant-shell-build.md`

## Out of scope

- Offline writes / sync queue.
- Bulk precache of the 604 Mushaf pages; neighbour-page prefetch.
- Serwist or any SW library.
- Server-rendered data for first visit (decision 4).

## Risks

- Larger client bundle per route (React Query ~13kB gz + persister). Acceptable.
- Every data-route conversion touches its e2e fixtures (decision 17).
- Persisted cache holds user data on the device at rest (IndexedDB, same origin). Mitigated by
  clear-on-logout/switch and 7d `maxAge`; shared-device users must log out.
- Stale shell vs new build: the shell only references its own build's chunks; served while the new
  SW installs, then the next launch uses the new set.
- Supabase legacy HS256 keys would make `getClaims()` call the network (Phase 1 A2 still applies).
