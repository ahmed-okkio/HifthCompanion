# Build Manifest — 0015 Wird tracking

> Single file `/implement` consumes. Links, milestone ladder, contract→work mapping.
> - PRD: `0015-wird-tracking.md`
> - Contract: `0015-wird-tracking-contract.md`
>
> **Security-critical contract IDs (block milestone on FAIL): B1–B7, F4.**

## Milestone ladder

Ordered; each is one worker slice. Every contract ID is covered by exactly one milestone.

### M1 — Tables, RLS, types, mock
- **Goal:** `wird` + `wird_entry` with owner-full / teacher-read policies.
- **Files:** new `supabase/migrations/20260921000001_wird.sql`; `src/types/index.ts`
  (`Wird`, `WirdEntry`, `WirdScopeSource`); `src/lib/supabase/mock.ts` if it enumerates tables.
- **Constraints:** teacher read uses the **existing** `public.teaches_user(_student uuid)` from
  `20260704000001_user_hifth.sql` — do **not** write a new helper, and do **not** grant
  `covers_membership`. `user_id uuid not null references auth.users(id) on delete cascade default
  auth.uid()`; the insert policy must require `user_id = auth.uid()`. `wird_entry` policies gate on
  ownership of the parent `wird`. Check constraints per A3. Indexes per A8. Soft delete is
  `deleted_at`; the FK cascade in A7 is about hard deletes only.
- **Contract IDs:** A1–A8, B1–B7 *(all blocking)*.

### M2 — Pure logic + tests
- **Goal:** the rate/portion/position maths and reference resolution, with no I/O.
- **Files:** new `src/lib/wirdRate.ts`; new `src/components/wird/ref.ts`; `src/lib/streak.ts`;
  new `src/tests/wirdRate.test.ts`, `src/tests/wirdRef.test.ts`; extend `src/tests/streak.test.ts`.
- **Constraints:** `floor(n·r) − floor((n−1)·r)`, never `floor(r)` — C2's 14-day sequence must sum to
  exactly 100. All functions take `now`/`today` as a parameter, mirroring `sectionSessions`
  (`src/lib/recurrence.ts:126`) and the existing `isStreakAtRisk`. `ref.ts` reads `PAGE_FIRST_AYAH`,
  `AYAH_COUNTS` and `getSurahName` from `src/lib/quran.ts` — no new data files, and it is presentation
  only. `computeStreak`/`isStreakAtRisk` keep their current signature shape (`{ log_date }[]`) so
  wird entries map in at the call site rather than the function growing a second parameter.
  Vitest, no new dependency.
- **Contract IDs:** C1–C6, D1, D3, D4, D5, D8, D9, E1–E4, E7, G1–G6, O1, O2, O3, O4.

### M3 — Service layer
- **Goal:** the CRUD + completion service, and live scope resolution.
- **Files:** new `src/lib/services/wird.ts`.
- **Constraints:** follow `src/lib/services/agenda.ts` exactly — `'use server'`, `createClient` for
  reads, `createClientAction` for writes, throw on error, **no client-side user filtering** (RLS is
  the gate, F4). `scope_source = 'memorized'` resolves bounds from `user_hifth.memorized_ranges` on
  read (D7); the stored `cycle_page_*` are never recomputed except on wrap (D8). Completion is
  idempotent per wird per local day (D3/F5) and performs the wrap when the portion reaches
  `cycle_page_end` (D5). Ordering per H5a is computed here, not in the component.
- **Contract IDs:** D2, D6, D7, D10, E5, E6, F1–F5 *(F4 blocking)*, H5a.

### M4 — Atoms, tokens, primitive promotion
- **Goal:** the shared styling this feature needs, before any screen uses it.
- **Files:** `src/app/globals.css`; new `src/components/ui/index.ts` (+ moved primitives);
  `src/components/tracker/ui.tsx` (re-export); `docs/design-system.md`.
- **Constraints:** `.btn-circle` extends `.btn` (so `[data-busy]`/`[data-done]` keep working) and
  adds its own `[data-done]` appearance, because the shipped rule only changes a border and a text
  colour. Flat `var(--accent-solid)`, **not** the `.btn-primary` gradient. Add exactly two tokens:
  `--duration-bounce: 520ms`, `--duration-exit: 320ms`. No new colour token — amber derives from
  `--warning` via `color-mix()`. Move `SegmentedControl` and `NumberStepper` to `src/components/ui/`
  and re-export from `tracker/ui.tsx` so **no existing import path breaks**. Update the design-system
  doc's promotion note.
- **Contract IDs:** M1–M6 *(contract section M)*.

### M5 — The daily screen
- **Goal:** `/wird`, the pager, the card, progress, the disc, and every state.
- **Files:** new `src/app/wird/page.tsx`, `src/app/wird/layout.tsx`, `src/app/wird/loading.tsx`;
  new `src/components/wird/WirdPager.tsx`, `WirdCard.tsx`, `Progress.tsx`;
  `src/components/NavRail.tsx`; `src/components/MobileNavDrawer.tsx`; `src/app/page.tsx`.
- **Constraints:** `AppShell` for chrome, as `/sets` does. The strip is CSS
  `scroll-snap-type: x mandatory` + `overflow-x` — **no gesture library, no pointer/touch handlers**
  (H4). Dots via `IntersectionObserver`, switching to a count at ≥ 6 wirds (H5). Exactly one
  interactive control per card (H10) — if an end-page control, stepper or sheet appears anywhere,
  the slice is wrong. Disc is 72×72 and rests unfilled. Add Wird first in `RAIL_ITEMS` and to the
  mobile drawer. Change the logged-in redirect in `src/app/page.tsx` from `/reader` to `/wird`.
  All strings through the dictionary — none hardcoded.
