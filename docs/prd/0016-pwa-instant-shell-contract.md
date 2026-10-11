# Acceptance contract — 0016 PWA instant shell

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

## C — Static shell

- **C1** `cacheComponents: true` in `next.config.ts`; no route exports `dynamic = 'force-dynamic'`.
- **C2** `next build` reports every app route (wird, sets, reader, tracker, share, shared) as
  partially prerendered.
- **C3** For each of those routes the prerendered shell HTML contains the real nav, page title and
  primary action labels, and contains **no** user-specific data (names, set titles, progress, emails). **[SEC]**
- **C4** No page-level `loading.tsx` remains for those routes; each data section has its own
  `<Suspense>` with a skeleton fallback.
- **C5** In-app navigation between visited routes shows real chrome immediately; only data sections
  show skeletons, then real data.

## D — Service worker

- **D1** `/_next/static/*` is served cache-first from CacheStorage after first fetch.
- **D2** On install the SW precaches the shell + postponedState for every PPR route × locale for the
  current deployment ID.
- **D3** A navigation to a precached route streams the cached shell first, then the resume response
  for the dynamic holes, as one document response.
- **D4** The resume request is `POST` with `next-resume: 1` and the shell's postponedState as body,
  pinned to the shell's deployment.
- **D5** If the resume request fails, is non-ok, or the deployment mismatches, the SW performs a plain
  network navigation instead; the user sees a fully working page.
- **D6** Activating a SW for a new deployment deletes all shells from older deployments; no reload
  loop occurs across a deploy.
- **D7** Offline with a cached shell: the shell renders with real chrome, data holes show an offline
  state (not the `/offline` page, not an endless skeleton).
- **D8** Shell caches contain no responses from authenticated data endpoints; after logout and login
  as another user, no data from the first user is shown. **[SEC]**
- **D9** Mushaf page cache (`hc-pages-v1`) and push/notification handlers behave as before.
- **D10** Non-GET requests and cross-origin requests other than Mushaf images are not intercepted.

## E — Spike gate (Phase 2)

- **E1** On a Vercel preview, from a real browser with the SW active, `/wird` cold-launches with the
  cached shell and resumes data via D3/D4. Evidence: network log + screenshot recorded in
  `0016-pwa-instant-shell-build.md`.
- **E2** If E1 fails, implementation stops after D1 and the author is consulted before continuing.

## F — Tests

- **F1** All existing e2e projects run with `serviceWorkers: 'block'` and stay green.
- **F2** `npm run test:e2e:pwa` exists and asserts outcomes for D3, D5, D6, D7, D8 (offline via
  `context.setOffline(true)`), failing on any browser console error.
- **F3** Vitest covers the SW shell/resume concat and fallback logic.
- **F4** `npx tsc --noEmit`, `npm run build:check`, `npm run test`, full `npm run test:e2e` green.
