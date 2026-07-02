# Acceptance / Validation Contract — 0005 Hifth Circle rework

> Written **before** code (grilling output). Each item is an observable behavior, not a code shape.
> A validator (fresh context, no implementation bias) checks the running system against this list and
> reports pass/fail per ID. Do not edit this contract to make a failing test pass — fix the code or
> escalate to the orchestrator to amend the contract deliberately.
>
> Test layers:
> - **A** (rename/schema): migration + grep assertions, unit where pure.
> - **B** (recurrence/analytics/deadline math): pure-function unit tests.
> - **C–H**: Playwright E2E (multi-actor via the existing tracker seed/reset route) for consent,
>   sessions, homework, notes, mushaf.
> - **S**: security (RLS) — direct DB assertions with a second identity.

## A. Rename + schema

- **A1** No `halaqah` identifier remains in shipped code: DB table is `circle`, FK column is
  `circle_id`, RLS fns are `is_circle_teacher`/`is_active_member`/… (grep for `halaqah` returns only
  historical docs/migration filenames, not live table/column/fn/route/component names).
- **A2** Route is `/tracker/[circleId]`; the old `/tracker/[halaqahId]` param name is gone.
- **A3** `circle` has **no** `schedule` and **no** `log_types` column. `membership` has **no**
  `shared_set_id` column and **does** have `schedule` (jsonb, nullable).
- **A4** `attendance` table does not exist; `session` has `membership_id` (not `circle_id`) and an
  `attendance_status` column.
- **A5** `homework`, `membership_note` tables exist; `progress_log` has a nullable `homework_id` FK.
- **A6** `progress_log.log_type` only ever holds `memorization`/`general_revision`/`targeted_revision`
  (no `Sabaq`/`Sabqi`/`Manzil` remain after migration).

## B. Pure logic — unit

- **B1** Per-membership recurrence: given `membership.schedule = {weekdays:[1],time:"17:00"}`,
  `missingSlots` generates one session per matching weekday over the horizon, keyed to that membership;
  a second membership's schedule generates independently. Idempotent (re-run adds nothing).
- **B2** Type→role map: `memorization`→`memorize`; `general_revision`→`revise`;
  `targeted_revision`→`revise`. Coverage map paints from `memorize` logs only; revise drives recency;
  there is no `read` role.
- **B3** Weakest-surah still computes from `teacher_status` polarity (statuses config unchanged) —
  regression: an existing analytics case passes with the new enum log types.
- **B4** Homework status derivation: `deadline` in the future → `open`; `deadline` past with 0 linked
  logs → `missed`; `deadline` past with ≥1 linked log → `completed`.

## C. Consent gate — E2E + security

- **C1** Teacher invites a student (email or link/code) → a membership exists with `status = 'pending'`;
  the student does **not** yet appear as active in the roster.
- **C2** Before accepting, the teacher can read **none** of that student's data (no progress logs, no
  default-set annotations, no notes). *(also S1–S3)*
- **C3** The invited student sees an **accept screen** naming the teacher and stating the teacher will
  see their default mushaf. Accepting flips the membership to `active`.
- **C4** A link/code visit lands on the accept screen — it does **not** silently create an active
  membership.
- **C5** After accept, the student appears active in the teacher roster.

## D. Per-student sessions + dashboard

- **D1** Teacher sets a recurring weekly slot on a **specific student's** row; generating sessions
  creates sessions for **that student only**.
- **D2** Two students with different slots produce two independent session series; the teacher
  dashboard shows an **aggregate** upcoming agenda spanning both students.
- **D3** A student, signed in, sees **only his own** upcoming session(s) — not other students' slots.
- **D4** Teacher marks attendance on a session (present/absent/late/excused); it persists on the
  **session row** (no separate attendance table); re-marking updates in place.
- **D5** Teacher adds an ad-hoc session and cancels/reinstates it for a single student.

## E. Homework — prescription

- **E1** Teacher prescribes homework to one student: type (one of the 3), page range, deadline,
  optional instructions → a `homework` row with `membership_id` + `prescribed_by = teacher`.
- **E2** The student sees the prescription in an "assigned to you" list with its type + deadline.
- **E3** Student attaches a progress submission to the prescription **before** the deadline → the log
  row has `homework_id` set; the prescription shows a linked submission.
- **E4** **Hard lock:** after the deadline, the student can **no longer** link a new submission to that
  prescription (attempt is rejected), and it shows `missed` (if none linked) or `completed`.
- **E5** Teacher **edits the deadline** to a future date → the prescription reopens and the student can
  link a submission again.
- **E6** A prescription can gather **multiple** linked submissions before its deadline.

## F. Homework — open submission

- **F1** A student submits progress **without** any prescription → a `progress_log` row with
  `homework_id = null`, using one of the 3 fixed types.
- **F2** Open submissions are **never** locked by any deadline.
- **F3** No `Sabaq/Sabqi/Manzil` (or any custom type) appears in the submit form — only the 3 fixed
  types (localized EN/AR).

## G. Notes thread

- **G1** In a student's context, the teacher posts a note → it appears attributed to the teacher.
- **G2** The **same** student, signed in, sees the teacher's note **and** can post his own; his note is
  attributed to him.
- **G3** Both parties see the **full** thread (teacher's + student's notes), each with its author.
- **G4** A different student in the same circle **cannot** see this student's notes thread. *(also S4)*

## H. Mushaf access

- **H1** Each **active** student's roster row has a **Mushaf button**; clicking it opens the reader on
  that student's **default** set (`?set=<defaultSetId>`), showing the student's annotations.
- **H2** If the student changes their default set, the teacher's Mushaf button follows to the **new**
  default (dynamic, not frozen).
- **H3** A student with **no** default set → the Mushaf button is disabled / shows an empty state (no
  crash).

## S. Security (RLS) — critical

> Asserted with a second authenticated identity hitting the DB directly (not just UI hiding).

- **S1** A **pending** membership grants the teacher **zero** read: `progress_log`, the student's
  default-set `annotations`/`notes`, `membership_note`, and `session` all return empty for that
  student until `active`.
- **S2** A teacher **cannot** self-accept a student's membership (transition `pending→active` is
  rejected for anyone but the invited `user_id`).
- **S3** An `inactive`/`blocked` membership **immediately** drops all teacher read access to that
  student's default set and progress (regression of the existing offboarding guarantee).
- **S4** A user who is **not** the circle teacher and **not** the owning student cannot read/insert that
  membership's `homework` or `membership_note` rows.
- **S5** The default-set read exposes **only** the student's `is_default` set — not their other
  (non-default) sets.
- **S6** A student cannot write teacher-only homework fields; a teacher's `progress_log` writes stay
  limited to `teacher_status`/`teacher_comment`/`reviewed_at` (existing column-freeze guarantee holds
  after the rename).

## Validator output format

For each ID: `PASS` / `FAIL` / `BLOCKED` + one line of evidence (assertion, screenshot path, or test
output). A `FAIL` on any **S** item (consent / cross-user data exposure) **blocks** the milestone.
</content>
