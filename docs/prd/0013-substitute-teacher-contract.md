# Acceptance contract — 0013 Substitute teacher

> **This file is the acceptance criteria. It was written before the code.**
> **Do not edit this contract to make a test pass.** If an item is wrong or impossible, stop and
> raise it with the author — changing the contract to match the implementation defeats its purpose.
> A validator reports PASS / FAIL / BLOCKED per ID. Items marked **[SEC]** block the milestone on FAIL.

## A — Data model

- **A1** A substitution references exactly one membership and one session instant via
  `substitution(membership_id, scheduled_at)`, with a substitute user and a creator.
- **A2** `unique(membership_id, scheduled_at)` holds: a second assign to the same instant replaces
  (upserts), never duplicates.
- **A3** A substitution row binds a **virtual** session instant with no pre-existing `session` row —
  assigning a sub does not materialize the session.
- **A4** `substitution.substitute_user_id` and `substitution.created_by` are server-stamped and not
  settable by the client. **[SEC]**
- **A5** Deleting a substitution row is the only way to remove coverage; there is no "revoke" flag on
  the row.
- **A6** Assigning a substitute to a non-active membership is rejected. **[SEC]**
- **A7** A teacher cannot assign themselves as the substitute for their own student, and a student
  cannot be their own substitute. **[SEC]**

## B — Coverage window & expiry

- **B1** A substitution is *active* from the moment it is created until `scheduled_at + 12h`; before
  creation and after that cutoff it grants nothing. **[SEC]**
- **B2** `covers_membership(_membership)` returns true for `auth.uid()` iff at least one active (B1)
  substitution row for that membership names them; false otherwise. **[SEC]**
- **B3** `covers_session(_membership, _at)` returns true for `auth.uid()` iff an active row exists at
  exactly that membership + instant. **[SEC]**
- **B4** Once every one of a substitute's rows for a membership is past the B1 cutoff, all sub access
  to that membership is gone with no manual action. **[SEC]**

## C — Substitute powers (allowed)

- **C1** While covering, a substitute can read the covered student's `session` rows.
- **C2** While covering, a substitute can set `attendance_status` on a covered session, materializing
  the slot if needed.
- **C3** While covering, a substitute can read the covered student's `progress_log` history.
- **C4** While covering, a substitute can write the grade fields of the covered student's
  `progress_log` rows.
- **C5** While covering, a substitute can read the covered student's default annotation set —
  `annotation_sets`, `annotations`, and `notes`.

## D — Substitute limits (denied) **[SEC]**

- **D1** A substitute cannot cancel, reschedule, move, or delete a session; a write to any `session`
  column other than `attendance_status` (and its `marked_by` stamp) is rejected. **[SEC]**
- **D2** A substitute cannot write the student-owned columns of a `progress_log` (only grade fields),
  identical to the teacher freeze. **[SEC]**
- **D3** A substitute cannot insert, update, or delete `annotations` or `notes` on the covered set —
  read only. **[SEC]**
- **D4** A substitute has no read or write access to any membership they do not currently cover:
  its sessions, progress, set, or membership row. **[SEC]**
- **D5** A substitute cannot read the circle roster or appear in `circle_roster`. **[SEC]**
- **D6** A past-GRACE (expired) substitute has exactly the access of a stranger — none. **[SEC]**

## E — Attribution

- **E1** Setting attendance stamps `session.marked_by` with the acting user; a student self-write
  leaves it null.
- **E2** Writing grade fields stamps `progress_log.graded_by` with the acting user.
- **E3** `marked_by` and `graded_by` are server-stamped (`auth.uid()`), not client-settable. **[SEC]**
- **E4** The UI shows the actor on a substitute-made attendance mark and graded log ("by \<name\> · sub").
- **E5** A mark made by the real teacher is attributed to the teacher, not blank and not "sub".

## F — Assign / change / reclaim UI

- **F1** The teacher circle agenda supports selecting multiple upcoming sessions and assigning one
  substitute to all selected instants in a single action.
- **F2** Assigning by email resolves to an existing account; an email with no account surfaces a
  clear error and writes nothing.
- **F3** A single agenda card (and the student session list) can assign, change, or reclaim a sub
  for that one session.
- **F4** "I've got this one" deletes exactly that substitution row and no other.
- **F5** After assignment, the agenda card and the student's session card display the substitute's name.

## G — Substitute's Covering view

- **G1** `/tracker` shows a Covering section listing the students/sessions the current user covers,
  separate from their own circle.
- **G2** Each Covering row shows the student, the session instant, and the away teacher, and links to
  that student's (scoped) page.
- **G3** `covering_sessions()` returns only rows where the caller is the substitute and the row is
  active (B1); expired coverage does not appear.
- **G4** A user covering nobody sees no Covering section (or an empty state), and the section never
  leaks a student they do not cover. **[SEC]**

## H — Notifications

- **H1** On assign, the substitute is emailed which student(s) and session(s) they will cover.
- **H2** On assign, each affected student is emailed that a named substitute will run their session.
- **H3** On reclaim/unassign, the substitute and the affected student are notified.
- **H4** A failed email never rolls back or blocks the assignment (best-effort, matching
  `notifySessionChange`).

## I — Documented limits

- **I1** No pending/invite state for a sub without an account; assignment requires an existing user (PRD D3).
- **I2** No range/interval storage; coverage is per-session rows only (PRD D1).
- **I3** No purge of expired substitution rows; expiry is by query, not deletion. Deliberate — mark
  with a `ponytail:` comment if a cleanup path is ever added.
- **I4** A substitute cannot draw/erase annotations; progress is recorded via `progress_log` only.

## Validator output format

```
ID    VERDICT   EVIDENCE
A1    PASS      <file:line or test name proving it>
B1    FAIL      <what was observed instead>
D5    BLOCKED   <why it could not be checked>
```

Report every ID. Any **[SEC]** item at FAIL blocks the milestone regardless of the rest.
Any non-SEC FAIL is reported and triaged, not silently accepted.
