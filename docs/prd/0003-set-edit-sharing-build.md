# Build Manifest — 0003 Edit-sharing

> Single handoff file for `/implement`. Orchestrator runs the milestone ladder below, one worker +
> one fresh validator per milestone, strictly serial.
>
> - PRD: `docs/prd/0003-set-edit-sharing.md`
> - Acceptance contract: `docs/prd/0003-set-edit-sharing-contract.md`
> - Process: `docs/workflow/orchestrated-implementation.md`

## Security-critical contract IDs (any FAIL blocks its milestone)

`A1 A2 A3 A4 A5 A6 A7 A8 A9 B6`

## Definition of done

Every contract ID (A1–A9, B1–B6, C1–C6, D1–D3, E1–E2, F1) reports PASS from a fresh-context
validator with evidence. Documented limitation F1 (last-write-wins) is expected to remain.

## Milestone ladder

### M1 — DB: collaborators table + RLS
- **Goal:** `set_collaborators(set_id, user_id, granted_by, created_at)`, unique `(set_id,user_id)`,
  `on delete cascade`. `is_set_collaborator(_set uuid)` security-definer helper. Additive RLS:
  SELECT+INSERT+UPDATE+DELETE on `annotations` and `notes` gated by the helper; SELECT on
  `annotation_sets`. Set row stays owner-only for UPDATE/DELETE.
- **Files:** new `supabase/migrations/2026XXXX_set_collaborators.sql`.
- **Reuse:** copy shape of `20260625000003_teacher_shared_set_rls.sql` + `..._005_*`.
- **Contract IDs:** A1, A2, A3, A4, A5, A6, A7, A8, A9.

### M2 — RPC: account_by_email
- **Goal:** `account_by_email(_email text)` → `{id, first_name, last_name}` exact lowercased match;
  `security definer`, revoke from `anon`, grant to `authenticated`.
- **Files:** new migration.
- **Reuse:** generalize `20260625000004_user_id_by_email.sql`.
- **Contract IDs:** B6 (and underpins B1, B2, B5).

### M3 — Service layer
- **Goal:** `collaborators.ts` — `addByEmail(setId,email)`, `list(setId)`, `remove(setId,userId)`,
  `sharedWithMe()`. Enforce edge cases: no-account error, own-email reject, idempotent dup,
  ci+trim email.
- **Files:** new `src/lib/services/collaborators.ts`.
- **Contract IDs:** B1, B2, B3, B4, B5.

### M4 — Manage UI (owner)
- **Goal:** extend `ShareCard`/`ShareButton` with "People with edit access": add-by-email (confirm
  name), list by name, remove. Owner-only.
- **Files:** `src/components/ShareCard.tsx`, `src/components/ShareButton.tsx`.
- **Contract IDs:** D1, D3.

### M5 — Consolidated share route + capability
- **Goal:** `/share/[setId]/[page]`; server capability resolution (owner/collaborator → editable,
  else read-only). Teach `AnnotationCanvas`/`useAnnotationCanvas` a `readOnly` + `lockedSet` mode
  (single set, hide `SetsCard`); collaborator banner naming the owner's Mushaf. Redirect old
  `/share/[userId]/[page]?set=X` → `/share/X/[page]`. Retire `ReadOnlyCanvas`.
- **Files:** `src/app/share/**`, `src/components/AnnotationCanvas.tsx`,
  `src/hooks/useAnnotationCanvas.ts`, `src/components/ReaderShell.tsx`/new collab shell.
- **Contract IDs:** C1, C2, C3, C4, C5, C6.

### M6 — Shared-with-me discovery
- **Goal:** "Shared with me" section on `/sets` from `sharedWithMe()`; ensure shared sets do NOT
  leak into the owner's own set list / swapper in the normal reader.
- **Files:** `src/app/sets/**`, reader/layout set queries.
- **Contract IDs:** E1, E2.

### M7 — Revoke handling
- **Goal:** save-error path → toast "Your access to this set was removed" → redirect to own reader.
- **Files:** `src/hooks/useAnnotationCanvas.ts` (save error handling), share view.
- **Contract IDs:** D2.

### M8 — Concurrency assertion
- **Goal:** integration test asserting last-write-wins on `(set_id,page_number)` — no error, one row.
- **Files:** test only.
- **Contract IDs:** F1.

## Coverage check

A1–A9 → M1 · B1–B5 → M2/M3 · B6 → M2 · C1–C6 → M5 · D1,D3 → M4 · D2 → M7 · E1,E2 → M6 · F1 → M8.
All contract IDs covered, no orphans.
</content>
