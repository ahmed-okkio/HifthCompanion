# Acceptance / Validation Contract — 0008 Profile hifth onboarding + login refresh

> Written **before** code (grilling output). Each item is an observable behavior, not a code
> shape. A validator (fresh context) checks the running system against this list and reports
> pass/fail per ID. **Do not edit this contract to make a failing test pass** — fix the code or
> escalate to amend the contract deliberately.
>
> Test layers:
> - **D** (schema/RLS): migration + policy checks against the DB.
> - **L** (pure logic): unit tests over `lib/memorization.ts` (validate / normalize / merge).
> - **O / E / U / A** (flows/UI): Playwright E2E + component behavior.
>
> **Blocking (security-critical, FAIL blocks the milestone): D2, D2b, D3, L2, O4.**

## D. Schema & RLS

- **D1** `public.user_hifth` exists with `user_id uuid pk → auth.users`, `memorized_ranges jsonb
  not null default '[]'::jsonb`, `onboarded_at timestamptz` (nullable), RLS enabled.
- **D2** *(blocking)* A user can **read and upsert only their own** `user_hifth` row
  (`user_id = auth.uid()`). A user **cannot read or write another user's** row directly.
- **D2b** *(blocking)* **Teacher-only read:** a **teacher of a circle the user is an active
  member of** can SELECT that user's `user_hifth` row; a **fellow student co-member (non-teacher)
  gets zero rows**; an unrelated user gets zero rows.
- **D3** *(blocking)* No redirect loop / lockout: `/login`, `/signup`, and `/onboarding` are
  reachable by an authenticated non-onboarded user (the gate exempts them).

## L. Memorization logic (`lib/memorization.ts`)

- **L1** `normalize` **sorts** ranges by surah then `from`, and **merges** overlapping/adjacent
  ranges within the same surah into one (e.g. `{2,1,50}` + `{2,40,100}` → `{2,1,100}`).
- **L2** *(blocking)* `validate` rejects any range with `surah ∉ 1..114`, `from < 1`,
  `from > to`, or `to > AYAH_COUNTS[surah]`. Valid whole-surah range is `1..AYAH_COUNTS[surah]`.
- **L3** An empty range list is valid (a user who has memorized nothing yet).
- **L4** `juzToRanges(juz)` returns the surah+ayah ranges covered by that juz (derived from
  `JUZ_START_PAGES` + page→surah/ayah mapping); feeding its output through `normalize` collapses
  contiguous juz into merged ranges.

## O. Onboarding gate & flow

- **O1** A freshly-created / non-onboarded user who navigates to any protected path
  (`/reader`, `/sets`, `/tracker`) is **redirected to `/onboarding`**.
- **O2** `/onboarding` shows the brand header and the memorization editor with a **Done** action;
  there is **no skip**.
- **O3** Completing onboarding (Done) writes the entered ranges and stamps `onboarded_at`, then
  redirects to `/reader/1`. Re-navigating to a protected path no longer redirects to `/onboarding`.
- **O4** *(blocking)* Onboarding with **zero ranges** still marks the user onboarded
  (`onboarded_at` set) and does **not** re-trap them at `/onboarding`.
- **O5** The `saveMemorization` server action **re-validates and normalizes** (L1/L2) before
  writing — a client posting an out-of-range ayah does not persist it.

## E. Memorization editor (shared component)

- **E1** The editor has a **juz quick-add** row: tapping a juz appends that juz's surah+ayah
  ranges to the list. A manual add path also lets the user pick a surah via a **searchable
  combobox** with ayah **from/to** (defaulting to whole surah) for corrections/partials.
- **E2** **Add** (and juz quick-add) appends the range as a chip in a list; each chip shows a human label
  (whole → surah name; partial → "name from–to") and is **removable**.
- **E3** from/to fields are typeable (can be cleared/retyped without snapping mid-edit) and are
  clamped to `1..AYAH_COUNTS[surah]` on blur/Add (same behavior as the 0007 picker).
- **E4** The same editor component is rendered by both `/onboarding` and `/profile` (one
  component, two mounts).

## U. Edit-later entry

- **U1** The account menu (`ProfileMenu`) has a working **"My hifth"** entry that navigates to
  `/profile` (the previously-inert Settings placeholder is wired or joined).
- **U2** `/profile` renders the editor **prefilled** with the user's saved ranges; **Save**
  persists edits and leaves `onboarded_at` set (does not re-trigger onboarding).

## A. Auth screen refresh

- **A1** Login and signup render a **logo**: `public/logo.svg` when present, otherwise the styled
  `حفظ` wordmark — no broken image, no crash when the asset is absent.
- **A2** The refreshed background/visual treatment renders correctly in **both light and dark**
  themes (no unreadable contrast, no horizontal overflow).
- **A3** All existing auth behavior is intact: login `signInWithPassword` → `/reader/1`; signup
  with first/last name still passes `data.first_name/last_name`; error and loading states show.
- **A4** New onboarding/memorization/auth strings are **translated** (en + ar) via
  `dictionaries.ts` — no hardcoded English in the new UI.

## Validator output format

Report one line per ID: `ID: PASS|FAIL — note`. List blocking failures (D2, D2b, D3, L2, O4) first.
Any blocking FAIL fails the milestone. Non-blocking FAILs are listed but may be triaged.
