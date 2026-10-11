# Acceptance contract — 0016 PWA instant shell (v2)

> **Amended 2026-10-11, author-approved after E1 no-go.** v1 sections C–F (PPR shell + SW
> `next-resume`) are replaced: spike E1 showed Vercel returns 405 to a browser resume POST, so D2–D7
> of v1 were unreachable. v1 D1 (`/_next/static` cache-first) shipped and is kept as D1 below.
> A and B are unchanged. New C–F cover the app-shell + persisted client data cache model.

> **This file is the acceptance criteria. It was written before the code.**
> **Do not edit this contract to make a test pass.** If an item is wrong or impossible, stop and
> raise it with the author — changing the contract to match the implementation defeats its purpose.
> A validator reports PASS / FAIL / BLOCKED per ID. Items marked **[SEC]** block the milestone on FAIL.

## A — Middleware

- **A1** Middleware calls `supabase.auth.getClaims()` and never `getUser()`.
- **A2** The Supabase project uses asymmetric JWT signing keys; a protected navigation with a valid
  session makes **no** request to Supabase auth from middleware (verified by network log / server log).
- **A3** An unauthenticated request to a protected path redirects to `/login?next=<path+search>`. **[SEC]**
- **A4** A request with a forged/expired/invalid JWT is treated as unauthenticated. **[SEC]**
- **A5** With `hc-onboarded=1` present, middleware performs no `user_hifth` query.
- **A6** Without the cookie, middleware queries `user_hifth` once; if onboarded it sets
  `hc-onboarded=1`, otherwise redirects to `/onboarding?next=…`.
- **A7** Completing onboarding sets `hc-onboarded=1`.
- **A8** Logout clears `hc-onboarded`.
- **A9** E2E bypass behaviour is unchanged.

## B — Locale

- **B1** Visible URLs carry no locale prefix; every existing link, redirect and e2e path still works.
- **B2** Middleware rewrites each app route to an internal `[locale]` segment using the locale cookie
  (default locale when absent/invalid).
- **B3** The root layout and every layout above the data holes read no cookies/headers.
- **B4** `<html lang dir>` is correct for each locale on first byte — no LTR→RTL flash for Arabic.
- **B5** Switching language renders the new locale on the next navigation.

## C — Static shell (build)

- **C1** `cacheComponents: true` in `next.config.ts`; no route exports `dynamic = 'force-dynamic'`.
- **C2** For each app route (wird, wird/manage, sets, reader, reader/[page], tracker, tracker/[circleId],
  tracker/[circleId]/student/[membershipId], tracker/covering, share/[setId], share/[setId]/[page],
  shared, settings) and each locale, `.next/server/app/{locale}/{route}.meta` has no `postponed` and
  the `.html` is a complete document ending in `</html>`.
- **C3** Each such shell contains the real nav, page title and primary action labels and **no**
  user-specific data (names, set titles, progress, emails, user ids). **[SEC]**
- **C4** No server component on those routes awaits `cookies()`, `headers()`, `params`/`searchParams`
  or a Supabase query; dynamic params are read client-side.
- **C5** The postbuild shell step writes `public/_shell/{buildId}/{locale}/…` + `manifest.json`, and
  fails the build if any C2 route is postponed.
- **C6** No page-level `loading.tsx` remains on those routes; each data section renders a skeleton only
  when it has no cached data.

## D — Service worker

- **D1** `/_next/static/*` is served cache-first from `hc-static-v1` after first fetch.
- **D2** The SW is registered per build (`/sw.js?v=<buildId>`); install precaches that build's shells
  with `credentials: 'omit'`.
- **D3** A navigation to a route with a shell for the active build is answered from the shell cache
  without waiting on the network (cold launch, online and offline).
- **D4** A navigation without a matching shell is network-first, falling back to `/offline.html`.
- **D5** Activating a new build's SW deletes every older `hc-shell-*` cache; no reload loop across a deploy.
- **D6** The SW never stores a response to a credentialed navigation or any authenticated HTML; only
  `public/_shell/**`, `/offline.html`, `/_next/static/**` and Mushaf images are cached. **[SEC]**
- **D7** The shell's locale follows the user's locale (D7 checked for en and ar, incl. `dir="rtl"`).
- **D8** Mushaf page cache (`hc-pages-v1`) and push/notification handlers behave as before.
- **D9** Non-GET requests and cross-origin requests other than Mushaf images are not intercepted.

## E — Client data cache

- **E1** Data sections on every C2 route are client components reading through TanStack Query with
  the browser Supabase client; no data arrives via server render.
- **E2** The query cache is persisted to IndexedDB; on cold launch (online or offline) a previously
  visited route shows the last-known data on first paint after hydration, with no skeleton.
- **E3** Cached data is refetched in the background on mount/focus/reconnect and replaced in place.
- **E4** With no cached data a section shows its skeleton, then data; offline with no cache it shows
  an offline state, not an endless skeleton.
- **E5** The persisted cache is bound to `${userId}:${buildId}`; a mismatch on boot discards it before
  any data renders. **[SEC]**
- **E6** Logout clears the in-memory query cache and the IndexedDB entry before navigation completes. **[SEC]**
- **E7** Logging in as user B on a device last used by user A never shows any of A's data, online or
  offline. **[SEC]**
- **E8** A shell-served launch with no session (online) redirects to `/login?next=…`. **[SEC]**
- **E9** After each mutation the affected queries are invalidated (or optimistically updated); the UI
  shows the new value without a reload.
- **E10** Offline writes are out of scope: a mutation attempted offline surfaces an error, not silent loss.

## F — Tests

- **F1** All existing e2e projects run with `serviceWorkers: 'block'` and stay green; their fixtures
  reach client-side reads (PRD decision 17).
- **F2** `npm run test:e2e:pwa` exists (SW enabled) and asserts outcomes, failing on any console error:
  - **F2a** cold launch offline (`context.setOffline(true)`) of a visited route shows real chrome + cached data (D3, E2);
  - **F2b** logout then offline/online relaunch shows no prior data (E6);
  - **F2c** user A → logout → user B shows none of A's data (E7);
  - **F2d** unvisited route offline shows the offline state (D4/E4);
  - **F2e** new build's SW purges old shells (D5).
- **F3** Vitest covers persister buster/key, discard on user mismatch, clear on logout/user switch,
  and the SW shell-lookup / cache-allowlist logic (D6).
- **F4** The flaky tracker e2e tests (`tracker.spec.ts:41`, `tracker.spec.ts:109`; also `:19` flaked
  on 2026-10-11) pass 10/10 with `--repeat-each=10`; root cause recorded in the build log (no retries-only fix).
- **F5** `npx tsc --noEmit`, `npm run build:check`, `npm run test`, full `npm run test:e2e` green.
