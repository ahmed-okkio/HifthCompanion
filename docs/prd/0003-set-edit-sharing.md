# PRD 0003 — Edit-sharing annotation sets with account-holders

> Status: planned (grilled 2026-06-28). Acceptance contract: `0003-set-edit-sharing-contract.md`.
> Builds on the read-only share links (slice-09) and the teacher shared-set RLS pattern
> (`supabase/migrations/20260625000003_*`, `..._005_*`).

## Problem / Goal

Today a set owner can share a **read-only** link (`/share/[userId]/[page]?set=`, slice-09) —
the set UUID is the token, no account required. The only way to grant **write** access is the
teacher↔student halaqah path (`teacher_can_read_set`), which drags in roster/attendance/progress
semantics. There is no way for an owner to let a *peer with an account* edit a set.

**Goal:** an owner can grant edit access to specific account-holders by email. Those collaborators
edit annotations + notes in the set through the normal reader UI, clearly framed as editing
*someone else's* Mushaf. Read-only link sharing is unchanged (still no account needed).

## Principles

- **Reuse the teacher pattern.** Edit grants are a new, dedicated record gated by a
  `security definer` helper and **additive** RLS policies — exactly how `teacher_can_read_set`
  already grants cross-user read/write. No new auth machinery.
- **Accounts required for editing only.** Read-only sharing stays accountless.
- **Owner stays in control.** A collaborator edits content; it cannot rename/delete the set or
  re-share it.
- **Laziest thing that works.** No realtime, no pending invites, no directory search. Add when
  explicitly needed.

## Decisions (locked during grilling)

| # | Area | Decision |
|---|------|----------|
| D1 | Data model | New table `set_collaborators(set_id, user_id, granted_by, created_at)`, unique `(set_id, user_id)`, `on delete cascade` from `annotation_sets`. |
| D2 | Access gate | `is_set_collaborator(_set uuid)` — `security definer`, `stable`. Additive RLS on `annotations`/`notes` (SELECT+INSERT+UPDATE+DELETE) and SELECT on `annotation_sets`. Mirrors `teacher_can_read_set`. |
| D3 | Invite | **Exact email** lookup (case-insensitive, trimmed) → returns the matched account's name → owner confirms the person → grant. No partial/name search (privacy: avoids directory enumeration). |
| D4 | Write scope | Annotations + notes content only. Collaborator **cannot** rename/delete the set, **cannot** manage collaborators. Same scope as teacher edit. |
| D5 | Manage UI | Extend the existing Share card/popover: a "People with edit access" section — search-add by email, list current collaborators (by name), remove. Owner-only. |
| D6 | Edit surface | Reader internals, but a **collaborator-framed** view: single locked set, **no set-swapper**, "Set" terminology dropped, banner naming whose Mushaf is being edited. |
| D7 | Route | **Consolidated** `/share/[setId]/[page]`. Server computes the viewer's capability and the *same page* renders editable or read-only. Drops the separate read-only shell; `ReadOnlyCanvas` retires in favor of the reader canvas in a locked mode. Old `/share/[userId]/[page]?set=X` **redirects** to `/share/X/[page]` so links already in the wild survive. |
| D8 | Discovery | Copyable link **plus** a "Shared with me" list on `/sets`. Shared sets must **not** pollute the owner's own set list / set-swapper in the normal reader. |
| D9 | Concurrency | Last-write-wins (one `canvas_json` row per `(set_id, page_number)`). Documented limitation, not a bug. |
| D10 | Revoke | RLS recomputes instantly. A revoked collaborator's next save fails → toast "Your access to this set was removed" → redirect to their own reader. In-flight unsaved work is lost (accepted). |
| D11 | Edge cases | No account for email → error, no row. Owner's own email → rejected. Re-adding existing collaborator → idempotent no-op (unique constraint). Email matched case-insensitive + trimmed. |

## Capability resolution (server, at `/share/[setId]/[page]`)

```
viewer = supabase.auth.getUser()
  owner of set            → editable, full reader chrome
  is_set_collaborator     → editable, collaborator banner, single locked set, no swapper
  else (guest OR signed-in non-grantee) → read-only canvas + Log-In CTA
```

The capability is computed once on the server and passed to the canvas as props; the client never
decides its own permissions (RLS is the real enforcement — the prop only drives UI).

## Scope / work breakdown

1. **Migration** — `set_collaborators` + `is_set_collaborator()` + additive RLS policies on
   `annotations`, `notes`, and SELECT on `annotation_sets`. Copy the shape of
   `20260625000003_teacher_shared_set_rls.sql` and `..._005_teacher_shared_set_write.sql`.
2. **RPC** `account_by_email(_email text)` → `{ id, first_name, last_name }` for an exact,
   lowercased match. `security definer`, `revoke from anon`, `grant to authenticated`. (Generalizes
   the existing `user_id_by_email`.)
3. **Service** `src/lib/services/collaborators.ts` — `addByEmail(setId, email)`, `list(setId)`,
   `remove(setId, userId)`, `sharedWithMe()`.
4. **Manage UI** — extend `ShareCard`/`ShareButton` with the "People with edit access" section.
5. **Consolidated share route** — `/share/[setId]/[page]` with capability resolution; teach
   `AnnotationCanvas` / `useAnnotationCanvas` a `readOnly` + `lockedSet` mode (single set, hide
   `SetsCard`); collaborator banner; redirect old URL shape.
6. **Shared-with-me** — section on `/sets` querying `set_collaborators ⋈ annotation_sets`.
7. **Revoke handling** — save-error path → toast + redirect.

## Non-goals (explicitly out)

- Pending invites for emails without an account (accounts required to edit).
- Partial / name typeahead search (privacy — directory enumeration).
- Real-time co-editing or live "you were kicked" locking.
- Collaborator re-sharing or co-ownership.

## Security notes

- All cross-user access flows through `security definer` helpers + additive RLS, never through
  client-trusted props. The UI capability prop is convenience only.
- `account_by_email` returns only `{ id, first_name, last_name }` for an **exact** email — no
  enumeration, same exposure profile as the existing `user_id_by_email`.
- The set row stays owner-only for UPDATE/DELETE; collaborators get content tables only.
- Revocation is immediate because the helper is evaluated per-statement (no cached grant).

## References

- Acceptance / validation contract: `docs/prd/0003-set-edit-sharing-contract.md`
- Read-only share origin: `story-guidance/slice-09-share-links.md`
- Teacher cross-user RLS precedent: `supabase/migrations/20260625000003_*`, `..._005_*`
- Email→id RPC precedent: `supabase/migrations/20260625000004_user_id_by_email.sql`
</content>
</invoke>
