# Acceptance / Validation Contract — 0003 Edit-sharing

> Written **before** code (grilling output). Each item is an observable behavior, not a code shape.
> A validator (fresh context, no implementation bias) checks the running system against this list
> and reports pass/fail per ID. Do not edit this contract to make a failing test pass — fix the code
> or escalate to the orchestrator to amend the contract deliberately.
>
> Test layers:
> - **A** (RLS / data model): exercised directly against Supabase (pgTAP or service-role
>   integration test impersonating each role). Security-critical.
> - **B–E**: Playwright E2E for UI flows; service/RPC unit tests where cheaper.
> - **F**: integration test of the save path.

## A. RLS / data model — security-critical

- **A1** A collaborator can `SELECT` annotations, notes, and the `annotation_sets` row of a set shared with them.
- **A2** A collaborator can `INSERT / UPDATE / DELETE` annotations and notes in that set.
- **A3** A collaborator **cannot** `UPDATE` or `DELETE` the `annotation_sets` row (no rename/delete).
- **A4** A collaborator **cannot** `INSERT/UPDATE/DELETE` `set_collaborators` (no re-share).
- **A5** An authenticated user who is neither owner nor collaborator gets **zero rows** for the set's annotations/notes and **cannot** write.
- **A6** After the owner deletes the grant, A1 and A2 return denied/zero **immediately** (no cached access).
- **A7** The owner retains full read/write/rename/delete regardless of grants.
- **A8** `unique(set_id, user_id)` — a duplicate grant insert is rejected or no-ops; never two rows.
- **A9** Deleting the set cascades and removes its `set_collaborators` rows.

## B. Invite flow

- **B1** Exact email of an existing account → returns that account's name; on confirm a grant row is created.
- **B2** Email with no account → "No Hifth Companion account found"; no row created.
- **B3** Owner enters their own email → rejected with a message; no row.
- **B4** Re-adding an existing collaborator → idempotent, friendly message, still exactly one row.
- **B5** Email is matched case-insensitively and whitespace-trimmed.
- **B6** `account_by_email` is **not** callable by the `anon` role.

## C. Edit surface — `/share/[setId]/[page]`

- **C1** Owner opens it → fully editable with normal reader chrome.
- **C2** Collaborator opens it → editable canvas; banner names the owner's Mushaf; **no set-swapper**; only the one set.
- **C3** A collaborator's drawing and notes save and are subsequently visible to the owner.
- **C4** Guest (logged-out) → read-only canvas, no annotation toolbar, Log-In CTA.
- **C5** Signed-in non-grantee → read-only (same as guest).
- **C6** Old `/share/[userId]/[page]?set=X` redirects to `/share/X/[page]` (existing links keep working).

## D. Manage UI (owner)

- **D1** Owner sees current collaborators listed by name.
- **D2** Remove → grant gone; the removed user's next save fails → toast "access removed" → redirect to own reader.
- **D3** A non-owner never sees the manage UI.

## E. Discovery

- **E1** A set shared with me appears under "Shared with me" on `/sets`; opening it lands on the editable view (C2).
- **E2** A shared set does **not** appear in my own set list or the set-swapper in the normal reader.

## F. Concurrency (documented limit, not a regression)

- **F1** Two sequential saves to the same `(set_id, page_number)` → last write wins, no error, exactly one row. Asserts the accepted last-write-wins behavior so a future "lost update" report is recognized as by-design.

## Validator output format

For each ID: `PASS` / `FAIL` / `BLOCKED` + one line of evidence (assertion, screenshot path, or SQL
result). A single `FAIL` on any **A** item blocks the milestone — security items are non-negotiable.
</content>
