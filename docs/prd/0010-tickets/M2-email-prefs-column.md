# Ticket M2 — Prefs column + save service + types

> Orchestrator handoff: `/implement docs/prd/0010-circle-email-notifications-build.md` (milestone M2).
> PRD: `0010-circle-email-notifications.md` · Contract: `0010-circle-email-notifications-contract.md`

## What to build

Per-event opt-out storage. Add `profiles.email_prefs jsonb not null default '{}'` and a self-only
save service. Existing rows read as `{}` (all events enabled). No new RLS — the existing self-only
"User updates own profile" policy (`20260626000003_create_profiles.sql`) already governs the column;
verify it covers the new field. `saveEmailPrefs` merges into the caller's own row only, leaving other
profile fields untouched. Extend `mock.ts` for the new column.

## Test plan (contract IDs — pass/fail)

- **P1** `profiles` has `email_prefs jsonb not null default '{}'`; existing rows read as `{}` after
  migration — no backfill breakage.
- **P2** *(blocking)* Self-only write: a user updates **only their own** `email_prefs`; no user can
  write another's. Send path reads prefs via service-role (server-only), not the browser client.
- **P3** `saveEmailPrefs(partial)` merges into `auth.uid()`'s own row, leaving other profile fields
  untouched.

## Acceptance criteria

- [ ] Migration adds `email_prefs jsonb not null default '{}'`; pre-existing rows read `{}`
- [ ] Existing self-only update RLS confirmed to cover `email_prefs`; no new policy added
- [ ] `saveEmailPrefs` writes only the caller's row and only merges the prefs field
- [ ] Cross-user write attempt is rejected by RLS
- [ ] `EmailPrefs` type added; `mock.ts` carries the column

## Blocked by

None — can start immediately (independent of M1).
