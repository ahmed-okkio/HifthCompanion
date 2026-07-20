# Ticket M3 — Notify helpers + wire the three events

> Orchestrator handoff: `/implement docs/prd/0010-circle-email-notifications-build.md` (milestone M3).
> PRD: `0010-circle-email-notifications.md` · Contract: `0010-circle-email-notifications-contract.md`

## What to build

Connect the three mutations to the send layer. `notifyInvite` / `notifyHomework` /
`notifySessionChange` each resolve the recipient's email **server-side via the service-role admin
client** (`getUserById`, reuse the `createSupabaseAdmin` pattern from `push/send.ts`), read that
user's `email_prefs`, gate via `prefEnabled`, then call `sendEmail`. Wire the calls into
`inviteByEmail`, `prescribeHomework`, and both `rescheduleSession` + `setSessionCanceled` — on the
**success** path only, each wrapped in try/catch so a send failure is logged, never re-thrown, and
never alters the mutation's own result. The recipient email is never returned to the triggering
teacher.

## Test plan (contract IDs — pass/fail)

- **S1** *(blocking)* Best-effort, never blocks: if the send throws (or no-ops), the mutation still
  succeeds and returns its normal result (`inviteByEmail` still creates the pending membership,
  `prescribeHomework` still returns rows, session mutations still persist).
- **S2** *(blocking)* Each event fires its own notify on success: `inviteByEmail`→`notifyInvite`
  (invited user), `prescribeHomework`→`notifyHomework` (homework's student),
  `rescheduleSession`+`setSessionCanceled`→`notifySessionChange` (session's student). No email on the
  failure/throw path.
- **S3** *(blocking)* Recipient email resolved server-side via service-role admin `getUserById` —
  never client-supplied, never returned to the triggering teacher.
- **S4** Pref gate honored: recipient key `invite`/`homework`/`session_change` = `false` ⇒ `sendEmail`
  not called; absent key ⇒ sent.
- **S5** A future `reminder` path could call `sendEmail` directly, gated by the `reminder` key under
  the same rule — asserted via the pref helper covering an unknown/`reminder` key (no reminder
  trigger built).

## Acceptance criteria

- [ ] All three mutations fire the matching notify on success, none on failure
- [ ] Forced send failure leaves every mutation's return value/behavior unchanged (logged only)
- [ ] Recipient email comes from service-role `getUserById`; never leaks to the teacher/client
- [ ] `email_prefs` key `false` suppresses that event's send; absent key sends
- [ ] Pref helper proven reminder-ready (unknown key defaults on)
- [ ] Tests with Resend fetch mocked; no live sends

## Blocked by

- M1 (send layer + `prefEnabled`)
- M2 (`email_prefs` column read in the gate)