- **Contract IDs:** H1–H12, I1–I11.

### M6 — Motion
- **Goal:** the tap, the exit and the all-done arrival.
- **Files:** `src/app/globals.css`; `src/components/wird/WirdCard.tsx`, `WirdPager.tsx`.
- **Constraints:** squash-and-stretch on the disc over `--duration-bounce`; card exits toward the
  inline-start over `--duration-exit` on `--ease-out`, with a slight drop and **no rotation**.
  The travel is a **single keyframe pair** — an intermediate stop re-eases the segment and reads as
  two steps (J3). The fade is a **separate** animation (J4). The strip closes the gap *while* the
  card travels; removal from layout happens at the end, and the JS that removes it **reads the
  duration from CSS** rather than holding a constant (J5, J6). Direction comes from one custom
  property that flips under `[dir="rtl"]` (J8). Every animation needs a `prefers-reduced-motion`
  path that still changes state visibly (J9). Reference implementation of all of this, already
  tuned and approved, is the scratchpad prototype `wird-motion.html` (variants D2, X1, S1).
- **Contract IDs:** J1–J10.

### M7 — Create and edit
- **Goal:** the form that defines a wird.
- **Files:** new `src/components/wird/WirdForm.tsx`, `src/components/wird/ScopePicker.tsx`;
  `src/app/wird/page.tsx` (mount as a modal).
- **Constraints:** scope presets are a `SegmentedControl` (now from `src/components/ui/`) over
  whole mushaf / juz range / one sūra / what I've memorized, each writing the two page numbers,
  both of which stay editable; editing either clears the preset selection (K3). Sūra end page is the
  next sūra's first page − 1, with 604 for An-Nās (K4) — a real edge, not a theoretical one. Rate is
  a `NumberStepper` plus a 1/7/14/30 `select.input`. The derived daily figure uses `wirdRate.ts`
  (M2), never `floor(pages/days)` (K7). Reuse `SurahCombobox` and the juz grid idiom from
  `MemorizationEditor.tsx` rather than inventing pickers.
- **Contract IDs:** K1–K9, D10.

### M8 — Teacher view
- **Goal:** the read-only summary in the student page's left column.
- **Files:** `src/components/tracker/TeacherStudent.tsx`;
  `src/app/tracker/(shell)/[circleId]/student/[membershipId]/page.tsx`.
- **Constraints:** a new card inside the existing `<aside>` of `StudentProfileCard`
  (`TeacherStudent.tsx:291`), **between** the open-homework `StatCard` and the marked-pages card.
  Read-only — no control in it writes (L2). Renders nothing when the student has no wirds (L4).
  Load server-side in the page and pass down as props, as the other blocks do. Merged summary, not
  per-wird rows — that is the accepted trade of D17.
- **Contract IDs:** L1–L4.

### M9 — i18n, E2E, full sweep
- **Goal:** both locales, the end-to-end paths, and the repo's verification gate.
- **Files:** `src/lib/i18n/dictionaries.ts`; new `playwright/wird.spec.ts`.
- **Constraints:** every new string in `en` **and** `ar`; numerals via `fmtNum`; RTL correct
  including pager direction, bar fill and the stale bar (N3). Grep both locales and the whole
  codebase for `cycle`, `khatma`, `sabaq`, `sabqi`, `manzil` — all must be absent from user-facing
  strings (N5, H12, D6). E2E asserts **outcomes** per `AGENTS.md`: the position advanced, the entry
  exists, the card left, `N pages to go` decreased — not that a button rendered. Every E2E test
  fails on a browser console error. Then run the full gate: `npx tsc --noEmit`,
  `npm run build:check`, `npm run test`, `npm run test:e2e`.
- **Contract IDs:** N1–N5, O5, O6, O7.

## Coverage check

| Section | IDs | Milestone |
|---|---|---|
| A | A1–A8 | M1 |
| B | B1–B7 | M1 |
| C | C1–C6 | M2 |
| D | D1, D3, D4, D5, D8, D9 | M2 |
| D | D2, D6, D7, D10 | M3 (D10 also M7) |
| E | E1–E4, E7 | M2 |
| E | E5, E6 | M3 |
| F | F1–F5 | M3 |
| G | G1–G6 | M2 |
| H | H1–H4, H5, H6–H12 | M5 |
| H | H5a | M3 |
| I | I1–I11 | M5 |
| J | J1–J10 | M6 |
| K | K1–K9 | M7 |
| L | L1–L4 | M8 |
| M | M1–M6 | M4 |
| N | N1–N5 | M9 |
| O | O1–O4a | M2 |
| O | O5–O7 | M9 |

## Standing constraints for every worker

- The contract is fixed. If a slice cannot satisfy an ID, **stop and report** — never edit the
  contract, and never weaken a test to pass.
- `docs/design-system.md` §3 holds: tokens only for chrome, no bare hex, no bare px for colour or
  radius. Domain palettes are the only sanctioned literals.
- Dark mode is out of scope (§5).
- Reuse before invention: check `src/components/tracker/ui.tsx` and `src/lib/quran.ts` before writing
  a primitive or a conversion. Both already carry most of what this feature needs.
- Do not touch the scratchpad prototypes; they are reference only and are not part of the repo.
