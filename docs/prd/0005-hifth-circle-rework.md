# PRD 0005 — Hifth Circle rework (1:1 lessons, homework, notes, consent)

> Status: planned (grilled 2026-07-01). Acceptance contract: `0005-hifth-circle-rework-contract.md`.
> Reworks the tracker module (`/tracker`) from a group-halaqah model into a teacher's roster of
> **1:1 students** with per-student scheduling, prescribed/open homework, a per-student notes thread,
> a consent (invite→accept) gate, and auto teacher access to each student's **default** mushaf.
> Touches: `halaqah`/`membership`/`session`/`attendance`/`progress_log` schema + RLS, the tracker
> services (`halaqah.ts`, `membership.ts`, `sessions.ts`, `attendance.ts`, `progressLog.ts`),
> tracker components, `/tracker` routes, `analytics.ts`/`recurrence.ts`, i18n dictionaries.

## Problem / Goal

The tracker shipped as a **group** memorization circle (halaqah): one weekly schedule for the whole
circle, group sessions with per-student attendance, teacher-configurable log types using specific
(Hanafi) terminology (Sabaq/Sabqi/Manzil). In practice hifth is taught **1:1** — the "circle" is just
how a teacher organizes his students, and each student has his own repeating lesson slot.

**Goal:** rename the feature to **Hifth Circle** and restructure it around per-student 1:1 lessons —
each student has his own recurring session; the teacher sees every student's schedule on his
dashboard while each student sees only his own slot. Replace the ad-hoc terminology with three plain
homework types, add a homework prescription flow (with deadlines) alongside open student
self-submission, add a per-student teacher↔student notes thread, and gate membership behind an
explicit student **accept** that also consents to the teacher reading the student's default mushaf.

## Principles

- **1:1 is the model, circle is the container.** The circle groups a teacher's students; it no longer
  owns a schedule or group sessions. Scheduling, sessions, homework, and notes are all per-student.
- **Consent before access.** No teacher reads any student data (progress, default mushaf, notes) until
  the student is an **active** member. Every join path passes through an explicit accept.
- **Reuse the existing progress/analytics spine.** Open self-submission is the existing `progress_log`.
  Homework prescriptions are additive; analytics keeps computing from `progress_log` roles.
- **Clean rename.** `halaqah` → `circle` end to end (tables, columns, FKs, RLS functions, services,
  routes, components, i18n). Dev/test data only — clean-slate structural migrations are acceptable.

## Decisions (locked during grilling)

