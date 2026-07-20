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
- **L3** *(amended 2026-07-20 — user-approved. Reason: locale is now persisted on `profiles.locale`,
  so the recipient's language is knowable server-side; the original bilingual rule existed only
  because locale lived in a cookie the sending teacher's request could not read. Second amendment,
  same date, user-approved: the bilingual fallback is **removed** — a doubled-up email read worse
  for everyone than a single English one, and English is the safe default for an unknown reader.)*
  Every email body and subject is written in the **recipient's own language**: `locale = 'ar'` ⇒
  Arabic only, container marked `dir="rtl"` with mirrored text alignment; **every other case** —
  `'en'`, null, never-set, or an unrecognized stored value — ⇒ **English only**, `dir="ltr"`. No
  email is ever bilingual. In every case the body carries the same event facts (student/teacher
  name, page/surah range or deadline or old→new session time as applicable).
- **L5** *(added 2026-07-20)* **Human-readable times in the recipient's zone.** No body interpolates
  a raw ISO timestamp. Timestamps are formatted with a single shared helper (`formatWhen` in
  `templates.ts`) via `Intl.DateTimeFormat` in the recipient's language. Timezone resolution order:
  **`profiles.timezone` (the recipient's own) → the circle's `schedule.timezone` → `UTC`** — teacher
  and student are frequently in different zones, so the circle's zone is only a fallback. Every
  rendered time **carries its zone label** (`timeZoneName: 'short'`), e.g. "Monday, 20 July 2026 at
  17:00 GMT+1" — an unlabelled time is ambiguous exactly when the two parties differ. A date-only
  deadline renders without a clock time or label; an unparseable free-form deadline passes through
  unchanged.
- **L7** *(added 2026-07-20)* **Recipient timezone capture.** `profiles.timezone` is a nullable
  `text` column (no new RLS — the existing self-only "User updates own profile" policy is
  column-blind). The browser persists `Intl.DateTimeFormat().resolvedOptions().timeZone` once per
  session on app load (`I18nProvider`) and alongside locale in one round trip when the language
  switcher is used. Both writes are best-effort: a failure never blocks or breaks the UI. `notify.ts`
  reads `timezone` from the **same** profile select that already fetches `email_prefs` and `locale`
  — no extra round trip.
- **L6** *(added 2026-07-20)* **Presentable shell.** All three builders render through one shared
  table-based, inline-CSS layout (max-width ~600px, centered card, "Hifth Companion" wordmark,
  heading, message, a distinct key-facts block, and a muted footer stating the mail is automatic and
  preferences are changeable in Settings). No `<style>` blocks, external CSS, web fonts, or images —
  Gmail/Outlook strip them. Builders stay **pure**: facts in, HTML out.
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
  *(Amended 2026-07-20: `setSessionCanceled` notifies in **both** directions. Originally it fired
  only when cancelling, because the sole template said "canceled". A student told a lesson is off
  and never told it is back on will not turn up — so un-cancelling now sends its own "session back
  on" body, which must never reuse the cancel copy.)*
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
