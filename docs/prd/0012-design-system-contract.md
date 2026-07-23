# Acceptance contract — 0012 Design system consolidation

> **This file is the acceptance criteria. It was written before the code.**
> **Do not edit this contract to make a test pass.** If an item is wrong or impossible, stop and
> raise it with the author — changing the contract to match the implementation defeats its purpose.
> A validator reports PASS / FAIL / BLOCKED per ID. Items marked **[SEC]** block the milestone on FAIL.

## A — Tokens (globals.css)

- **A1** `--teal-600: #0D9488` (case-insensitive) is defined in the raw-scale section of `:root`.
- **A2** `.btn-primary` background is a `linear-gradient` whose color stops are `var(--green-600)` and `var(--teal-600)`. It contains **no** bare hex value.
- **A3** `--accent-contrast` is defined in `:root` and resolves to white (`#fff`/`#ffffff`/`#FFFFFF`).
- **A4** The radius scale is exactly: `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`, `--radius-xl: 20px`, plus the two exceptions `--radius-page: 6px` and `--radius-canvas: 24px`.
- **A5** No token named `--radius-btn`, `--radius-btn-px`, `--radius-sm-px`, `--radius-md-px`, `--radius-lg-px`, or `--radius-max` remains defined or referenced anywhere in `src/`.
- **A6** A `--tajweed-*` token group exists in `:root` covering all 8 tajweed rule colors and the mushaf mark colors (orange, red).
- **A7** A `--home-*` token group exists in `:root` covering the marketing/demo colors (the 3 demo-note colors, the hero-gradient gold, the demo marker red).

## B — Token adoption (chrome has no bare literals)

- **B1** `src/components/LegendModal.tsx` contains no bare hex color; every tajweed rule color reads from a `--tajweed-*` token.
- **B2** `src/components/MarkedPagesList.tsx` mark colors read from tokens (`--warning`/`--danger-500` or `--tajweed-*`), no bare `#fff` — on-fill text uses `var(--accent-contrast)`.
- **B3** `src/components/HomeReaderDemo.tsx` and `src/app/page.tsx` marketing/demo colors read from `--home-*` tokens; no bare hex remains in their chrome.
- **B4** Every chrome call site that previously used `var(--accent-contrast, #fff)` or bare `#fff` for on-accent text/icon now uses plain `var(--accent-contrast)` (checked: `MemorizationEditor.tsx`, `MobileAnnotationBar.tsx`, `NoteBadgeLayer.tsx`, `NoteForm.tsx`, `SpreadNotesPanel.tsx`, `tracker/ui.tsx`, `tracker/TeacherStudent.tsx`, `tracker/CircleRail.tsx`).
- **B5** No `.tsx` file under `src/app` or `src/components` references `--radius-btn`/`--radius-max`/etc; radius consumers use the collapsed scale (`--radius-md` where `--radius-btn` was).
- **B6** The only bare-hex survivors in `src/components` and `src/app` `.tsx` files are: `themeColor` in `layout.tsx` metadata (a Next.js manifest value, not chrome) and none other. All UI chrome is tokenized.

## C — CSS Modules audit

- **C1** `ReaderNav.module.css`, `ShareShell.module.css`, and `page.module.css` (reader) contain no bare hex color values; all colors read from `var(--token)`.
- **C2** No new `.module.css` file is created; the three files remain the only CSS Modules.

## D — Reference doc

- **D1** `docs/design-system.md` exists.
- **D2** It documents the token groups: color (brand/status/neutral/surface/accent-contrast/tajweed/home), spacing, the collapsed radius scale (with the two exceptions and their reason), type scale, shadow/elevation, and motion.
- **D3** It states the component boundary rule (D4 of the PRD): atoms → global classes; structural/stateful blocks → React primitives; complex scoped → token-valued CSS Modules — with a usage table naming which existing components fall where.
- **D4** It states the token-bypass policy (D7 of the PRD): chrome = tokens only; domain palettes = named token groups.
- **D5** It contains a resolved-contradictions table mapping each audited contradiction to its locked decision.
- **D6** It states dark mode as an explicit non-goal and names the token indirection as the future seam.

## E — No regression / no scope creep

- **E1** No `.sql` file is added or modified; no RLS policy changes. **[SEC]**
- **E2** No new route, page, schema, or React component file is added (the doc + token edits only). Promotion of a tracker primitive to `components/ui/` is out of scope for this PRD.
- **E3** `npm run build` succeeds. `npm run lint` produces no new errors.
- **E4** The primary button renders visually identical to before (gradient unchanged in appearance; only its source values are now tokens).

## Validator output format

Per ID: `A1 PASS`, `A2 FAIL — <reason>`, `C1 BLOCKED — <reason>`. **E1 is [SEC]: FAIL blocks the
milestone.** Report all IDs; do not stop at the first failure.
