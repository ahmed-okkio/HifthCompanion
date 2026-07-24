# PRD 0013 — Substitute teacher (grill-with-docs output)

> A circle teacher can hand one session — or a run of sessions across many students — to another
> teacher (the *substitute*). While the coverage window is live, the substitute can mark attendance,
> log/grade progress, and read that student's history and mushaf; access expires when the covered
> session passes. Every mark records who made it. The acceptance contract
> (`0013-substitute-teacher-contract.md`) is the source of truth for "done".

## Problem / Goal

- A circle has exactly one teacher (`circle.teacher_id`, `20260705000007_one_circle_per_teacher.sql`).
  When that teacher is away, nobody else can run a session: `session` RLS grants write only to
  `teaches_active_membership` (`20260701000002_session_restructure.sql:67-74`) and `progress_log`
  grade only to the same (`20260701000004_circle_rls.sql:16-23`). Today the away-teacher's students
  simply go unattended in the record.
- Sessions are largely **virtual** — recurrence slots materialized on first touch
  (`src/lib/recurrence.ts`, `materializeSession` in `src/lib/services/sessions.ts:75`). Any
  substitution mechanism must attach to a slot *instant*, not require a pre-existing row, exactly as
  `moved_from` does (`20260712000001_session_moved_from.sql`).

Goal: let a teacher assign a trusted substitute to specific session instants, give that substitute
scoped, self-expiring access to teach those sessions, notify the people affected, and keep an honest
record of who did what.

## Principles

- **Store per covered session, not per range.** The unit is one `(membership, session-instant, sub)`
  row. A date "window" is only a UI convenience for bulk-picking instants; nothing range-shaped is
  persisted. This deletes every overlap / precedence / gap-splitting problem before it exists.
- **Access is a function of the data, not a flag.** A substitute can reach a student iff a
  non-expired substitution row says so. No grant table, no revoke button, no cleanup job — editing or
  deleting the row is the only lever.
- **Reclaim by deletion.** "I've got this one" deletes that single row; the teacher is the default
  teacher again with zero split logic. Timestamp-granular coverage means an un-covered slot inside a
  covered week is just a slot with no row.
- **Tight blast radius.** A substitute sees *only* the students they cover, never the wider roster.
  Their circle (if any) and the covered students stay separate surfaces.
- **The record names the actor.** Attendance and grades a substitute makes are stamped with their
  user id so history reads "graded by Sh. Yusuf (sub)", never silently attributed to the away teacher.

## Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | New table `substitution(membership_id, scheduled_at, substitute_user_id, created_by, created_at)`, `unique(membership_id, scheduled_at)` | One sub per session instant. Keyed on instant like `moved_from`, so it binds virtual slots with no materialization. Unique → "change sub" is an upsert, "reclaim" is a delete |
| D2 | Coverage is **active** while `now() <= scheduled_at + GRACE` (GRACE = 12h, matching `sectionSessions` in `recurrence.ts:147`) | Sub can prepare before and finish marking just after; then access self-expires. No lower bound — access starts at assignment |
| D3 | Substitute must be an **existing account**; resolve email → user via the existing `user_id_by_email` RPC (`20260625000004_user_id_by_email.sql`), error if none | No pending/invite/activation state to build. A sub needs RLS access, which needs a real `auth.uid()` |
| D4 | Sub powers: **mark attendance**, **log/grade progress**, **read** the covered student's sessions, progress history, and default-set mushaf (annotations + notes). **No** write to annotations/notes; **no** access to the rest of the circle | Matches the grill. Progress is logged via `progress_log`, not by drawing, so annotation access stays read-only. Roster stays hidden |
| D5 | RLS gate is a security-definer `covers_membership(_membership)` (any active row for `auth.uid()`) for reads + grade, and `covers_session(_membership, _at)` (a row at that exact instant) for the attendance write | Read/grade is per-student while covering; attendance write is scoped to the exact covered instant. Mirrors the `teaches_active_membership` / `teacher_reads_default_set` split already in the codebase |
| D6 | Sub's `session` write is **column-frozen to `attendance_status`** by a guard trigger (extends the progress_log precedent, `progress_log.sql:99-133`) | A sub must not cancel, reschedule, or move a session — only mark it. Same freeze technique already trusted for teacher grade fields |
| D7 | Add `session.marked_by uuid` and `progress_log.graded_by uuid`; a trigger stamps `= auth.uid()` when a **non-owner** writes attendance / grade fields, and it is not client-settable | Attribution the grill asked for, spoof-proof by the same trigger that already runs on these tables. Null for student self-writes |
| D8 | `substitution` RLS: circle teacher (`teaches_active_membership`) manages rows; substitute reads own rows; student reads rows for their own membership | Teacher assigns/edits; sub needs to see the assignment for the Covering section; student needs it to render "covered by X" |
| D9 | Bulk assign is **agenda selection** (Direction C): the existing aggregate agenda in `TeacherCircle.tsx:305-354` gains multi-select + a floating "assign sub" bar that writes one row per selected instant | Reuses the agenda that already lists every active student's upcoming sessions. No modal, no calendar, no separate date pickers — the sessions *are* the selection |
| D10 | Per-session **assign / change / reclaim** lives on each agenda card and on the student page's session list | The single-session path is the same write; "I've got this one" deletes the row |
| D11 | Substitute's home base is a **Covering section** on `/tracker`, fed by a security-definer `covering_sessions()` RPC (returns student name, circle, instant, away-teacher name) | A sub may have no circle of their own; they can't read arbitrary membership/profile rows, so a definer RPC returns exactly the identity needed to list and link. Rows drop off once past GRACE |
| D12 | Notify **substitute + each affected student** by email on assign and on unassign, reusing the `notify` infra (`src/lib/email/notify.ts`, PRD 0010) | The grill's answer. Sub must know they're on; students/parents get the same reassurance the existing session-change emails give |
| D13 | Student's covered session card shows "**Covered by \<sub\>**"; the sub is surfaced on the teacher agenda card too | Read from the student's own substitution row (D8). No new access |
| D14 | **No sub-of-a-sub, no self-assign, no covering a non-active membership** | A substitution requires an active `teaches_active_membership` on the assigning side; `substitute_user_id <> circle.teacher_id` and `<> student` enforced |

