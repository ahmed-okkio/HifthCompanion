# Ticket M4 — Profile settings UI + i18n

> Orchestrator handoff: `/implement docs/prd/0010-circle-email-notifications-build.md` (milestone M4).
> PRD: `0010-circle-email-notifications.md` · Contract: `0010-circle-email-notifications-contract.md`

## What to build

Three opt-out checkboxes on `/profile` — invite, homework, session-change — prefilled from
`email_prefs` (checked when the key is absent or `true`), persisting via `saveEmailPrefs` on change.
Bilingual labels + helper text via `dictionaries.ts`, no hardcoded English. Reuse the existing
profile-page form styling.

## Test plan (contract IDs — pass/fail)

- **U1** `/profile` shows three labeled checkboxes (invite, homework, session-change) reflecting
  current `email_prefs` (checked = enabled, i.e. key absent or true).
- **U2** Toggling a checkbox persists via `saveEmailPrefs`; reloading reflects the saved state.
- **U3** All three labels + helper text are translated in both en and ar via `dictionaries.ts` — no
  hardcoded English.

## Acceptance criteria

- [ ] Three checkboxes render, prefilled from `email_prefs` (default checked)
- [ ] Toggling persists and survives reload
- [ ] EN + AR strings present; no hardcoded English in the new UI
- [ ] Reuses existing profile form styling; no layout regression

## Blocked by

- M2 (`saveEmailPrefs` + `email_prefs` column)
