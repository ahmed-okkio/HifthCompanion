# Ticket M1 — Send layer + bilingual templates

> Orchestrator handoff: `/implement docs/prd/0010-circle-email-notifications-build.md` (milestone M1).
> PRD: `0010-circle-email-notifications.md` · Contract: `0010-circle-email-notifications-contract.md`

## What to build

The provider-thin email send function plus pure body/pref helpers — the foundation the three event
notifications (and a future reminder cron) all call. Resend is reached by a single authenticated
`fetch` POST; no SDK, no new dependency. When `RESEND_API_KEY` is unset the whole thing is a logged
no-op (never throws), mirroring the VAPID no-op guard in `src/lib/push/send.ts`. Body builders are
pure: event facts in, bilingual **EN-then-AR** HTML out (Arabic block `dir="rtl"`). `prefEnabled` is
default-on: an absent key means send, only an explicit `false` disables.

## Test plan (contract IDs — pass/fail)

- **L1** `sendEmail(to, subject, html)` issues one authenticated POST to
  `https://api.resend.com/emails` with `from = RESEND_FROM`, `to`, `subject`, `html`, and
  `Authorization: Bearer ${RESEND_API_KEY}`. No other network call, no SDK import.
- **L2** *(no-op guard)* With `RESEND_API_KEY` unset, `sendEmail` skips the network, returns a
  skipped result, logs a single `console.warn`, and does **not** throw.
- **L3** Every body is bilingual — English block then Arabic block, same event facts (name,
  page/surah range, deadline, or old→new session time as applicable); Arabic block marked
  `dir="rtl"`.
- **L4** `prefEnabled(prefs, key)` returns `true` for an absent key, `false` only for explicit
  `false`. `{}` ⇒ all events enabled.

## Acceptance criteria

- [ ] `sendEmail` posts exactly once to the Resend endpoint with the correct headers/payload (fetch mocked)
- [ ] No `RESEND_API_KEY` ⇒ no network call, one warn, no throw
- [ ] Body builders emit EN + RTL-AR blocks with matching facts
- [ ] `prefEnabled` is default-on (absent ⇒ true; only `false` disables)
- [ ] Unit tests cover L1–L4; no live sends

## Blocked by

None — can start immediately.
