# Acceptance contract — 0015 Wird tracking

> **This file is the acceptance criteria. It was written before the code.**
> **Do not edit this contract to make a test pass.** If an item is wrong or impossible, stop and
> raise it with the author — changing the contract to match the implementation defeats its purpose.
> A validator reports PASS / FAIL / BLOCKED per ID. Items marked **[SEC]** block the milestone on FAIL.

## A — Data model

- **A1** `wird` exists with `id`, `user_id` (FK → `auth.users`, `on delete cascade`), `name text not null`,
  `page_start int not null`, `page_end int not null`, `scope_source text not null default 'pages'`,
  `pages_per_period int not null`, `period_days int not null`, `cycle_seq int not null default 1`,
  `cycle_page_start int not null`, `cycle_page_end int not null`, `created_at`, `updated_at`,
  `deleted_at timestamptz null`.
- **A2** `scope_source` is constrained to `'pages' | 'memorized'`.
- **A3** Check constraints enforce `1 <= page_start <= page_end <= 604`, `pages_per_period >= 1`,
  and `period_days >= 1`. A row violating any of them is rejected by the database, not only by the client.
- **A4** `wird_entry` exists with `id`, `wird_id` (FK → `wird`, `on delete cascade`),
  `entry_date date not null`, `page_start int not null`, `page_end int not null`,
  `cycle_seq int not null`, `created_at`.
- **A5** There is **no** cursor, position, or current-page column on `wird`. Position is derived.
- **A6** There is no partial, amount, or completion-percentage column on `wird_entry`.
- **A7** Deleting a `wird` row deletes its entries; soft-deleting one (`deleted_at`) does not.
- **A8** An index supports the per-user active-wird lookup and the per-wird current-cycle entry lookup.

## B — Access control **[SEC]**

- **B1** A user can select, insert, update and delete their own `wird` rows and their entries. **[SEC]**
- **B2** `wird.user_id` defaults to `auth.uid()` and cannot be set to another user by the client;
  an insert with a forged `user_id` is rejected or overwritten server-side. **[SEC]**
- **B3** A teacher of a circle the owner is an **active** member of can **select** that user's wirds
  and entries, via the existing `public.teaches_user(user_id)`. **[SEC]**
- **B4** That teacher cannot insert, update or delete any wird or entry. **[SEC]**
- **B5** An unrelated authenticated user can neither read nor write any wird or entry. **[SEC]**
- **B6** A user cannot insert a `wird_entry` against a `wird_id` they do not own. **[SEC]**
- **B7** No new RLS helper function is introduced; teacher reads use `teaches_user`.

## C — Rate and portion arithmetic (`src/lib/wirdRate.ts`, pure)

- **C1** The daily rate is `pages_per_period / period_days` and is never rounded for storage.
- **C2** The size of day *n*'s portion is `floor(n·r) − floor((n−1)·r)`. For 100 pages / 14 days the
  successive sizes are 7,7,7,7,7,7,8,7,7,7,7,7,7,8 and sum to exactly 100.
- **C3** No surface ever displays a fractional page number.
- **C4** A portion is clamped so it never extends past `cycle_page_end`.
- **C5** The projected finish date is the smallest *n* where the cumulative portion covers the
  remaining pages of the current pass.
- **C6** `period_days = 1` with `pages_per_period = 20` yields exactly 20 every day, with no drift.

## D — Position, completion and wrapping

- **D1** Position is `max(page_end) + 1` over entries of the wird's current `cycle_seq`, or
  `cycle_page_start` when that cycle has no entries.
- **D2** Tapping Done writes exactly one entry: today's date, the computed portion's start and end,
  and the wird's current `cycle_seq`.
- **D3** Tapping Done twice on the same day for the same wird does not write a second entry and does
  not advance the position.
- **D4** Missing any number of days changes nothing about the portion: the next portion always begins
  at the current position and is sized by C2. No backlog is stored, computed or displayed.
- **D5** When a portion reaches `cycle_page_end`, the next Done increments `cycle_seq`, resets
  `cycle_page_start`/`cycle_page_end` from the wird's live scope, and the position returns to the
  new `cycle_page_start`.
- **D6** The wrap produces no counter, no badge, no toast and no distinct screen. The string "khatma"
  appears nowhere in the codebase or dictionaries.
- **D7** For `scope_source = 'memorized'`, `page_start`/`page_end` are derived from
  `user_hifth.memorized_ranges` on read: the first and last page covered by any range.
- **D8** Declaring more memorized ranges mid-pass does **not** change `cycle_page_start`/`cycle_page_end`;
  the progress denominator for the pass in flight is unchanged and the bar never moves backwards.
  The new bounds take effect at the next wrap (D5).
- **D9** If memorized ranges shrink so the position falls outside the live scope, the position clamps
  to `cycle_page_end`, the progress bar reads full rather than over-full, and the next Done wraps
  (D5) to the start of the new bounds. The position is never rewritten without a Done.
- **D10** A user with no `user_hifth` row, or with empty ranges, cannot create a `'memorized'` wird;
  the form says what to do instead.

