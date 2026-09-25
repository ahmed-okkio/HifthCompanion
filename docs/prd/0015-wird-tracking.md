# PRD 0015 — Wird tracking (grill output)

> A **wird** (ورد) is the fixed daily portion of Quran someone commits to and keeps returning to.
> This adds several named wirds per user, each with its own scope, rate and position, a daily screen
> that opens on app launch, and one tap to complete today's portion. The acceptance contract
> (`0015-wird-tracking-contract.md`) is the source of truth for "done".

## Problem / Goal

- Nothing in the app tells a user **what to recite today**, and nothing records that they did unless
  a teacher's circle owns the obligation. `progress_log.membership_id` is `not null`, so a user with
  no circle cannot log anything at all — and cannot have a streak, because `computeStreak`
  (`src/lib/streak.ts:8`) only ever sees `progress_log` rows.
- A logged-in user has **no home**. `/` redirects to `/reader` (`src/app/page.tsx:18`), which
  redirects to the bookmarked page. The app opens inside the mushaf with no sense of standing
  practice.
- `user_hifth.memorized_ranges` (PRD 0008) records what someone has memorized, but nothing turns it
  into a revision routine.

Goal: a personal, standing daily practice that is legible in two seconds and cleared in one tap.

## Principles

- **A wird has a position, not a task list.** State is "where am I in this pass", never "what is
  checked off". The screen answers *what do I recite now*.
- **Never negotiate the portion.** The daily amount is set once, at creation. A screen that
  re-proposes a different portion each morning is a suggestion box, not a wird.
- **No debt, ever.** Missing days costs the projected finish date and the streak. It never
  accumulates a backlog, and it never withholds anything. Miss five days: still one tap.
- **The history is the state.** Position derives from dated entries; there is no cursor column to
  drift out of sync with them.
- **Say the scope, not an abstraction.** One pass through a wird has no user-facing noun — not
  "cycle", not "khatma". Copy names the actual scope, or the pages remaining.
- **Page numbers are storage; sūra and ayah are the interface.** Scope and rate are stored in pages.
  Every screen shows where to *start reciting*, resolved through `PAGE_FIRST_AYAH`.

## Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | New table `wird(id, user_id, name, page_start, page_end, scope_source, pages_per_period, period_days, cycle_seq, cycle_page_start, cycle_page_end, created_at, updated_at, deleted_at)` | Personal and user-scoped, not membership-scoped: a wird exists with or without a circle, which is the gap `progress_log` cannot fill |
| D2 | New table `wird_entry(id, wird_id, entry_date, page_start, page_end, cycle_seq, created_at)` | Dated rows buy streak, history and "kept 12 of 14 days" for free; a cursor column buys only the bar |
| D3 | **No cursor column.** Position = `max(page_end) + 1` over entries of the current `cycle_seq`, else `cycle_page_start` | One source of truth. A cursor plus entries can disagree after any edit, and then the bug is "which one lied" |
| D4 | **No partial completion.** Done writes exactly the computed portion. No end-page editor, no stepper, no correction path | Reversed from the grill's first answer after seeing it rendered: a second control beside the one daily action competed with it, and `End page 584` read as a measurement the app had somehow taken. The app never knows where you stopped — you tell it by tapping, or you don't tap |
| D5 | Rate is `pages_per_period` + `period_days`. Today's portion size is `floor(n·r) − floor((n−1)·r)` where `r = pages_per_period / period_days` | Expresses "1 juz a day" (20·1) and "5 juz every 2 weeks" (100·14) without mangling either. `floor(r)` would ship 7 pages/day for 100/14, losing 2 pages every pass and drifting the finish date |
| D6 | Missed days slide. There is only ever **one** portion and it does not move until Done is tapped | Chosen over accumulating debt: a 60-page backlog after a week away is unachievable and is where people quit |
| D7 | At the scope end the position wraps **silently**. No khatma counter, no completion screen for the wrap | A 3-juz revision loop finishing is not a khatma, and labelling it one cheapens the word. `cycle_seq` increments; nothing is announced |
| D8 | `scope_source = 'memorized'` derives `page_start`/`page_end` from `user_hifth.memorized_ranges` on read and **stays live**. The current pass keeps the bounds it began with (`cycle_page_*`); growth applies at the next wrap | Live was chosen so newly memorized surahs join automatically. Freezing the pass stops the progress bar going backwards (40/63 → 40/83) when someone declares another juz mid-pass |
| D9 | RLS: owner full access; a teacher reads via the **existing** `public.teaches_user(user_id)` (PRD 0008) | No new policy helper. Teacher visibility is unconditional — no per-wird share flag |
| D10 | **One streak.** `computeStreak` takes `progress_log` dates and `wird_entry` dates together | Both are "I showed up today". Two numbers on one student page answers nothing. Also gives a circle-less user a streak, which is impossible today |
| D11 | `/wird` is a new **first** rail section and the logged-in landing page (`src/app/page.tsx`) | The daily ritual should be what opens. With no wirds it shows its empty state rather than redirecting, so the feature is discoverable |
| D12 | The screen is a **pager**: one wird per card, horizontal `scroll-snap-type: x mandatory`, dots via `IntersectionObserver`. No gesture library, no pointer handlers. Desktop caps the card at 520 and adds `‹ ›` + arrow keys | CSS scroll snap *is* the swipe. Chosen over a scrolling list because the list's action walks out of the thumb zone once there are more than four wirds |
| D13 | Progress is one linear bar across the scope, position only. The line under it reads `N pages to go` | Distance remaining, counted from today's first page, so it does not move while reading and drops by the portion on Done |
| D14 | The action is **one** control: a 72px circular disc, new `.btn-circle` atom, flat `--accent-solid` | Not `.btn-primary` — its 135° gradient reads as a lighting error across a 72px disc. 72 rather than the 56 floor because a circle's usable target is its inscribed area |
| D15 | Stale marker: an amber inline bar across the top of the card, `--warning`. Wording names the gap ("Waiting since yesterday", "Waiting 3 days") at every age | It never escalates in tone, never says "overdue" or "unlock", and never blocks the disc |
| D16 | Motion: squash-and-stretch on the disc, card slides out, all-done screen slides in from the inline-end. Exit 320ms | The tap is the one moment the feature lives on. Every animation has a `prefers-reduced-motion` path that still changes state visibly |
| D17 | The teacher sees wird activity **merged into the existing progress view**, as a card in the left `<aside>` of `StudentProfileCard` (`TeacherStudent.tsx:291`), between the open-homework `StatCard` and the marked-pages card | Author's placement. Merged means the teacher sees *that* the student kept their practice, not *which* wird slipped — accepted trade |
| D18 | ~~No reminders in v1.~~ **Reversed (0016):** a daily push at the user's `profiles.wird_reminder_time` (default 18:00, 15-min steps, null = off) in `profiles.timezone`, only while a wird with a non-empty portion is undone today. pg_cron ticks `/api/cron/wird-reminder` every 15 min | Scheduler = pg_cron; per-user time in Settings; offered once in a sheet after the first wird. Suppression once done = the "left today" check. No quiet hours: the user picks the time |
| D19 | Deleting a wird is a **soft delete**; its entries are retained and keep feeding the streak | You did recite on those days. A streak that shortens retroactively reads as a bug |
| D20 | A day is a **local-midnight** day, matching `computeStreak` today. (0016: the service had been stamping the UTC date; it now uses `profiles.timezone` via `src/lib/localDate.ts`, and `computeStreak` the runtime's local date) | One streak means one boundary; changing it here would change every circle streak too |
| D21 | Create form: scope via presets that fill two page numbers (whole mushaf / juz range / one sūra / what I've memorized), rate via a number + a days dropdown (1 / 7 / 14 / 30) | Both numbers stay editable after a preset fills them. `src/lib/quran.ts` already ships every conversion (`juzPageBounds`, `SURAH_FIRST_PAGES`, `getPageForAyah`) |
| D22 | `SegmentedControl` and `NumberStepper` move from `src/components/tracker/ui.tsx` to a new `src/components/ui/` and are re-exported | First use outside `tracker/`, which is exactly the promotion rule in `docs/design-system.md` §2 |
| D23 | A sūra-named scope does **not** imply sūra-aligned pages, and the UI must not pretend otherwise | "Sūrat al-Kahf" resolves to 293–304, but page 293 opens on **Al-Isrā 105**. Labelling that boundary "Al-Kahf 1" would be false |

## What this deliberately does not do

- No khatma counter and no wrap celebration (D7).
- No partial or corrected entries (D4) — so no edit-history UI either.
- No email reminders. (Push reminders were added in 0016, D18.)
- No per-wird teacher sharing toggle (D9) and no teacher-prescribed wird: `homework` is already the
  prescription primitive and two of them would confuse a student.
- No dark mode. `docs/design-system.md` §5 still holds.

## Surfaces

| Surface | File | Change |
|---|---|---|
| Daily screen | `src/app/wird/page.tsx` | new route |
| Pager + card | `src/components/wird/WirdPager.tsx`, `WirdCard.tsx` | new |
| Progress + label | `src/components/wird/Progress.tsx` | new |
| Create / edit | `src/components/wird/WirdForm.tsx`, `ScopePicker.tsx` | new, modal over `/wird` |
| Ref resolution | `src/components/wird/ref.ts` | new, presentation only |
| Rate maths | `src/lib/wirdRate.ts` | new, pure |
| Service layer | `src/lib/services/wird.ts` | new |
| Rail | `src/components/NavRail.tsx` | Wird added first, active |
| Landing | `src/app/page.tsx` | logged-in redirect `/reader` → `/wird` |
| Streak | `src/lib/streak.ts`, `src/components/tracker/StudentCircle.tsx:89` | both streams merged |
| Teacher view | `src/components/tracker/TeacherStudent.tsx:291` | wird card in the aside |
| Atoms | `src/app/globals.css` | `.btn-circle`, `.btn-tall`, motion tokens |
| Promotion | `src/components/ui/` | `SegmentedControl`, `NumberStepper` |
| Types | `src/types/index.ts` | `Wird`, `WirdEntry`, `WirdScopeSource` |
| i18n | `src/lib/i18n/dictionaries.ts` | en + ar |
| Schema | `supabase/migrations/20260921000001_wird.sql` | new |

## New design tokens

Only two are genuinely new; everything else reuses the shipped scale.

| Token | Value | Used by |
|---|---|---|
| `--duration-bounce` | `520ms` | the disc's squash-and-stretch |
| `--duration-exit` | `320ms` | the card leaving, read by JS so removal stays in step |

The exit easing is `cubic-bezier(.16,1,.3,1)` — the existing `--ease-out`. Amber tints derive from
`--warning` via `color-mix()`, so no new colour enters the palette.

## Resolved at build time

These three were open when the PRD was written and were answered before implementation began.

| Q | Answer |
|---|--------|
| Scope shrinks under the position | Clamp to `cycle_page_end`, bar reads full, next Done wraps into the new bounds. The position is never rewritten without a tap (contract D9) |
| Index at many wirds | Dots at ≤ 5 wirds, a count ("4 / 9") at ≥ 6 (contract H5) |
| Card order | Outstanding first in creation order, completed-today after them; outstanding order is stable within a day (contract H5a) |
