# ADR 0001 — Reader layout model & mobile friendliness

- Status: Accepted
- Date: 2026-06-23
- Deciders: Ahmed Hamad

## Context

The reader (`/reader/[page]`) and share (`/share/[userId]/[page]`) views had two
recurring UI quirks and no deliberate mobile design:

1. **Desktop surah panel "scrolls with the user."** The left panel
   (`ReaderShell.tsx`) used `position: sticky; top: navHeight` inside a
   document-flow page. Because the page itself scrolls (body is `min-h-screen`
   with no overflow lock), and the panel contained a *second* nested scroll
   container (`SurahNavPanel`'s `h-[calc(100vh-248px)]` list), the panel did not
   stay put as intended.
2. **Reader page scrolls when it shouldn't.** `body { min-h-screen }` + page
   padding + footer + a right-hand Notes/Share column taller than the Quran
   image produced an unwanted vertical scrollbar around a view that is
   conceptually a single fixed page.
3. **Mobile bottom-zone collision.** The floating "Surahs" pill
   (`fixed bottom:24px left:16px`, z-60) overlapped the fixed
   `MobileAnnotationBar` (`fixed bottom:0`, z-45) on the editing reader.

## Decision

### D1 — Desktop reader uses a fixed app-shell
Lock the reader viewport to `100dvh` with no page scroll. Nav sits at the top;
the surah panel (left) and the Notes/Share panel (right) scroll **internally**;
the Quran page is centered between them and scales to fit (never scrolls).
Collapse the double scroll containers in the surah panel into one.

### D2 — Mobile reader uses document flow with fixed chrome
Phones cannot fit page + notes + toolbar in one locked viewport. Nav is fixed
top, the annotation bar is fixed bottom, and the content between them scrolls:
Quran page first, notes below. Surah list stays a bottom-sheet.

### D3 — Scope
All user-facing pages: reader, share, sets, and auth/misc. Share reuses the same
layout model as reader (its panel is currently unpositioned in flow and must be
brought in line).

### D4 — Mobile surah access moves into the nav
Drop the floating pill. Add an `lg:hidden` surah/list button to the fixed top
nav (beside the page jumper) that opens the existing bottom-sheet. Removes the
bottom collision and is consistent across pages.

### D5 — Footer
Remove the footer from the fixed reader app-shell (no scroll room). Keep it on
scrollable pages (`/sets`, mobile reader) where content flows.

### D6 — Verification
Preserve existing `data-testid` hooks (`surah-panel`, `surah-scroll-list`,
`mobile-surah-scroll-list`, …). Update any Playwright tests broken by the new
DOM and keep the full 34-test suite green before declaring done.

## Consequences

- `ReaderShell` becomes a `100dvh` flex column: nav (auto) + a `flex:1,min-h:0`
  row of three independently-scrolling regions. The `navHeight` ResizeObserver
  stays useful for sizing the row.
- `SurahNavPanel` drops its `calc(100vh-248px)` magic number; its list fills the
  panel via flex instead.
- `body`/reader root needs an overflow strategy that locks the desktop reader
  but leaves other pages scrollable (scope it to the reader route, not global).
- Share page is refactored to the shared model rather than its bespoke,
  partially-broken layout.
- Mobile surah entry point relocates; the floating-pill component is removed.
- Some E2E selectors/flows may need updating where DOM structure changes.