## E — Streak **[one number]**

- **E1** `computeStreak` accepts dated activity from both `progress_log` and `wird_entry` and returns
  a single streak.
- **E2** A day with only a wird entry, only a progress log, or both, counts once.
- **E3** A user with no circle membership and at least one wird entry has a non-zero streak.
- **E4** `isStreakAtRisk` behaves the same way over the merged stream.
- **E5** `StudentCircle.tsx` passes the merged stream, not `progress_log` alone.
- **E6** Soft-deleting a wird does not change the streak; its entries still count.
- **E7** The day boundary is local midnight, unchanged from the current implementation.

## F — Service layer

- **F1** Listing returns only the caller's wirds with `deleted_at is null`, in creation order, each
  with its derived position, today's portion, whether it is done today, and days since last done.
- **F2** Creating a wird trims the name, rejects an empty or whitespace-only name without a write,
  and seeds `cycle_seq = 1` with `cycle_page_*` equal to the resolved scope.
- **F3** Deleting sets `deleted_at`; it does not delete entries, and the wird stops appearing in F1.
- **F4** No service function returns wirds for another user (relies on B, not on client filtering). **[SEC]**
- **F5** Completing is idempotent per wird per local day (D3).

## G — Reference resolution (`src/components/wird/ref.ts`)

- **G1** A portion's opening reference is `PAGE_FIRST_AYAH[page_start]`, rendered as a sūra **name**
  plus ayah number via `getSurahName`.
- **G2** A portion's closing reference is `PAGE_FIRST_AYAH[page_end + 1]` decremented by one ayah,
  rolling back to the previous sūra's last ayah via `AYAH_COUNTS` when the decrement crosses a
  boundary. At page 604 it is An-Nās 6.
- **G3** No surface renders a bare colon reference such as `18:62`.
- **G4** These are the required values for the stated inputs, and a test asserts them:
  pages 301–320 → **Al-Kahf 62** → Ṭā-Hā 125; page 297 → **Al-Kahf 28** → Al-Kahf 34;
  pages 578–584 → **Al-Qiyāma 20** → An-Nāzi'āt 46.
- **G5** A scope of 293–304 named after Sūrat al-Kahf resolves its opening reference to
  **Al-Isrā 105** and displays that, not "Al-Kahf 1".
- **G6** Resolution is presentation only: no reference is persisted.

## H — The daily screen

- **H1** `/wird` exists, is the first rail section in `NavRail`, and renders active there.
- **H2** A logged-in request to `/` lands on `/wird`, not `/reader`.
- **H3** With no wirds, `/wird` renders an empty state that says what to do next. It does not redirect.
- **H4** Cards are a horizontal snap strip using CSS `scroll-snap-type: x mandatory` and
  `overflow-x`. No gesture library and no pointer/touch event handlers are added.
- **H5** With five or fewer wirds the index is dots, reflecting the active card via
  `IntersectionObserver` and marking completed wirds distinctly. With six or more it is a count
  ("4 / 9") instead, on one line at any number.
- **H5a** Cards are ordered: outstanding wirds first in creation order, then wirds already completed
  today. The order of outstanding wirds does not change during a day.
- **H6** At ≥ `lg` the card caps at 520px, is centred, and `‹ ›` buttons plus arrow keys move between
  cards using the same handler.
- **H7** Each card shows: the wird name, its scope, the opening reference as the largest element,
  the closing reference, the page range, the progress bar, `N pages to go`, and the disc.
- **H8** The disc is 72×72, `border-radius: var(--radius-full)`, flat `var(--accent-solid)`, glyph in
  `var(--accent-contrast)`, and carries an accessible name of "Done".
- **H9** The disc rests **unfilled** and fills on completion.
- **H10** There is exactly one interactive control per card. No end-page control, stepper or sheet
  exists anywhere in the feature.
- **H11** `N pages to go` counts from the current position to `cycle_page_end`, is singular at 1, and
  decreases by the portion when Done is tapped.
- **H12** The word "cycle" appears in no user-facing string in any locale.

## I — States

- **I1** *Populated* — several wirds, one per card.
- **I2** *Done today* — a completed wird's card shows its completed state and its disc is not a
  second time re-tappable.
- **I3** *All done* — when the last outstanding wird is completed, the all-done screen replaces the
  strip, states what was completed, and names where the next portion begins.
- **I4** *Stale* — a wird not completed for ≥ 1 day shows an amber bar across the top of the card
  naming the gap: "Waiting since yesterday" at 1 day, "Waiting 3 days" at 3. Tone is identical at
  every age.
- **I5** The stale marker never blocks the disc, never withholds a portion, and never uses the words
  "unlock", "overdue", "late" or "failed".
- **I6** Completing clears the marker in the same interaction.
- **I7** *First day* — a wird created today, with no entries, shows no streak and no projected finish
  rather than a zero or a placeholder.
- **I8** *Overflow* — nine wirds render without the layout breaking and without the disc leaving the
  thumb zone at 390×844.