| # | Area | Decision |
|---|------|----------|
| D1 | Name | User-facing **"Hifth Circle"**; rail/section label **Circles**; Arabic **حلقة التحفيظ**. |
| D2 | Rename depth | **Full rename** `halaqah`→`circle`: tables, columns (`halaqah_id`→`circle_id`), FKs, RLS definer fns (`is_halaqah_teacher`→`is_circle_teacher`, etc.), service files, `/tracker/[halaqahId]`→`/tracker/[circleId]` routes, `TeacherHalaqah`→`TeacherCircle` components, i18n keys. |
| D3 | Sessions | **Per-student.** `session.circle_id` → `session.membership_id`. Attendance collapses onto the session row as `session.attendance_status` (`present\|absent\|late\|excused\|null`). **`attendance` table dropped.** |
| D4 | Schedule | Weekly recurrence moves off the circle to **`membership.schedule`** (jsonb `{weekdays:[0-6],time:"HH:MM"}`, nullable). Circle no longer has a `schedule` column. Sessions generate per membership. |
| D5 | Dashboard | Teacher dashboard shows **all students' upcoming 1:1 sessions** (aggregate agenda). Each student sees **only his own** slot/sessions. Teacher sets each student's recurring slot from that student's row. |
| D6 | Homework model | New **`homework`** table (the prescription). `progress_log` gains nullable **`homework_id`** FK. A student's open self-submission = a `progress_log` row with `homework_id = null`. One prescription can gather **many** linked progress logs. |
| D7 | Homework types | **Fixed enum** `memorization \| general_revision \| targeted_revision` on both `homework.type` and `progress_log.log_type`. **`circle.log_types` config column dropped.** Old `Sabaq/Sabqi/Manzil` terminology removed. Arabic: memorization **حفظ**, general_revision **مراجعة عامة**, targeted_revision **مراجعة موجهة**. |
| D8 | Type → role map | Hardcoded (replaces the per-circle label map): `memorization`→`memorize` (paints coverage map); `general_revision` + `targeted_revision`→`revise` (recency layer). No `read` role remains. |
| D9 | Prescription targeting | **Single student** — `homework.membership_id` single FK. No bulk assign in v1 (open submission covers the everyday case). |
| D10 | Deadline | `homework.deadline` = a **date** (local end-of-day). **Hard lock:** after the deadline no new `progress_log` may link to it; status resolves `missed` (0 linked logs) or `completed` (≥1). Teacher may **edit the deadline** to reopen. Open (`homework_id`-null) submissions are never locked. |
| D11 | Notes | New **`membership_note`** table (`membership_id, author_id, body, created_at`). **Per-student shared attributed thread:** teacher of the circle and the owning student both post and both read the full thread; each note shows its author. (Named `membership_note`, not `notes`, to avoid clashing with reader page-annotation `notes`.) |
| D12 | Consent gate | `membership.status` gains **`pending`**. Every join path (email invite, link/code) creates a `pending` membership and lands the invited user on an **accept screen**. Accept → `active`. Teacher reads nothing until `active`. |
| D13 | Mushaf share | **Drop `membership.shared_set_id`.** Teacher of an **active** membership reads the student's **current default** annotation set (`annotation_sets WHERE user_id = membership.user_id AND is_default`) — dynamic, follows the student's default. A **Mushaf button** on each roster row opens the reader on that set (`?set=`). No default set → button disabled. |
| D14 | Statuses | `student_statuses` / `teacher_statuses` config columns **unchanged** (still per-circle, still drive weakest-surah polarity). |
| D15 | Data | **Clean slate** (dev/test only): drop & recreate `session`, drop `attendance`, drop `shared_set_id` and `log_types` columns, drop `circle.schedule`. Map any existing `progress_log.log_type` (`Sabaq`→`memorization`, `Sabqi`/`Manzil`→`general_revision`); logs otherwise preserved. |

## Data model (after)

```
circle            id, teacher_id, name, invite_code, student_statuses[], teacher_statuses[], created_at
                  -- removed: schedule, log_types
membership        id, circle_id, user_id, role(teacher|student),
                  status(pending|active|inactive|blocked), schedule(jsonb|null), joined_at
                  -- removed: shared_set_id ; added: status 'pending', schedule
session           id, membership_id, scheduled_at, is_adhoc, canceled,
                  attendance_status(present|absent|late|excused|null), created_at
                  -- changed: circle_id → membership_id ; added attendance_status
homework  (new)   id, membership_id, prescribed_by(user_id), type(enum), deadline(date),
                  page_start, page_end, surah?, ayah_start?, ayah_end?, instructions?, created_at
progress_log      + homework_id (nullable FK → homework) ; log_type now enum
membership_note (new)  id, membership_id, author_id, body, created_at
-- attendance table: DROPPED
```

`homework` status (`open|completed|missed`) is **derived**, not stored: `missed`/`completed` computed
from `deadline < today` and the count of linked `progress_log` rows. (No status column to keep in sync.)

## RLS — security-critical

Definer helpers renamed `*_halaqah_*` → `*_circle_*`. New/changed policies:

- **Pending excluded everywhere.** Every teacher read (`progress_log`, default-set annotations/notes,
  `membership_note`, `session`) requires the membership `status = 'active'`. A `pending` (or
  `inactive`/`blocked`) membership grants the teacher **nothing**.
- **Accept is self-only.** Only the invited `user_id` may transition their own membership
  `pending → active` (BEFORE-UPDATE trigger or WITH CHECK; teacher cannot self-accept for the student).
- **Default-set read** (replaces `teacher_can_read_set`): a circle's teacher may read
  `annotation_sets`/`annotations`/`notes` WHERE the set is the **default** set (`is_default`) of a
  user who has an **active** student membership in that teacher's circle. Write access mirrors the
  existing teacher-shared-set write policy but keyed on the default set.
