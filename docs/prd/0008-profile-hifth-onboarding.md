# PRD 0008 — Profile hifth onboarding + login refresh (grill-with-docs output)

> A user-level record of how much Quran a person has memorized, captured in a forced,
> interactive onboarding right after first login and editable later from the account menu — plus
> a visual refresh of the login/signup screens. Memorization is a **profile** attribute (it does
> not change circle to circle); per-circle log analytics are unchanged. The acceptance contract
> (`0008-profile-hifth-onboarding-contract.md`) is the source of truth for "done".

## Problem / Goal

- Circles compute memorization analytics from progress logs, but a person's *existing baseline*
  ("what I already had memorized before joining") lives nowhere and gets re-derived per circle.
- New users land straight in the reader with no capture of their hifth.
- The login/signup screens are a bare `حفظ` wordmark on a plain background.

Goal: capture a self-declared hifth baseline on the **profile**, once, via a modern interactive
input; force it after first login; let users edit it later; and spruce up the auth screens with a
real logo and richer visual treatment.

## Principles

- **Profile-level, not circle-level.** The baseline is one record per user, orthogonal to circle
  logs. This PRD does **not** merge it into circle coverage analytics (non-goal).
- **Reuse the mushaf domain lib.** `AYAH_COUNTS`, `TOTAL_SURAHS`, `getSurahName` already exist —
  validation and labels come from there, no new Quran data.
- **One editor component, two entry points.** The onboarding screen and the later "edit"
  screen render the same range-editor.
- **Existing profile RLS carries the new columns.** No new policy unless a decision requires it.

## Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | Store hifth in a **separate table** `public.user_hifth (user_id uuid pk → auth.users, memorized_ranges jsonb not null default '[]', onboarded_at timestamptz, updated_at timestamptz)`. `memorized_ranges` is an array of `{surah:int, from:int, to:int}` (1-indexed ayahs, inclusive); whole surah = `from:1, to:AYAH_COUNTS[surah]`. | Surah+ayah ranges (user choice). **Own table, not a `profiles` column**, because visibility is teacher-only (D9) and RLS is row-level — a column on the column-blind `profiles` table can't be hidden from fellow-student co-members. |
| D2 | `user_hifth.onboarded_at timestamptz null`. Onboarding "done" is this flag, **not** whether ranges are non-empty. | Memorizing nothing yet is valid; can't infer completion from empty ranges. |
| D3 | Onboarding is **forced** after login: a gate redirects an authenticated user whose `user_hifth` row is missing or has `onboarded_at IS NULL` to `/onboarding` for any protected path. No skip. | User picked forced. |
| D4 | Gate lives in `middleware.ts`: when a user is present and the path is protected (and not `/onboarding`), read the caller's own `user_hifth.onboarded_at` (PK lookup) and redirect if null/absent. Matcher extended to include `/reader`. | Middleware is the one central gate all entry points route through; login already sends users to `/reader/1`. One indexed PK read per protected navigation. |
| D5 | Input UI = **Juz quick-add + refine**. Tapping a juz bulk-adds the surahs (and ayah spans) that fall in that juz to the range list; the user then edits/removes individual entries (searchable surah + ayah from/to, chip list) to correct partials. | User chose this — fastest for full-juz huffaz (the common case: "I have the last N juz"). Juz→surah/ayah expansion uses `JUZ_START_PAGES` + page→surah/ayah mapping in `lib/quran.ts`. |
| D6 | Editor extracted as one component (`MemorizationEditor`), rendered by both `/onboarding` and a new `/profile` page. The inert "Settings" menu item in `ProfileMenu` is replaced/joined by a working **"My hifth"** entry linking to `/profile`. | "Editable later"; one component, two mounts; wires the dead menu entry. |
| D7 | Validation (client + server action): each range `1 ≤ from ≤ to ≤ AYAH_COUNTS[surah]`, `surah ∈ 1..114`. On save, ranges are **sorted by surah then from** and adjacent/overlapping ranges within the same surah **merged** (juz quick-add naturally produces adjacencies to collapse). Empty array allowed. | Keep storage clean and canonical; don't trust client. |
| D8 | Persist via a `saveMemorization` server action that upserts the caller's `user_hifth` row (ranges + `onboarded_at = now()`). Self-write only (`user_hifth.user_id = auth.uid()`). | Own-row upsert under a self-write policy. |
| D9 | **Teacher-only read.** `user_hifth` RLS: **self** read/write; a **circle teacher of the user** may read (new `teaches_user(_student)` security-definer helper — caller teaches a circle the student is an active member of). Fellow-student co-members get **nothing**. | User chose teacher-only. Separate table + narrow policy is the only way to hide it from other students while keeping names on `profiles` visible to all co-members. |
| D10 | Login/signup refresh: render a real logo asset at `public/logo.svg` (fallback: the styled `حفظ` wordmark if the file is absent), richer background treatment (gradient / subtle pattern), theme-aware (light + dark). Shared brand header extracted so login + signup match. | "Update login with our logo" (user will drop the file) + "spruce up". Graceful fallback so it ships before the asset lands. |
| D11 | i18n: add dictionary keys for onboarding + memorization strings in `lib/i18n/dictionaries.ts` (en + ar), consistent with existing tracker keys. | App is bilingual; new UI must not hardcode English. |