- **I9** *Truncate* — a long name truncates without pushing any other element out of the card.
- **I10** *Saving* — the in-flight disc uses the shipped `.btn[data-busy]` behaviour.
- **I11** *Error* — a failed completion says what happened and how to retry, and the position does
  not advance.

## J — Motion

- **J1** Tapping the disc runs a squash-and-stretch: compress on press, overshoot on release, glyph
  in late. Duration `--duration-bounce` (520ms).
- **J2** The completed card then leaves toward the inline-start edge over `--duration-exit` (320ms)
  on `--ease-out`, with a slight downward drift and **no rotation**.
- **J3** The travel is a single keyframe pair. No intermediate keyframe stop, which would re-ease the
  segment and read as two steps.
- **J4** The opacity fade is a separate animation so that holding opacity cannot re-split the travel.
- **J5** The strip closes the gap **while** the card is still travelling; the card is removed from
  layout only when the travel ends. Setting the removal at 0ms is a defect (it yanks the slide out in
  one frame and the card never appears to move).
- **J6** The JS that removes the card reads the exit duration from CSS. A hardcoded constant that can
  disagree with the stylesheet is a defect.
- **J7** The all-done screen arrives from the inline-**end**, matching the direction a next card would
  come from. It does not rise from the bottom.
- **J8** Exit direction derives from one custom property that flips under `[dir="rtl"]`; in Arabic the
  cards leave the other way.
- **J9** Every animation has a `prefers-reduced-motion: reduce` path, and under it the state still
  changes visibly — the disc still fills, the bar still advances, the card still leaves.
- **J10** Re-completing after a reset leaves no stuck element, timer or class from a previous run.

## K — Create and edit

- **K1** The form captures name, scope and rate, and states the projected finish date before saving.
- **K2** Scope presets are whole mushaf, a juz range, one sūra, and what I've memorized; each fills
  `page_start`/`page_end`, and both numbers remain editable afterwards.
- **K3** Editing either page number clears the active preset selection.
- **K4** The sūra preset's end page is the next sūra's first page − 1, and for An-Nās it is 604.
- **K5** Choosing "what I've memorized" sets `scope_source = 'memorized'` and shows a note stating
  that newly memorized surahs join this wird, and that they take effect at the start of its next pass.
- **K6** Every other preset sets `scope_source = 'pages'`.
- **K7** Rate is a page count plus a period of 1, 7, 14 or 30 days, and the form shows the resulting
  daily portion using C2 — never `floor(pages/days)`.
- **K8** An end page before the start page is rejected with a message saying what happened and how to
  fix it.
- **K9** A legal but extreme rate (a page every 10 days) saves, and the form states the consequence
  before it does.

## L — Teacher view

- **L1** A wird summary card renders in the left `<aside>` of `StudentProfileCard`, between the
  open-homework `StatCard` and the marked-pages card.
- **L2** It is read-only; no control in it writes.
- **L3** It renders only for a teacher of an active membership, and never for the student's own view
  of themselves or for a substitute.
- **L4** A student with no wirds renders no card at all, rather than an empty one.

## M — Design system compliance

- **M1** No bare hex and no bare px for colour or radius in any new component; chrome reads tokens.
- **M2** `.btn-circle` and `.btn-tall` are defined in `globals.css` as atoms, not re-implemented in
  component files.
- **M3** `.btn-circle` extends `.btn` so `[data-busy]` and `[data-done]` keep working, and defines its
  own `[data-done]` appearance, since the shipped rule only changes a border and a text colour.
- **M4** `SegmentedControl` and `NumberStepper` live in `src/components/ui/` and `tracker/ui.tsx`
  re-exports them; no tracker import path breaks.
- **M5** Only `--duration-bounce` and `--duration-exit` are added to the token layer. No new colour
  token is introduced; amber derives from `--warning`.
- **M6** No dark-mode variant is added.

## N — i18n

- **N1** Every new string exists in both `en` and `ar` in `src/lib/i18n/dictionaries.ts`.
- **N2** No new string is hardcoded in a component.
- **N3** The screen renders correctly under `[dir="rtl"]`, including the pager direction (J8), the
  progress bar fill direction and the stale bar.
- **N4** Numerals render through the existing `fmtNum`.
- **N5** Neither locale contains "cycle", "khatma", "sabaq", "sabqi" or "manzil".

## O — Tests

- **O1** Unit tests cover the C2 portion sequence, including that 100/14 sums to exactly 100 over 14
  days and that 20/1 never drifts.
- **O2** Unit tests cover G4 and G5 reference resolution against the real data files.
- **O3** Unit tests cover the merged streak (E2, E3, E6).
- **O4** Unit tests cover wrapping (D5), the frozen denominator (D8) and the shrink-clamp (D9).
- **O4a** A unit test covers the card ordering rule (H5a), including that completing a wird moves it
  after the outstanding ones on the next load.
- **O5** An E2E test completes a wird and asserts the **outcome** — the position advanced, the entry
  exists, the card left, `N pages to go` decreased — not merely that a button is present.
- **O6** An E2E test asserts that completing the last outstanding wird reaches the all-done screen.
- **O7** Every E2E test fails on a browser console error.
