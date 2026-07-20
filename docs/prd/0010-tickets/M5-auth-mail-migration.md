# Ticket M5 — Auth-mail migration + ops docs

> Orchestrator handoff: `/implement docs/prd/0010-circle-email-notifications-build.md` (milestone M5).
> PRD: `0010-circle-email-notifications.md` · Contract: `0010-circle-email-notifications-contract.md`

## What to build

Move Supabase auth mail (confirm / reset / magic-link) off the default sender (capped 2/hr,
`config.toml:199`) onto Resend SMTP, and lift the cap. Enable `[auth.email.smtp]` pointed at Resend
SMTP with `pass = env(...)` (no secret committed), `sender_name` + `admin_email` set; raise
`[auth.rate_limit].email_sent` above 2. Document the verified Resend sending domain (DNS),
`RESEND_API_KEY`, `RESEND_FROM`, and SMTP env vars as launch prerequisites. Commit no credential.

## Test plan (contract IDs — pass/fail)

- **C1** *(blocking)* `config.toml` `[auth.email.smtp]` is enabled and points at Resend SMTP with
  env-substituted credentials (no secret committed), and `[auth.rate_limit].email_sent` is raised
  above 2. The docs record the required verified Resend domain + env vars
  (`RESEND_API_KEY`, `RESEND_FROM`, SMTP creds) as launch prerequisites.

## Acceptance criteria

- [ ] `[auth.email.smtp]` enabled, host/user Resend, `pass = env(...)`, sender/admin set
- [ ] `email_sent` raised above 2
- [ ] No credential committed to git
- [ ] Ops note lists verified domain + all required env vars

## Blocked by

None — can start immediately (config-only, independent of M1–M4).