- **`homework`:** the circle's teacher (via the membership) may insert/update/delete; the owning
  student may read his own. Deadline hard-lock (no new linked `progress_log` after `deadline`) enforced
  in the service + a check that rejects linking a log to a past-deadline homework.
- **`membership_note`:** the circle's teacher **and** the owning student may insert (author_id = self)
  and read all rows for that membership; no one else. Active membership required for the teacher.
- **`session`:** teacher of the membership's circle manages; the owning student reads his own.

## Scope / work breakdown

1. **Rename migration** — rename `halaqah`→`circle` table + `halaqah_id`→`circle_id` columns + FKs +
   all RLS definer fns/policies. Drop `circle.schedule`, `circle.log_types`, `membership.shared_set_id`.
   Add `membership.schedule`, `membership.status` value `pending`.
2. **Session restructure migration** — `session.circle_id`→`membership_id`, add `attendance_status`,
   drop `attendance` table. Clean-slate recreate acceptable.
3. **Homework + notes migration** — create `homework`, `membership_note`; add `progress_log.homework_id`;
   convert `progress_log.log_type` to the 3-type enum (map old values).
4. **RLS migration** — pending-excluded reads, self-only accept, default-set read/write, homework +
   membership_note policies. **Security review required.**
5. **Services** — rename `halaqah.ts`→`circle.ts` (+ callers). `membership.ts`: add `acceptMembership`,
   pending on invite/join, drop `setSharedSet`, add default-set resolver. `sessions.ts`: schedule on
   membership, generate per membership, `setSessionAttendance` on session row (replaces `attendance.ts`,
   which is deleted). New `homework.ts` (prescribe/extend/list, deadline lock) + `membershipNotes.ts`.
6. **Recurrence/analytics** — `recurrence.ts` generates per membership. `analytics.ts`: replace the
   per-circle role/polarity **label map** with the hardcoded enum→role map (D8); statuses polarity map
   unchanged (D14).
7. **Consent UI** — accept screen for a pending membership (shows teacher name + "they will see your
   default mushaf"); invite/link paths land here; teacher roster shows pending vs active.
8. **Teacher dashboard** — aggregate agenda of all students' upcoming sessions; per-student row with
   set-schedule control, **Mushaf button**, prescribe-homework action, notes thread, attendance marking.
9. **Student view** — own slot/sessions (read-only), assigned homework list (with deadline + lock
   state), open self-submission (existing log form, now with 3 fixed types), own notes thread.
10. **Rename UI + i18n** — "Hifth Circle"/Circles everywhere; drop Sabaq/Sabqi/Manzil strings; add the
    3 homework-type + notes + accept keys (EN/AR). Update glossary + ADR references.
11. **Mock + tests** — extend `mock.ts` for renamed tables + `homework`/`membership_note`/session shape;
    update e2e/unit fixtures off the old `log_types`/`attendance`/`shared_set_id`.

## Non-goals (explicitly out)

- Bulk / assign-to-many homework prescriptions (single-student only in v1).
- Teacher-configurable homework types or a return of custom log types.
- Group sessions / shared circle schedule (removed, not preserved).
- Student choosing which set to share (always the default; no picker).
- Backfill/reversible data migration (dev/test — clean slate).
- Notes threading, attachments, edits/deletes on notes beyond simple append (v1 = post + read).
- Notifications for new homework/notes (reuse existing in-app badge patterns only, no new channels).

## References

- Acceptance / validation contract: `docs/prd/0005-hifth-circle-rework-contract.md`
- Prior tracker PRD (superseded model): `docs/prd-progression-tracker.md`
- Chrome/section naming: `docs/adr/0002-unified-app-chrome.md`, `docs/glossary.md` (update "Halaqah").
- Live-DB deploy path + RLS gotchas: memory `progression-tracker.md` (no local Docker; `db push`;
  `gen_random_uuid` only; RLS recursion via security-definer helpers; WITH CHECK can't see OLD →
  column-freeze via BEFORE-UPDATE triggers).
</content>
</invoke>
