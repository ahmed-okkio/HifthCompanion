# PRD 0016 — PWA instant shell (grill output)

> Make the installed PWA feel native: real UI chrome paints instantly on cold launch and on every
> in-app navigation; only data-bearing sections show skeletons while they stream. The acceptance
> contract (`0016-pwa-instant-shell-contract.md`) is the source of truth for "done".

## Problem / Goal

- Every route is fully dynamic. The root layout reads the locale cookie (`src/app/layout.tsx` →
  `getLocale()` → `cookies()`), so nothing can be prerendered; `reader` and `share` also set
  `force-dynamic`.
- `src/middleware.ts` makes **two network round-trips per protected navigation** before any byte is
  sent: `supabase.auth.getUser()` and a `user_hifth.onboarded_at` query.
- `public/sw.js` serves navigations network-first and caches only `/` and `/offline`; JS/CSS chunks
  rely on the HTTP cache.
- Result: each tap and each cold launch shows a full-page `loading.tsx` skeleton (fake header, fake
  tabs) for the length of those round-trips plus the server render.

Goal: frame one is real UI (nav, headers, tabs, buttons, copy). Skeletons appear only where user
data goes. Cold launch of the installed PWA shows that shell without waiting on the network.

## Principles

- **Cache UI, never user data.** Only the build-time static shell is cached by the SW. It contains
  no user data by construction.
- **Skeletons move down, not away.** Every data section keeps a skeleton fallback; page-level
  full-screen skeletons go.
- **Degrade to today's behaviour.** Any SW/resume failure falls back to a plain network navigation.
- **Middleware gates are UX, RLS is security.** Cheapening middleware checks does not weaken data
  access.

## Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | Target both cold launch and in-app navigation | User: both hurt |
| 2 | Static UI in the shell, data in `<Suspense>` holes with skeletons; no stale-data display | User: "keep UI cached, skeleton the data that changes" |
| 3 | Enable Next 16 Cache Components (`cacheComponents: true`) | Built-in static shell + streamed holes (`docs/01-app/02-guides/streaming.md`, `instant-navigation.md`) |
| 4 | Locale via **hidden `[locale]` segment**: middleware reads the locale cookie and rewrites `/sets` → `/{locale}/sets`; visible URLs unchanged | Root layout must not read cookies; avoids link/redirect churn of visible locale URLs; avoids RTL flash of client-side locale |
| 5 | Middleware auth via `supabase.auth.getClaims()` (local JWT verify) | Removes per-request auth round-trip. Requires asymmetric JWT signing keys — verify in dashboard, migrate if still legacy HS256 |
| 6 | Onboarding gate via `hc-onboarded=1` cookie; DB query only when the cookie is absent, then set it | Removes per-request DB query; forged cookie only skips an onboarding UX redirect |
| 7 | SW precaches each route's **static shell + `postponedState`** (per locale, keyed by deployment ID) and serves navigations by streaming the cached shell then the **PPR resume** response (`POST` + `next-resume: 1` + postponedState body), per `docs/01-app/02-guides/ppr-platform-guide.md` | True instant cold launch; no user data cached; documented protocol |
| 8 | Shell set is versioned by deployment ID; new deploy → new SW precaches new set atomically and purges old | Shell and postponedState must be a same-build pair; prevents the stale-chunk reload loop noted in `sw.js` |
| 9 | Resume request pinned to the shell's deployment (Vercel skew protection); on any non-ok/mismatch → plain network navigation | Old shell must never resume against a new build |
| 10 | Dynamic routes (`/reader/[page]` etc.) use one fallback shell per route pattern | 604 pages × 2 locales is pointless |
| 11 | SW caches `/_next/static/*` cache-first | Immutable hashed assets; never re-downloaded |
| 12 | Delete page-level `loading.tsx` files; push `<Suspense>` down to each data section, reusing existing skeleton components as fallbacks | Max real UI on frame one |
| 13 | **Spike gate**: Phase 2 proves shell + resume on `/wird` on a Vercel **preview** from a real browser before any other route is converted | Only unknown: whether Vercel accepts a browser-originated resume POST |
| 14 | E2E: existing projects run with `serviceWorkers: 'block'`; new `pwa` area (`npm run test:e2e:pwa`) runs with the SW | Isolate SW cache state from unrelated suites |

## Phases (branch `feat/0016-pwa-instant-shell`)

1. **Middleware + locale**: `getClaims()`, onboarding cookie, matcher covers all app routes,
   hidden `[locale]` rewrite, root layout reads no request data.
2. **Cache Components + `/wird` spike**: enable `cacheComponents`, convert `/wird` to leaf Suspense,
   SW shell + resume for `/wird` only. Deploy to preview, verify in a browser.
   **Go/no-go.** No-go → stop, fall back to decision 11 only (static-asset caching), re-plan.
3. **Roll out leaf Suspense** to sets, reader, tracker, share, shared; delete `loading.tsx`s;
   remove `force-dynamic`.
4. **SW for all routes**: shell manifest generated postbuild, precache, resume concat, fallbacks,
   offline holes.
5. **Tests**: `pwa` e2e area, `serviceWorkers: 'block'` elsewhere, Vitest for SW logic.

## Out of scope

- Bulk precache of all 604 Mushaf pages (already cache-first once read; 70MB install cost).
- Mushaf neighbour-page prefetch (declined).
- Offline data writes / sync.
- Serwist or any SW library (needs webpack; custom resume logic anyway).
- Showing last-known (stale) data instead of skeletons.

## Risks

- Vercel may reject/strip browser `next-resume` POSTs → caught by the Phase 2 gate.
- Supabase project may still use legacy HS256 keys → `getClaims()` silently falls back to a network
  call; Phase 1 must verify key type.
- Cache Components forbids request-data reads outside Suspense; every page needs refactoring so
  `cookies()`/Supabase reads happen in leaf components.
