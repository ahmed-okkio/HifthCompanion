# Acceptance / Validation Contract — 0010 Circle email notifications

> Written **before** code (grilling output). Each item is an observable behavior, not a code shape.
> A validator (fresh context) checks the running system against this list and reports pass/fail per
> ID. **Do not edit this contract to make a failing test pass** — fix the code or escalate to amend
> the contract deliberately.
>
> Test layers:
> - **L** (pure logic): body-builder + pref-gating helpers, no network.
> - **S** (service/wiring): the `notify*` helpers + event call sites, Resend `fetch` mocked.
> - **P** (prefs data): `email_prefs` column, RLS, save service.
> - **U** (UI): the profile settings toggles.
> - **C** (config): auth-mail migration.
>
> **Blocking (FAIL blocks the milestone): S1, S2, P2, C1.**

## L. Send layer + templates (pure)

- **L1** `sendEmail(to, subject, html)` issues **one** authenticated `POST` to
  `https://api.resend.com/emails` with `from = RESEND_FROM`, `to`, `subject`, `html`, and the
  `Authorization: Bearer ${RESEND_API_KEY}` header. No other network calls, no SDK import.
- **L2** *(no-op guard)* When `RESEND_API_KEY` is unset, `sendEmail` **does not** call the network,
  returns a skipped result, and logs a single `console.warn` — it does **not** throw. (Mirrors
  `ensureVapid` in `push/send.ts`.)
- **L3** Every email **body is bilingual**: an English block followed by an Arabic block, both
  carrying the same event facts (student/teacher name, page/surah range or deadline or old→new
  session time as applicable). The Arabic block is marked `dir="rtl"`.
- **L4** `prefEnabled(prefs, key)` returns `true` when the key is **absent** (default-on) and `false`
  **only** when the key is explicitly `false`. `{}` ⇒ every event enabled.

## S. Event wiring (Resend fetch mocked)

- **S1** *(blocking)* **Best-effort, never blocks.** If the email send throws (or is a no-op), the
  triggering mutation still **succeeds** and returns its normal result. `inviteByEmail` still creates
  the pending membership, `prescribeHomework` still returns its rows, `rescheduleSession` /
  `setSessionCanceled` still persist — with a send error swallowed + logged, never re-thrown.
- **S2** *(blocking)* Each of the three events fires exactly its own notify on the **success** path:
  `inviteByEmail` → `notifyInvite` (recipient = invited user), `prescribeHomework` → `notifyHomework`
  (recipient = the homework's student), `rescheduleSession` **and** `setSessionCanceled` →
  `notifySessionChange` (recipient = the session's student). No email on the failure/throw path of
  the mutation.
- **S3** The recipient's email address is resolved **server-side via the service-role admin client**
  (`getUserById`), never from a client-supplied value and never returned to the triggering teacher.
- **S4** **Pref gate honored.** When the recipient's `email_prefs` has the matching key set to
  `false` (`invite` / `homework` / `session_change`), `sendEmail` is **not** called for that event.
  Absent key ⇒ sent (L4).
- **S5** A future `reminder` path can call `sendEmail` directly and would be gated by the `reminder`
  key under the same L4 rule — verified by the pref helper covering an unknown/`reminder` key
  (no reminder trigger exists yet; this only asserts the layer is reminder-ready).

## P. Prefs data

- **P1** `profiles` has an `email_prefs jsonb not null default '{}'`. Existing rows read as `{}`
  (all events enabled) after migration — no backfill breakage.
- **P2** *(blocking)* **Self-only write.** A user can update **only their own** `email_prefs` (the
  existing "User updates own profile" self-only RLS covers it); no user can write another's prefs.
  The send path reads prefs via service-role (server-only), not via the browser client.
- **P3** `saveEmailPrefs(partial)` merges into the caller's own row (`user_id = auth.uid()`), leaving
  other profile fields untouched.

## U. Profile settings UI (`/profile`)

- **U1** `/profile` shows three labeled checkboxes — invite, homework, session-change — reflecting
  the current `email_prefs` (checked = enabled, i.e. key absent or `true`).
- **U2** Toggling a checkbox persists via `saveEmailPrefs`; reloading reflects the saved state.
- **U3** All three labels + helper text are translated in **both** en and ar via `dictionaries.ts`
  — no hardcoded English.

## C. Auth-mail migration (config)

- **C1** *(blocking)* `config.toml` `[auth.email.smtp]` is **enabled** and points at Resend SMTP with
  credentials via env substitution (no secret committed), and `[auth.rate_limit].email_sent` is
  raised above `2`. The PRD/build documents the required verified Resend domain + env vars
  (`RESEND_API_KEY`, `RESEND_FROM`, SMTP creds) as launch prerequisites.

## Validator output format

Report one line per ID: `ID: PASS|FAIL — note`. List blocking failures (S1, S2, P2, C1) first.
Any blocking FAIL fails the milestone. Non-blocking FAILs are listed but may be triaged.
