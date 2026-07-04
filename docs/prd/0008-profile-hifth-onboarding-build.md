# Build Manifest — 0008 Profile hifth onboarding + login refresh

> Single file `/implement` consumes. Links, milestone ladder, contract→work mapping.
> - PRD: `0008-profile-hifth-onboarding.md`
> - Contract: `0008-profile-hifth-onboarding-contract.md`
>
> **Security-critical contract IDs (block milestone on FAIL): D2, D2b, D3, L2, O4.**

## Milestone ladder

Ordered; each is one worker slice. Every contract ID is covered by exactly one milestone.

### M1 — Schema + RLS + types + memorization logic
- **Goal:** create the `user_hifth` table with teacher-only RLS, add types, build the pure
  validate/normalize/juz helper.
- **Files:** new `supabase/migrations/<ts>_user_hifth.sql`; `src/types/index.ts`
  (add `MemorizedRange`, `UserHifth`); new `src/lib/memorization.ts`; new
  `src/tests/memorization.test.ts`.
- **Constraints:** table `user_hifth (user_id uuid pk → auth.users on delete cascade,
  memorized_ranges jsonb not null default '[]'::jsonb, onboarded_at timestamptz, updated_at
  timestamptz default now())`, RLS enabled. Policies: self read/insert/update
  (`user_id = auth.uid()`); **teacher read** via new `teaches_user(_student uuid)`
  security-definer helper (mirror `shares_halaqah`, but scope to *caller teaches a circle the
  student is an **active** member of* — use `is_halaqah_teacher`/`is_active_member` semantics).
  **No fellow-student read.** Reuse `AYAH_COUNTS`/`JUZ_START_PAGES`/`getSurahForPage` from
  `lib/quran.ts` for validation + `juzToRanges`.
- **Contract IDs:** D1, D2 *(blocking)*, D2b *(blocking)*, L1, L2 *(blocking)*, L3, L4.

### M2 — Save action + middleware gate
- **Goal:** persist path + the forced-onboarding redirect.
- **Files:** `src/lib/services/profile.ts` (add `saveMemorization` + `getMyMemorization`);
  `src/middleware.ts` (gate + matcher includes `/reader`).
- **Constraints:** server action self-upserts only (`user_id = auth.uid()`), re-validates via
  `lib/memorization.ts`, stamps `onboarded_at = now()`. Gate: only when user present & path
  protected & not `/onboarding`/`/login`/`/signup`; one PK read of the caller's own
  `user_hifth.onboarded_at`; redirect to `/onboarding` when null/absent. **No redirect loop.**
- **Contract IDs:** D3 *(blocking)*, O1, O5.

### M3 — MemorizationEditor component
- **Goal:** the shared interactive range editor.
- **Files:** new `src/components/MemorizationEditor.tsx`; reuse `SurahCombobox` from
  `components/tracker/ui.tsx`.
- **Constraints:** **juz quick-add row** (tap juz → `juzToRanges` → append) plus a manual add
  path reusing the 0007 combobox + typeable-ayah pattern (raw text, clamp on blur/Add). Chips
  list with removable entries + whole/partial labels via `getSurahName`. Props: initial ranges +
  an `onSave(ranges)` callback + a Done/Save label — no route logic inside.
- **Contract IDs:** E1, E2, E3, E4.

### M4 — /onboarding + /profile routes + menu wiring
- **Goal:** mount the editor at both entry points, wire the menu.
- **Files:** new `src/app/onboarding/page.tsx`; new `src/app/profile/page.tsx`;
  `src/components/ProfileMenu.tsx` ("My hifth" → `/profile`).
- **Constraints:** `/onboarding` = brand header + editor, Done → `saveMemorization` →
  `/reader/1`, no skip. `/profile` = editor prefilled from `getMyMemorization`, Save persists,
  leaves `onboarded_at`. Zero-range Done still onboards (O4).
- **Contract IDs:** O2, O3, O4 *(blocking)*, U1, U2.

### M5 — Auth screen refresh + i18n
- **Goal:** logo + visual spruce on login/signup, translations.
- **Files:** `src/app/login/page.tsx`, `src/app/signup/page.tsx` (extract a shared brand
  header); optional `src/components/AuthBrand.tsx`; `public/logo.svg` reference (asset supplied
  later — fallback to `حفظ`); `src/lib/i18n/dictionaries.ts` (en + ar keys).
- **Constraints:** don't regress existing auth logic (A3). Logo absent → wordmark, no broken
  image. Theme-aware via existing CSS vars; no horizontal overflow. Add keys for all new UI
  strings across M2–M5.
- **Contract IDs:** A1, A2, A3, A4.

## Definition of done

Every contract ID (D1–D2b, D3, L1–L4, O1–O5, E1–E4, U1–U2, A1–A4) reports **PASS** via a
fresh-context validator run against the running system + DB. Any blocking FAIL (D2, D2b, D3, L2,
O4) fails the milestone regardless of other passes.
