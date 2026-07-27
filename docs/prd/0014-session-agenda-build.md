# Build Manifest — 0014 Session agenda

> Single file `/implement` consumes. Links, milestone ladder, contract→work mapping.
> - PRD: `0014-session-agenda.md`
> - Contract: `0014-session-agenda-contract.md`
>
> **Security-critical contract IDs (block milestone on FAIL): A2, B1–B6, C7.**

## Milestone ladder

Ordered; each is one worker slice. Every contract ID is covered by exactly one milestone.

### M1 — Table, RLS, types, mock
- **Goal:** the private `agenda_item` table with teacher-only policies.
- **Files:** new `supabase/migrations/<ts>_agenda_item.sql`; `src/types/index.ts` (`AgendaTask`);
  `src/lib/supabase/mock.ts` (agenda_item table).
- **Constraints:** copy the shape of `membership_note` (`20260701000003_homework_notes_logtype.sql:52`)
  for the table and `20260701000004_circle_rls.sql:174-192` for the policies, but grant
  select/insert/update/delete to `teaches_active_membership(membership_id)` **only** — do **not** add
  `owns_membership` and do **not** add `covers_membership` / `covers_session`
  (`20260723000001_substitution.sql`). `author_id uuid not null references auth.users default
  auth.uid()`, and the insert policy must require `author_id = auth.uid()`. Index on
  `(membership_id, done_at)`. New TS type is `AgendaTask` — `AgendaItem` is taken
  (`TeacherCircle.tsx:21`).
- **Contract IDs:** A1, A2 *(blocking)*, A3, A4, A5, A6, B1–B6 *(all blocking)*.

### M2 — Service layer + live-window logic + tests
- **Goal:** the CRUD service and the pure functions the UI will use.
- **Files:** new `src/lib/services/agenda.ts`; new `src/lib/agenda.ts` (pure helpers); new
  `src/tests/agenda.test.ts`.
- **Constraints:** service file follows `src/lib/services/membershipNotes.ts` exactly — `'use server'`,
  `createClient` for reads, `createClientAction` for writes, throw on error, no client-side
  membership filtering (RLS is the gate). `listAgenda(membershipId)` returns open items oldest-first
  plus done items with `done_at >= now - 30d` newest-first. `addItem` trims and rejects empty before
  touching the DB. `setDone(id, boolean)` / `updateBody(id, text)`. Dismiss reuses `setDone(id, true)`
  — no new function, no new state. Pure helpers in `src/lib/agenda.ts`: `isLive(scheduledAt, now,
  canceled)` (±60 min inclusive, canceled never live) and `isStale(createdAt, now)` (>14 days) — no
  I/O, `now` always passed in, mirroring how `sectionSessions` takes `now`
  (`src/lib/recurrence.ts:126`). Vitest, no new dependency.
- **Contract IDs:** C1, C2, C3, C4, C5, C6, C7 *(blocking)*, D1, D2, D3, D4.

### M3 — Agenda tab + moving the Next-session card
- **Goal:** the new tab, the item list, and the relocated session card.
- **Files:** `src/components/tracker/TeacherStudent.tsx`; new
  `src/components/tracker/AgendaPanel.tsx`; `src/app/tracker/(shell)/[circleId]/student/[membershipId]/page.tsx`
  (load agenda rows server-side and pass them down).
- **Constraints:** add `{ key: 'agenda', label: … }` first in the `TabBar` list
  (`TeacherStudent.tsx:124`) and change the default to `useState('agenda')`. **Move** the Next-session
  card out of `StudentSessions` rather than duplicating it — extract it so both the Agenda tab and
  `StudentSessions` import the same component, and delete its render from the Sessions tab, which
  keeps the schedule editor, the Upcoming/History sub-tabs and the `lingerId` behavior untouched.
  `ensureRow` / `materializeSession` behavior must survive the move. Live styling comes from
  `isLive` (M2), computed client-side; it must not affect which tab is selected. Tick is optimistic
  (update local state, then call the service). Add control is a button that reveals one text input —
  no extra fields. Done items render inside a collapsed disclosure. Reuse the card/badge/`SectionTitle`
  primitives from `src/components/tracker/ui.tsx`; no new design tokens.
- **Contract IDs:** E1–E10, I1, I3.

### M4 — Waiting-on-you block
- **Goal:** the derived pre-session context, no new queries.
- **Files:** `src/components/tracker/AgendaPanel.tsx`; `src/lib/agenda.ts` (derivation helpers);
  `src/tests/agenda.test.ts` (extend).
- **Constraints:** derive **only** from props the page already passes — `initialHomework`, `logs`,
  `initialSessions`, `initialExams`. Homework rows use the existing `homeworkStatus()`
  (`src/lib/homework.ts:16`) plus the linked-log count already computed in `TeacherStudent.tsx:105-109`
  — do not re-implement the status rules. Ungraded = `logs.filter(l => l.reviewed_at === null)`.
  Attendance line = most recent past session's `attendance_status`. Exam row only when
  `scheduled_date` is within 14 days. **Do not** call `weakestSurahs`. The whole block returns null
  when every part is empty. Derivation goes in pure functions with tests; the component only renders.
- **Contract IDs:** F1, F2, F3, F4, F5, F6, F7.

### M5 — Roster live dot, empty states, i18n
- **Goal:** the circle-level surfacing and the final polish pass.
- **Files:** `src/app/tracker/(shell)/[circleId]/page.tsx`; `src/components/tracker/TeacherCircle.tsx`;
  `src/components/tracker/AgendaPanel.tsx`; `src/lib/i18n/dictionaries.ts`.
- **Constraints:** the circle page currently loads roster-only by design
  (`page.tsx:42-43`) — add **one** `getSessionsForMemberships(activeStudentIds)` call
  (`src/lib/services/sessions.ts:22`) and compute each student's next slot with `sectionSessions` in
  memory, the same shape as `getManageSlots` (`src/lib/services/substitution.ts:62`). No per-student
  query. Roster rows show the live indicator only when `isLive` (M2) is true; students without a
  schedule render exactly as they do today. Empty states per PRD §"Empty states" — the Agenda tab is
  never hidden. Every new string added across M3–M5 gets both `en` and `ar` entries in
  `dictionaries.ts`; grep the new components for hardcoded English before reporting done. Leave the
  Notes tab label alone.
- **Contract IDs:** G1, G2, G3, G4, H1, H2, H3, H4, H5, H6, I2, I4.
