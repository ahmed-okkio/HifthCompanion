# PRD 0014 — Session agenda (grill-with-docs output)

> A teacher keeps a private, tickable list of things to cover with one student, plus a prep screen
> that puts that list — and everything already waiting on them — in front of them when the session
> starts. The acceptance contract (`0014-session-agenda-contract.md`) is the source of truth for
> "done".

## Problem / Goal

- A teacher finishes a session thinking "next week I must drill the transition at 2:45 → 2:46". Today
  the only places to put that are the shared notes thread (`membership_note`, which the student
  reads, and which is a chronological conversation, not a to-do) or a homework prescription (which
  is a *student* obligation, not a teacher reminder).
- Neither surfaces at the moment it matters. The teacher opens
  `/tracker/[circleId]/student/[membershipId]` at session time and lands on the Sessions tab
  (`TeacherStudent.tsx:80`), which shows schedule + slot list — not "here is what you decided to do
  today".
- Everything that *is* actionable at session time (homework due, ungraded submissions, last
  attendance, an imminent exam) is already loaded on that page but scattered across four tabs.

Goal: a teacher-private carry-forward list bound to the student, plus one Agenda tab that opens by
default and reads as a pre-session brief.

## Principles

- **Private by default.** Agenda items are the teacher's own prep notes and can be blunt. The student
  never sees them; neither does a covering substitute. Showing them later is one RLS `or`; unshowing
  them is impossible.
- **Open until ticked, not scheduled.** An item is not attached to a session instant. Sessions here
  are largely virtual (`sectionSessions`, `src/lib/recurrence.ts:126`) and get moved and canceled
  (`moved_from`, `20260712000001`); anything bound to a specific instant would orphan or vanish. "For
  next time" means "until I tick it off", which is also what a teacher actually means.
- **Archiving is a query limit, not a lifecycle.** No archive column, no retention job, no soft
  delete. The Done list simply stops loading rows older than 30 days.
- **The brief derives, it does not duplicate.** The "waiting on you" block is computed from data
  already in the page payload — homework, logs, sessions, exams. No new persisted state, no
  denormalized counters.
- **One new region, not five.** The agenda gets its own tab and the existing Next-session card moves
  into it, rather than sprinkling badges and panels across the page.

## Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | New table `agenda_item(id, membership_id, author_id, body, done_at, created_at, updated_at)` | Not flags on `membership_note`: that table is a *shared, append-only* thread (RLS has select+insert only, `20260701000004_circle_rls.sql:174-192`). Ticking needs UPDATE, and the student must not read agenda items. A separate table settles both at once |
| D2 | No session FK, no target date. Items are open until `done_at` is set | Survives reschedule/cancel/move for free; no materialization of virtual slots just to attach a note |
| D3 | RLS: the circle's own teacher only — `teaches_active_membership(membership_id)` for select/insert/update/delete. Substitutes (`covers_membership`) are **not** granted | Q9: private wins for v1; the sub grant is one `or` away later |
| D4 | `body` is editable after creation; `author_id` server-stamped `default auth.uid()` | The UPDATE policy must exist for `done_at` regardless, so freezing `body` is *more* work, not less |
| D5 | New **Agenda** tab, first in the tab bar and the default (`useState('agenda')`) | Landing tab must not depend on the clock — a page that moves under you is worse than one extra click |
| D6 | The Next-session card (attendance, reschedule, cancel, assign-substitute) moves out of the Sessions tab into the Agenda tab. Sessions keeps the schedule editor, Upcoming and History | The brief needs the session controls next to the items; the list-management UI does not |
| D7 | "Live" state = `now` within `[scheduled_at − 60min, scheduled_at + 60min]` | Matches the teacher's stated "an hour before". Purely presentational — it never changes which tab opens or what loads |
| D8 | Tick → strikethrough, then on reload the row moves into a collapsed `Done (n)` disclosure loading only `done_at >= now - 30d` | No timers, no linger state machine, full history preserved in the DB |
| D9 | `×` on an item sets `done_at` too — dismissal and completion are the same state | Nobody audits an agenda; a third state buys nothing |
| D10 | Open items never auto-expire; their age renders in muted text and turns amber past 14 days | The nagging *is* the feature |
| D11 | "Waiting on you" block: homework due on/before today and unsubmitted; ungraded submissions (`reviewed_at === null`); the last session's attendance **only while unmarked** (amended 2026-07-24 — a settled status, notably `excused`, is not waiting on anyone); a scheduled exam within 14 days. Block hides entirely when all four are empty | All four are actionable at session time and all four are already in the page payload. Weakest-surahs (`weakestSurahs`, `StudentAnalytics.tsx:29`) is deliberately excluded — a slow-moving stat that already has a home |
| D12 | Circle roster rows get a live dot + time for students inside the D7 window; the circle page gains one `getSessionsForMemberships` call | One query for all memberships, `sectionSessions` per student in memory — the same shape as `getManageSlots` (`src/lib/services/substitution.ts:62`), not an N+1 |
| D13 | Adding = a `＋ Add an item` control that reveals a single free-text input. No type, no deadline, no visibility flag | Everything structured already has a home (homework, exams, sessions) |
| D14 | The Notes tab keeps its name and behavior | Considered renaming it to Messages to separate "talking to the student" from "my own prep"; rejected by the author |
| D15 | New TS type is named `AgendaTask` | `AgendaItem` is taken (`TeacherCircle.tsx:21`) and means *a session slot* |

## Scope

**In:** the table + RLS, the service layer, the Agenda tab (items + moved Next card + waiting-on-you
+ empty states), the roster live dot, en + ar strings.

**Out (deliberately):** student-visible agenda, substitute access, per-item due dates or types, email
or push reminders, a cross-student agenda dashboard, edit history, drag-reordering, attachments.

## Empty states

1. No open items, session upcoming → Next card + waiting-on-you render normally; the agenda shows a
   single prompt line and the Add control.
2. No schedule at all (`membership.schedule === null`, no ad-hoc rows) → no Next card; in its place a
   link to the Sessions tab to set one. The agenda list still renders — items are useful without a
   session.
3. Nothing anywhere (new student) → the three blocks collapse into one empty state pointing at the
   schedule.

The Agenda tab is never hidden.

## Known limitations (expected to remain)

- A covering substitute sees the Next card and the waiting-on-you block but no agenda items.
- Done items older than 30 days are unreachable from the UI (they remain in the database).
- The live window and the 14-day exam horizon are constants, not settings.
