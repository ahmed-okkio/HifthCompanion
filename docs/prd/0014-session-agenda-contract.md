# Acceptance contract — 0014 Session agenda

> **This file is the acceptance criteria. It was written before the code.**
> **Do not edit this contract to make a test pass.** If an item is wrong or impossible, stop and
> raise it with the author — changing the contract to match the implementation defeats its purpose.
> A validator reports PASS / FAIL / BLOCKED per ID. Items marked **[SEC]** block the milestone on FAIL.

## A — Data model

- **A1** `agenda_item` exists with `id`, `membership_id` (FK → `membership`, `on delete cascade`),
  `author_id`, `body text not null`, `done_at timestamptz null`, `created_at`, `updated_at`.
- **A2** `author_id` defaults to `auth.uid()` and is not settable by the client. **[SEC]**
- **A3** An open item is exactly `done_at is null`; there is no separate status column, archive
  column, or soft-delete flag.
- **A4** No column references a session, session instant, or due date.
- **A5** Deleting a membership deletes its agenda items.
- **A6** An index supports the per-membership open-items lookup.

## B — Access control **[SEC]**

- **B1** The circle's own teacher (`teaches_active_membership(membership_id)`) can select, insert,
  update and delete that membership's agenda items. **[SEC]**
- **B2** The student who owns the membership cannot read any agenda item for it. **[SEC]**
- **B3** A user with an active substitution covering that membership cannot read any agenda item for
  it. **[SEC]**
- **B4** An unrelated authenticated user cannot read, insert or update any agenda item. **[SEC]**
- **B5** Insert with a forged `author_id` is rejected or the value is overwritten server-side; the
  stored `author_id` is always the caller. **[SEC]**
- **B6** A teacher cannot move an item to another membership they do not teach. **[SEC]**

## C — Service layer

- **C1** Listing a membership's agenda returns all open items plus only those done items with
  `done_at` within the last 30 days.
- **C2** Open items are returned oldest-first (the longest-outstanding item reads first); done items
  are returned newest-done first.
- **C3** Adding an item persists trimmed body text and returns the created row; empty or
  whitespace-only bodies are rejected without a database write.
- **C4** Ticking an item sets `done_at`; unticking clears it back to null. Both are idempotent.
- **C5** Dismissing an item is the same operation as ticking it — no third state is written.
- **C6** Editing an item updates `body` and `updated_at` and leaves `done_at`, `author_id` and
  `created_at` untouched.
- **C7** No service function returns agenda rows for a membership the caller does not teach (relies
  on B1, not on client filtering). **[SEC]**

## D — Live window (pure logic)

- **D1** A session instant is *live* when `now` is within 60 minutes before or 60 minutes after
  `scheduled_at`, inclusive of the boundaries.
- **D2** An instant 61 minutes before, or 61 minutes after, is not live.
- **D3** A canceled session is never live.
- **D4** The live computation is a pure function of (instant, now) — it performs no I/O and reads no
  module-level clock other than the value passed in.

## E — Agenda tab

- **E1** The teacher's student page shows an **Agenda** tab first in the tab bar, and it is the tab
  selected on first render regardless of the current time.
- **E2** The Agenda tab renders the next session's card — scheduled time, attendance controls,
  reschedule, cancel, assign-substitute — with the same behavior it had in the Sessions tab,
  including materializing a virtual slot on first touch.
- **E3** The Sessions tab no longer renders the Next-session card, and still renders the schedule
  editor, the Upcoming list and the History list.
- **E4** When the next session is live (D1) the card is visually distinguished and shows a relative
  countdown; outside the window it renders in its plain state.
- **E5** Open agenda items render as a tickable list; ticking an item shows it struck through without
  a page reload.
- **E6** Done items are not in the open list; they appear under a collapsed "Done" disclosure with a
  count.
- **E7** An open item older than 14 days renders its age with a warning treatment; a newer one does
  not.
- **E8** Adding is a control that reveals a single free-text input; submitting appends the item to
  the open list without a page reload, and there is no field for type, deadline, or visibility.
- **E9** An item can be edited in place and the edited text persists across a reload.
- **E10** Each item offers a dismiss affordance whose effect is identical to ticking it.

## F — Waiting-on-you block

- **F1** The block lists homework whose deadline is on or before today and which has no linked
  submission.
- **F2** The block lists submissions with `reviewed_at === null` and links to where they are graded.
- **F3** The block shows the most recent past session **only when its attendance is still unmarked**,
  naming its date. A session marked present, late, absent or excused is settled and produces no row,
  and a marked recent session hides an older unmarked one. *(Amended 2026-07-24, after the original
  "shows the status whatever it is" put settled sessions — notably excused — under a heading that
  claims they need attention.)*
- **F4** The block shows a scheduled exam only when its date is within 14 days; a later exam produces
  no row.
- **F5** The block does not render weakest-surah data.
- **F6** When F1–F4 are all empty the block is not rendered at all.
- **F7** The block issues no additional data fetch — it derives from the props the page already
  passes to the student view.

## G — Circle roster

- **G1** A roster row for a student whose next session is live (D1) shows a live indicator and the
  session time.
- **G2** A roster row for a student with no live session shows neither.
- **G3** The roster's session data is fetched in a single query for all students, not one query per
  student.
- **G4** The roster continues to render correctly for a circle whose students have no schedule.

## H — Empty states & i18n

- **H1** With no open items but a session upcoming, the agenda shows a prompt line and the add
  control, and the Next card and waiting-on-you block still render.
- **H2** With no schedule and no sessions, the Next card is replaced by a link into the Sessions tab
  and the agenda list still renders.
- **H3** With no items, no schedule, no homework, no logs and no exams, the tab renders a single
  empty state rather than three separate ones.
- **H4** The Agenda tab is present for every active student regardless of state.
- **H5** Every string added by this feature exists in both the `en` and `ar` dictionaries; no
  hardcoded English appears in the components.
- **H6** The Notes tab's label and behavior are unchanged.

## I — Non-regression

- **I1** Existing session behavior — reschedule, cancel, substitute assignment, attendance marking,
  `moved_from` handling — is unchanged by the card's move.
- **I2** The student's own circle view is unchanged and shows no agenda data.
- **I3** The existing `AgendaItem` type in `TeacherCircle.tsx` (a session slot) is not repurposed;
  the new type carries a distinct name.
- **I4** The existing test suite passes.