## Flow resolution

**Assign (bulk).** Teacher opens the circle agenda, multi-selects session cards (checkbox / shift-click
a run), the floating bar takes a substitute email → `user_id_by_email` → confirm, then one
`substitution` row is upserted per selected instant. Sub + each distinct student emailed once.

**Assign / change / reclaim (single).** On an agenda card or the student session list: "Assign sub"
opens the same email→user picker for that one instant; "Change sub" upserts; "I've got this one"
deletes the row (and emails the un-assignment).

**Substitute teaches.** Sub opens `/tracker` → Covering section → a covered student. RLS
(`covers_membership`) lets them read that student's sessions, progress history, and default-set
mushaf. Marking attendance materializes the slot if needed and writes `attendance_status` +
`marked_by` (guard-frozen to those). Logging a grade writes the teacher fields + `graded_by`.

**Expiry.** No action. Once every one of a sub's rows for a membership is past `scheduled_at + GRACE`,
`covers_membership` returns false and the student vanishes from Covering and from all sub access.

## Scope

- **Migration** `0013_substitution.sql`:
  - `substitution` table + `unique(membership_id, scheduled_at)` + indexes on `substitute_user_id`
    and `membership_id`; RLS (D8); insert guard enforcing D14 (active teacher, no self/student sub).
  - `covers_membership(uuid)`, `covers_session(uuid, timestamptz)` security-definer helpers (D5).
  - Extend `session` RLS: sub `insert` + `update` under `covers_session`; column-freeze guard (D6).
  - Extend `progress_log` RLS: sub read + grade under `covers_membership`; extend the existing
    teacher-update guard to allow the sub (grade fields only) and stamp `graded_by` (D7).
  - Extend `annotation_sets` / `annotations` / `notes` **read** policies with a
    `covers_default_set(_set)` helper (sub reads the covered student's default set) (D4).
  - Add `session.marked_by`, `progress_log.graded_by`; stamping trigger (D7).
  - `covering_sessions()` RPC (D11).
- **Services** (`src/lib/services/substitution.ts`): `assignSubstitutes(rows)`,
  `removeSubstitution(membershipId, scheduledAt)`, `resolveSubEmail(email)`, `getCovering()`.
  Attendance/grade services stamp the actor.
- **Email** `notify.ts`: `notifySubstitution(assignments, removed)` — one digest to the sub, one per student.
- **UI**:
  - `TeacherCircle` agenda: selection state, floating assign bar, per-card sub badge + assign/reclaim.
  - Student session list (`TeacherStudent` / `StudentCircle`): per-session assign/reclaim + "covered by".
  - `/tracker` Covering section (new) fed by `getCovering()`.
  - Attribution line on attendance + graded logs ("by \<name\> · sub").
- **i18n**: keys for assign/change/reclaim/covering/covered-by/sub-badge, en + ar.

## Non-goals

- Substitute by name-only label (rejected in grill: sub is a real account).
- Pending/invite for a sub without an account (D3).
- Range/interval storage or overlap resolution (D1 makes it moot).
- A substitute writing/erasing annotations, or seeing any student they don't cover.
- A calendar/week-grid view — selection rides the existing linear agenda (D9).
- Sub-of-a-sub, multi-teacher circles, or a reusable saved sub roster.

## Security notes

This milestone **widens access**: a new principal (the substitute) gains read of a student's default
set + progress + sessions, and write of attendance + grade fields. Every gate must be a
security-definer helper keyed on a **non-expired** `substitution` row for `auth.uid()`; a past-GRACE
row must grant nothing. `substitute_user_id`, `created_by`, `marked_by`, `graded_by` must all be
server-stamped (`auth.uid()` / row author) and never client-settable. The column-freeze guards (D6/D7)
must hold: a sub may write only `attendance_status` on `session` and only grade fields on
`progress_log`. A sub must not read or write any membership they do not currently cover, and must not
appear on, or read, the circle roster.

## References

- Instant-keyed precedent: `20260712000001_session_moved_from.sql`, `src/lib/recurrence.ts:139-152`
- RLS split to mirror: `20260701000004_circle_rls.sql` (`teaches_active_membership`, `teacher_reads_default_set`)
- Column-freeze precedent: `20260625000002_create_progress_log.sql:99-133`
- Agenda to extend: `src/components/tracker/TeacherCircle.tsx:305-354`
- Email infra: `src/lib/email/notify.ts` (PRD 0010)
- Contract: `0013-substitute-teacher-contract.md`
