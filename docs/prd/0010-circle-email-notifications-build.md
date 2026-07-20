# Build Manifest — 0010 Circle email notifications

> Single file `/implement` consumes. Links, milestone ladder, contract→work mapping.
> - PRD: `0010-circle-email-notifications.md`
> - Contract: `0010-circle-email-notifications-contract.md`
>
> **Security-critical contract IDs (block milestone on FAIL): S1, S3, P2, C1.**

## Milestone ladder

Ordered; each is one worker slice. Every contract ID is covered by exactly one milestone.

### M1 — Send layer + bilingual templates
- **Goal:** the provider-thin send function + pure body/pref helpers.
- **Files:** new `src/lib/email/send.ts` (`sendEmail`, Resend `fetch`, no-op guard); new
  `src/lib/email/templates.ts` (bilingual body builders + `prefEnabled`); new
  `src/tests/email.test.ts`.
- **Constraints:** **no new dependency** — plain `fetch` POST to `https://api.resend.com/emails`
  with `Authorization: Bearer ${RESEND_API_KEY}`, `from = RESEND_FROM`. **No-op + single
  `console.warn` when `RESEND_API_KEY` unset; never throw** (copy the shape of `ensureVapid` /
  best-effort send in `src/lib/push/send.ts`). Body builders are pure (name/range/deadline/times in,
  bilingual HTML out), EN block then AR block with `dir="rtl"`. `prefEnabled` = default-on (absent ⇒
  true, only explicit `false` disables).
- **Contract IDs:** L1, L2, L3, L4.

### M2 — Prefs column + save service + types
- **Goal:** persist per-event opt-out, self-only.
- **Files:** new `supabase/migrations/<ts>_profiles_email_prefs.sql`; `src/types/index.ts`
  (`EmailPrefs`); `src/lib/services/profile.ts` (`getMyProfile`/`saveEmailPrefs`);
  `src/lib/supabase/mock.ts` (email_prefs on profiles).
- **Constraints:** `alter table public.profiles add column email_prefs jsonb not null default
  '{}'::jsonb`. **Do not** add new RLS — the existing self-only "User updates own profile" policy
  (`20260626000003_create_profiles.sql`) already governs writes; verify it covers the new column.
  `saveEmailPrefs` merges into `auth.uid()`'s own row only, untouched other fields.
- **Contract IDs:** P1, P2 *(blocking)*, P3.

### M3 — Notify helpers + wire the three events
- **Goal:** connect mutations to sends, best-effort, service-role recipient resolution.
- **Files:** new `src/lib/email/notify.ts` (`notifyInvite` / `notifyHomework` /
  `notifySessionChange`); `src/lib/services/membership.ts` (call from `inviteByEmail`);
  `src/lib/services/homework.ts` (call from `prescribeHomework`); `src/lib/services/sessions.ts`
  (call from `rescheduleSession` **and** `setSessionCanceled`).
- **Constraints:** each `notify*` resolves the recipient email via the **service-role admin client**
  (`getUserById`, reuse the `createSupabaseAdmin` pattern from `push/send.ts`), reads that user's
  `email_prefs`, gates via `prefEnabled`, then `sendEmail`. Wrap each call at the mutation site in
  try/catch so a failure is **logged, never re-thrown** — the mutation's own return value/behavior is
  unchanged. Recipient email never returned to the caller. Send only on the mutation **success** path.
- **Contract IDs:** S1 *(blocking)*, S2 *(blocking)*, S3 *(blocking)*, S4, S5.

### M4 — Profile settings UI + i18n
- **Goal:** the three opt-out checkboxes.
- **Files:** `src/app/profile/page.tsx` (add the toggles section); `src/lib/i18n/dictionaries.ts`
  (en + ar keys).
- **Constraints:** three checkboxes (invite / homework / session_change) prefilled from
  `email_prefs` (checked when key absent or true), persisting via `saveEmailPrefs` on change.
  Bilingual labels + helper text, no hardcoded English. Reuse existing profile-page form styling.
- **Contract IDs:** U1, U2, U3.

### M5 — Auth-mail migration + ops docs
- **Goal:** move Supabase auth mail to Resend, lift the 2/hr cap.
- **Files:** `supabase/config.toml` (`[auth.email.smtp]`, `[auth.rate_limit].email_sent`); PRD/README
  ops note for the Resend domain + env vars.
- **Constraints:** enable `[auth.email.smtp]` pointed at Resend SMTP with `pass = env(...)` (no secret
  committed), `sender_name` + `admin_email` set; raise `email_sent` above 2. Document the verified
  Resend sending domain (DNS), `RESEND_API_KEY`, `RESEND_FROM`, and SMTP env vars as launch
  prerequisites. **Do not** commit any credential.
- **Contract IDs:** C1 *(blocking)*.

## Definition of done

Every contract ID (L1–L4, S1–S5, P1–P3, U1–U3, C1) reports **PASS** via a fresh-context validator
run against the running system + DB (Resend `fetch` mocked; no live sends required). Any blocking
FAIL (S1, S2, P2, C1) fails the milestone regardless of other passes.
