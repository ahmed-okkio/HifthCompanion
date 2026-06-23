# PRD: Reader fixed app-shell layout + mobile friendliness

> Tracker: [GitHub issue #1](https://github.com/ahmed-okkio/HifthCompanion/issues/1) (`ready-for-agent`). Issue is source of truth; this is the committed copy.

## Problem Statement

The reader is uncomfortable to use and was never designed for phones.

- On desktop, the surah panel on the left "scrolls down with the user" instead of staying put, and the reader page grows a vertical scrollbar even though it is conceptually a single fixed page — so the Quran page drifts and the chrome feels loose.
- On mobile, the app is effectively unusable: the floating "Surahs" pill sits on top of the fixed annotation toolbar at the bottom, controls collide, and nothing was laid out for a narrow viewport.

The user wants the reader to feel like an app, not a loose scrolling document, and to be genuinely usable on a phone.

## Solution

Adopt a deliberate, responsive layout model for the reader and bring every user-facing page in line with it.

- **Desktop reader = fixed app-shell.** The viewport is locked to its height with no page scroll. The top navigation is fixed; the surah panel (left) and the notes/share panel (right) scroll internally; the Quran page is centered between them and scales to fit, never scrolling. The surah panel has a single scroll region instead of nested ones, so it stays put.
- **Mobile reader = document flow with fixed chrome.** Navigation is fixed at the top, the annotation toolbar is fixed at the bottom, and the content between them scrolls: the Quran page first, the notes below it. The surah list remains a bottom-sheet.
- **Surah access on mobile moves into the top navigation** as a list button that opens the existing bottom-sheet; the colliding floating pill is removed.
- The same model is applied across the share view, the sets page, and auth/misc pages, and the footer is dropped from the fixed reader app-shell while kept on pages that actually scroll.

See ADR-0001 (`docs/adr/0001-reader-layout-and-mobile.md`) for the recorded decisions.

## Model Routing

Each user story below is tagged `(Model: Opus)` or `(Model: Sonnet)`.

- **Opus** stories are architectural or regression-sensitive: the reader-shell restructure, route-scoped scroll lock, lifted surah open-state, share-view refactor, and the "don't break existing behavior" guards.
- **Sonnet** stories are mechanical and bounded: CSS-level scroll fixes, markup/breakpoint additions, deletions, conditional renders, padding passes, and the E2E config/specs.

**Self-check protocol — the implementing agent must run this before starting any story:**

1. Read the `(Model: …)` tag on the story you are about to implement.
2. Compare it to the model you are currently running as.
3. If they **match**, proceed.
4. If they **mismatch**, STOP and ask the user whether to swap models (e.g. "Story 9 is tagged Opus but I'm running Sonnet — swap to Opus, or proceed anyway?"). Do not silently continue.

Dependency note: the Sonnet "fill-in" stories (3, 6, 10, 11) assume the Opus shell + lifted-state stories (1, 2, 4, 5, 9) have already landed — they fill a contract those define. Sequence accordingly.

## User Stories

1. As a desktop reader, I want the surah panel to stay fixed in place while I work, so that it doesn't drift away as I interact with the page. _(Model: Opus)_
2. As a desktop reader, I want the reader view to occupy exactly the viewport with no stray page scrollbar, so that the Quran page stays centered and stable. _(Model: Opus)_
3. As a desktop reader, I want the surah list to scroll within its own panel, so that scrolling the list never moves the rest of the layout. _(Model: Sonnet)_
4. As a desktop reader, I want the notes/share panel to scroll within its own column when it is taller than the viewport, so that long note lists don't force the whole page to scroll. _(Model: Opus)_
5. As a desktop reader, I want the Quran page to scale to fit the available height, so that I can always see the full page without scrolling. _(Model: Opus)_
6. As a desktop reader, I want the top navigation to remain fixed, so that page controls are always reachable. _(Model: Sonnet)_
7. As a mobile reader, I want the navigation fixed at the top and the annotation toolbar fixed at the bottom, so that my core controls are always within reach. _(Model: Sonnet)_
8. As a mobile reader, I want the Quran page and my notes to scroll vertically between the fixed bars, so that I can read the page and then review notes naturally. _(Model: Sonnet)_
9. As a mobile reader, I want to open the surah list from a button in the top navigation, so that I can jump surahs without a floating control covering my drawing tools. _(Model: Opus)_
10. As a mobile reader, I want the floating surah pill removed, so that it no longer overlaps the annotation toolbar. _(Model: Sonnet)_
11. As a mobile reader, I want the surah bottom-sheet to open, scroll to the current surah, and close on selection or backdrop tap, so that navigation feels native. _(Model: Sonnet)_
12. As a mobile reader, I want the page content padded clear of the fixed top nav and bottom toolbar, so that no content is hidden behind the chrome. _(Model: Sonnet)_
13. As a reader on any device, I want selecting a surah to navigate without remounting or losing my current annotation set, so that my work and context are preserved (existing behavior must not regress). _(Model: Opus)_
14. As a reader viewing a shared annotation, I want the share view to use the same fixed app-shell on desktop and the same scrolling model on mobile, so that the shared experience matches the reader. _(Model: Opus)_
15. As a reader viewing a shared annotation on mobile, I want a working surah control and a layout that fits the screen, so that I can navigate the shared set on my phone. _(Model: Opus)_
16. As a signed-in user on the sets page, I want the page to be usable and well-padded on mobile, so that I can manage annotation sets from my phone. _(Model: Sonnet)_
17. As a user on the login/auth pages, I want them to render correctly on mobile, so that I can sign in on my phone. _(Model: Sonnet)_
18. As a reader, I want the footer removed from the fixed reader app-shell, so that it doesn't eat into the Quran page area or fight the no-scroll model. _(Model: Sonnet)_
19. As a user on scrollable pages (sets, mobile reader), I want the footer to still appear, so that the site still feels complete where there is room for it. _(Model: Sonnet)_
20. As a returning desktop user, I want the existing surah-panel scroll position preserved across page navigation, so that I don't lose my place in the list (existing behavior must not regress). _(Model: Opus)_
21. As a reader, I want surahs that begin on the same page to remain combined into a single active button, so that page navigation stays unambiguous (existing behavior must not regress). _(Model: Sonnet)_
22. As a reader on a short or tall window, I want the layout to adapt without clipping the toolbar, the page, or the panels, so that every control stays usable. _(Model: Opus)_
23. As a maintainer, I want the existing data-testid hooks preserved, so that the E2E suite keeps protecting the reader. _(Model: Sonnet)_

## Implementation Decisions

- **Reader shell becomes the single layout authority.** The reader shell is restructured into a viewport-height flex column: fixed top navigation (auto height) plus a content row that fills the remaining height. On desktop the content row is a three-region layout — surah panel (own scroll), centered Quran page (no scroll, scales to fit), notes/share column (own scroll) — and page-level scrolling is suppressed. On mobile the shell falls back to document flow with the navigation fixed at top and the annotation toolbar fixed at bottom.
- **Scroll-lock is scoped to the reader, not global.** The no-page-scroll behavior must apply to the desktop reader route only; other routes (sets, auth) remain naturally scrollable. Do not lock scrolling on the document body globally.
- **Surah panel collapses to one scroll container.** Remove the nested/dual scroll regions and the hard-coded viewport-math height; the panel header stays fixed and its list fills remaining space and scrolls on its own.
- **Surah open-state is lifted to the reader shell.** The mobile surah trigger lives in the top navigation, and the bottom-sheet is opened/closed via shared state owned by the reader shell (passed to both the nav trigger and the sheet), rather than the sheet owning its own isolated open-state. This is the one new coupling introduced. The floating pill control is removed.
- **Navigation gains a mobile-only surah button.** A list/hamburger button appears only below the desktop breakpoint, placed near the page jumper, and opens the surah bottom-sheet. Desktop continues to rely on the persistent left panel.
- **Share view is refactored onto the shared model.** Its currently-unpositioned surah panel and bespoke layout are replaced by the same app-shell (desktop) / scrolling (mobile) structure used by the reader, including a working mobile surah entry point.
- **Notes/share column behavior.** On desktop the column scrolls internally within the fixed shell; on mobile it stacks below the Quran page in the scrolling content. The read-only notes panel on the share view follows the same rules.
- **Footer.** Removed from the fixed reader app-shell; retained on scrollable pages (sets, mobile reader).
- **Page-fit math.** The Quran page-display-frame continues to size against available height so it never scrolls on desktop; offsets must account for the fixed nav and the set-picker so the page is fully visible.
- **No data model, API, or schema changes.** This is a presentation-layer change only; annotation, notes, sets, and sharing contracts are untouched.

## Testing Decisions

- **What makes a good test here:** assert externally observable layout behavior through the real browser — does the document scroll, is a panel fixed, is the page centered, does the surah sheet open, do controls overlap — never internal component state or implementation details. Prefer asserting on bounding boxes, scroll metrics, URL changes, and visibility, as the existing specs already do.
- **Primary seam (existing):** the Playwright E2E suite in `src/tests/e2e` running against the real app. Desktop app-shell behavior is asserted here, extending the existing `surah_panel` spec style: assert the desktop reader does not produce document-level scroll, the surah panel stays fixed while content/list scrolls, and the page stays centered. Reuse existing `data-testid` hooks (`surah-panel`, `surah-scroll-list`, `mobile-surah-scroll-list`) and existing assertions (left-flush panel, centered page-display-frame).
- **New seam (confirmed with developer):** add a `mobile` Playwright project (Pixel 5 device preset) in `playwright.config.ts` alongside the existing `chromium` Desktop project, running mobile-tagged specs (e.g. `*.mobile.spec.ts`). Mobile tests assert: the surah button is present in the top navigation and opens the bottom-sheet; the floating pill is absent; the surah trigger and annotation toolbar do not overlap; content scrolls between the fixed bars; the share view works at mobile width.
- **Modules under test:** reader shell layout, surah panel scrolling, mobile surah trigger + bottom-sheet, share view layout. The annotation canvas and notes are covered only insofar as they must remain visible/usable after relayout.
- **Prior art:** `src/tests/e2e/surah_panel.spec.ts` (bounding-box and scroll-position assertions, surah navigation, share-route navigation), `src/tests/e2e/features.spec.ts`, and `src/tests/e2e/persistence.spec.ts`. Keep the existing 34-test suite green; update selectors/flows only where the new DOM requires it.
- **Regression guards to preserve:** surah click navigates on first click; panel scroll position survives navigation; clicking the current page's surah does not remount the canvas; same-page surahs combine into one active button; annotation set selection is preserved across surah navigation.

## Out of Scope

- Any change to annotation, notes, sets, or share data models, APIs, persistence, or auth.
- New reader features (zoom/pan, new tools, new annotation types, theming).
- Tablet-specific layouts beyond what the desktop/mobile breakpoint split already yields.
- Visual redesign of components beyond what is needed to make the layout fit (no new color system, iconography overhaul, or typography pass).
- Performance/offline/PWA work.
- Cross-browser matrix expansion beyond the existing Chromium desktop project plus the new mobile project.

## Further Notes

- Decisions are recorded in ADR-0001 (`docs/adr/0001-reader-layout-and-mobile.md`); this PRD does not contradict any existing ADR.
- Key risk: the desktop scroll-lock must be route-scoped — a global body overflow lock would break the sets/auth pages. The reader shell already measures the nav height via a resize observer; that measurement remains useful for sizing the content row.
- Known pre-existing quirk to fix in passing: the share view's surah panel is currently rendered unpositioned in normal flow; refactoring onto the shared shell resolves it.
- `dvh` units should be used for viewport-height math so mobile browser chrome (dynamic URL bar) doesn't clip the layout.