## Flow resolution

1. User signs up / logs in → `signInWithPassword` → router pushes `/reader/1`.
2. Middleware sees authenticated user, protected path, no `user_hifth` row / `onboarded_at IS
   NULL` → redirect `/onboarding`.
3. `/onboarding` renders the brand header + `MemorizationEditor`. User quick-adds juz and/or
   edits ranges (or none), hits **Done** → `saveMemorization(ranges)` → upserts ranges +
   `onboarded_at = now()`.
4. Redirect to `/reader/1`. Middleware now passes (flag set).
5. Later: account menu → **My hifth** → `/profile` → same `MemorizationEditor` prefilled →
   **Save** re-writes ranges (leaves `onboarded_at` set).

## Work breakdown

- **Migration** `supabase/migrations/…_user_hifth.sql`: create `public.user_hifth`, enable RLS, add self read/write policies + the `teaches_user(_student)` security-definer helper + a teacher read policy (D8/D9).
- **Types**: add `MemorizedRange` and `UserHifth` types.
- **Domain helper** `lib/memorization.ts`: validate + normalize (sort/merge) a range list, and `juzToRanges(juz)` expansion; pure, unit-tested.
- **Server action** `saveMemorization` + `getMyMemorization` (in `lib/services/profile.ts`): validate/normalize, self-upsert, stamp `onboarded_at`.
- **Component** `MemorizationEditor`: juz quick-add row + surah combobox + from/to + Add, chips list, Done/Save.
- **Route** `/onboarding`: forced entry, brand header + editor, Done → save → `/reader/1`.
- **Route** `/profile`: editor prefilled, Save.
- **Middleware gate** (D4): profile flag read + redirect; matcher includes `/reader`.
- **ProfileMenu**: wire "My hifth" → `/profile`.
- **Login/signup refresh** (D10): shared brand header, logo asset support + fallback, richer background, both themes.
- **i18n**: onboarding/memorization keys (en + ar).

## Non-goals

- Merging the profile baseline into per-circle coverage/analytics (`StudentAnalytics`, `coverageMap`) — future PRD.
- Surfacing a student's baseline inside the teacher's tracker UI — the RLS grant (D9) enables it, but no teacher-facing view is built here.
- Editing memorization from inside a circle/tracker view (only `/onboarding` + `/profile`).
- A full account/settings page beyond the hifth editor (Settings entry may stay "soon").
- Migrating existing users' baseline from their historical logs (they onboard on next login like everyone; the forced gate applies to them too).

## Security notes

- **Trust boundary (D9):** `user_hifth` is written self-only and read by **self + circle teachers
  of the user only**. Fellow-student co-members must get **zero rows**. This is why the data is a
  separate table, not a `profiles` column — the existing `profiles` "Co-members read" policy is
  column-blind and would leak it to every co-member. The `teaches_user` helper is `security
  definer` and must scope strictly to *caller teaches a circle the student is an **active**
  member of* — no wider.
- Server action re-validates every range against `AYAH_COUNTS` — a malicious client cannot store
  out-of-range or malformed entries (D7).
- The forced gate must not create a redirect loop: `/onboarding` itself and `/login`/`/signup`
  are exempt from the gate.

## References

- Precedents: `src/app/signup/page.tsx`, `src/app/login/page.tsx` (auth screens, brand header
  pattern), `components/tracker/ui.tsx` `SurahCombobox` + 0007 range picker (D5), `lib/quran.ts`
  `AYAH_COUNTS`/`getSurahName`/`JUZ_START_PAGES`/`getSurahForPage` (validation, labels, juz
  expansion), `20260626000003_create_profiles.sql` (`shares_halaqah` pattern the new
  `teaches_user` helper mirrors), `20260625000001_create_halaqah_membership.sql`
  (`is_halaqah_teacher`/`is_active_member`), `src/middleware.ts` (gate),
  `components/ProfileMenu.tsx` (menu entry).
- Contract: `0008-profile-hifth-onboarding-contract.md`.
- Build manifest: `0008-profile-hifth-onboarding-build.md`.
