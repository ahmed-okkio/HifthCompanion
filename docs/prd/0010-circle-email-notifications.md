# PRD 0010 — Circle email notifications (Resend) + auth-mail migration

> Status: planned (grilled 2026-07-20). Acceptance contract: `0010-circle-email-notifications-contract.md`.
> Adds the app's first outbound transactional email: three event-driven circle emails sent via
> Resend, per-event opt-out, bilingual (EN+AR) bodies. Also migrates Supabase **auth** mail
> (confirm / reset / magic-link) off the capped default sender onto Resend SMTP. Builds the send
> layer so a future **time-based reminder** feature drops in without rework — but no scheduler is
> built now.

## Problem / Goal

Today the app sends **zero** outbound application email. `inviteByEmail` (`membership.ts:190`) only
creates an in-app `pending` membership — the invitee learns of it only if they happen to log in.
Homework prescriptions and session reschedules/cancels notify nobody. Separately, any Supabase auth
mail (email confirmation, password reset, magic link) rides Supabase's **default sender, capped at
2 emails/hour project-wide** (`config.toml:199` `email_sent = 2`) — a hard launch blocker.

Push infra exists (`src/lib/push/send.ts`) but `sendPushToUser` is **never called** — there is no
trigger, no cron, no edge function anywhere in the repo.

**Goal:** ship event-driven circle emails through Resend, give recipients per-event opt-out, send
bilingual bodies (no per-user locale exists), and move auth mail to Resend SMTP with a raised rate
limit — all while structuring the send layer so a later reminder cron reuses it unchanged.

## Principles

- **Best-effort, never blocking.** Email is a side effect. A send failure (or absent API key) must
  **never** fail or roll back the core mutation. Mirror the push pattern: no-op + `console.warn`
  when `RESEND_API_KEY` is missing; wrap every send in try/catch.
- **Reuse the push precedent.** Recipient email + prefs are read server-side with the **service-role
  admin client** exactly as `loadSubscriptions` does — never exposed to the browser.
- **Foundation, not the building.** Build `sendEmail()` + per-event `notify*` helpers. A future
  reminder cron calls the same `sendEmail`. Do **not** build the scheduler or a dedup/`email_log`
  table now (that ships with the reminder task).
- **No new dependencies.** Resend is a single authenticated `POST` via `fetch`. No SDK, no React
  Email, no template build step.
- **Laziest correct invite path.** Invite stays **registered-only**; the email just notifies the
  pending membership `inviteByEmail` already creates. No email-keyed invite table.

## Decisions (locked during grilling)

| # | Area | Decision |
|---|------|----------|
| D1 | Trigger model | **Event-based now**, time-based reminders **later**. Build the send layer so a future cron reuses it; **no scheduler built in this PR.** |
| D2 | Provider | **Resend**, called as a plain authenticated `fetch` POST to `https://api.resend.com/emails`. No SDK / React Email dependency. |
| D3 | Events (v1) | Exactly three, each riding an existing server action: **(E-invite)** teacher invites by email → student; **(E-hw)** homework prescribed → student; **(E-sess)** session rescheduled or canceled → student. **Invite-accepted→teacher is out.** |
| D4 | Invite scope | **Registered-only, unchanged.** `inviteByEmail` still errors on unregistered emails; the new email only notifies the `pending` membership it already creates. |
| D5 | Language | **Bilingual EN + AR** stacked in every email (EN block, then AR). No per-user locale is stored; bilingual is correct for every recipient. |
| D6 | Opt-out | **Per-event preferences.** New `profiles.email_prefs` **jsonb**, default-on semantics: an **absent** key means send. Skip the send when the recipient's key is explicitly `false`. A minimal profile-settings UI toggles the three keys. Future `reminder` key needs no migration. |
| D7 | Failure isolation | Sends are **best-effort**: try/catch around every send, logged on failure, **never** propagated to the caller mutation. No-op + warn when `RESEND_API_KEY` unset (push VAPID pattern). |
| D8 | Recipient email | Resolved server-side from `auth.users` via the **service-role admin** client (`getUserById`). Never read client-side; never surfaced to the teacher who triggered the send. |
| D9 | Auth mail migration | Point `[auth.email.smtp]` in `config.toml` at **Resend SMTP** and raise `auth.rate_limit.email_sent` above 2. Same Resend domain/account as app mail. |
| D10 | Send layer shape | New `src/lib/email/` module: a provider-thin `sendEmail(to, subject, html)` + `notifyInvite` / `notifyHomework` / `notifySessionChange`, each of which resolves the recipient email, checks `email_prefs`, and renders the bilingual body. The reminder cron will call `sendEmail` directly. |
| D11 | From identity | A verified Resend sending domain (e.g. `notifications@<domain>`) supplied via `RESEND_FROM` env. Ops prerequisite (DNS verification) documented, not code. |

## Send flow (after)

```
server action (inviteByEmail / prescribeHomework / rescheduleSession / setSessionCanceled)
   └─ succeeds (row written) ──▶ fire notify*(...)  [best-effort, awaited-but-caught]
         └─ admin.getUserById(recipient) → email + profiles.email_prefs
              └─ pref key === false ? skip
                 : sendEmail(email, subject, bilingualHtml)
                      └─ POST api.resend.com/emails  (no-op+warn if no RESEND_API_KEY)
```

`email_prefs` shape: `{ invite?: bool, homework?: bool, session_change?: bool, reminder?: bool }`,
default `{}`. Absent key ⇒ enabled. The future reminder cron reads the same column + `sendEmail`.

## Security notes

- **No PII leak across users.** Every recipient is the **subject** of the mail (their own invite /
  homework / session). The triggering teacher never sees the recipient's email — it is resolved
  server-side via service-role and used only to address the send.
- **Prefs writes are self-only.** `email_prefs` lives on `profiles`, already covered by the existing
  "User updates own profile" self-only RLS. The co-member read policy exposes only names today; the
  send path reads prefs via **service-role** (bypasses RLS by design, server-only).
- **No enumeration vector.** Invite email only reaches an already-registered user the authenticated
  teacher explicitly invited; no new email→account probing surface.
- **Secrets.** `RESEND_API_KEY`, `RESEND_FROM`, and Resend SMTP creds are env-only, server-only,
  never committed (mirror `SUPABASE_SERVICE_ROLE_KEY` / VAPID handling).

## Scope / work breakdown

1. **Email module** — `src/lib/email/send.ts` (`sendEmail`, Resend fetch, no-op guard) +
   `src/lib/email/notify.ts` (`notifyInvite` / `notifyHomework` / `notifySessionChange`, recipient +
   pref resolution) + bilingual templates. Pure body-builders unit-testable.
2. **Prefs column + types** — migration adding `profiles.email_prefs jsonb not null default '{}'`;
   `EmailPrefs` type; `getMyProfile`/`saveEmailPrefs` service (self-only).
3. **Wire the three events** — call the matching `notify*` from `inviteByEmail`,
   `prescribeHomework`, and `rescheduleSession` + `setSessionCanceled`, best-effort.
4. **Settings UI** — three checkboxes on `/profile` bound to `email_prefs`, bilingual labels.
5. **Auth-mail migration** — `config.toml` `[auth.email.smtp]` → Resend, raise `email_sent`; document
   the Resend domain/DNS + env prerequisites.
6. **i18n + mock/tests** — EN/AR keys for settings UI; extend `mock.ts` for `email_prefs`; unit tests
   for body builders + pref gating.

## Non-goals (explicitly out)

- The reminder **scheduler** (pg_cron / edge function / cron route) and any `email_log` dedup table.
- Invite-accepted→teacher email and any teacher-directed mail.
- Emailing **unregistered** invitees (no email-keyed pending-invite table, no signup linking).
- Per-user locale preference or single-language sends (bilingual only).
- React Email / SDK templating; HTML-design polish beyond a clean bilingual transactional layout.
- Wiring the dormant web-push `sendPushToUser` (out of scope; email only).

## References

- Acceptance / validation contract: `docs/prd/0010-circle-email-notifications-contract.md`
- Build manifest: `docs/prd/0010-circle-email-notifications-build.md`
- Send precedent (service-role, no-op-on-missing-keys, prune/best-effort): `src/lib/push/send.ts`.
- Trigger call sites: `src/lib/services/membership.ts:190` (`inviteByEmail`),
  `src/lib/services/homework.ts:30` (`prescribeHomework`), `src/lib/services/sessions.ts`
  (`rescheduleSession`, `setSessionCanceled`).
- Auth cap + SMTP block: `supabase/config.toml:197` (`[auth.rate_limit]`), `:237` (`[auth.email.smtp]`).
- Profiles schema + self-only RLS: `supabase/migrations/20260626000003_create_profiles.sql`.
