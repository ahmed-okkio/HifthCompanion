# Acceptance / Validation Contract — 0004 Double-page spread

> Written **before** code (grilling output). Each item is an observable behavior, not a code shape.
> A validator (fresh context, no implementation bias) checks the running system against this list
> and reports pass/fail per ID. Do not edit this contract to make a failing test pass — fix the code
> or escalate to the orchestrator to amend the contract deliberately.
>
> Test layers:
> - **A** (pairing/routing math): pure-function unit tests (`lib/quran`) — cheap, exhaustive.
> - **B–E**: Playwright E2E for the desktop spread UI; **F** for the persistence/undo path.

## A. Pairing + routing math — unit

- **A1** `spreadOf(3)` and `spreadOf(4)` both → `[3,4]`; `spreadOf(1)` → `[1,2]`; `spreadOf(604)` → `[603,604]`.
- **A2** Every page 1–604 maps to exactly one spread; 302 spreads total, no page in two spreads, no orphan.
- **A3** `parseSpread("3-4")` → `[3,4]`; `parseSpread("3")` → `null`; `parseSpread("4-3")`/garbage → `null` or normalized, never a crash.
- **A4** `spreadUrl(4)` → `"3-4"` (snaps any page to its pair's URL).

## B. Spread layout + RTL

- **B1** `/reader/3-4` on desktop renders **two** page canvases side by side.
- **B2** The **odd** page (3) is on the **right**, the **even** page (4) on the **left** (RTL).
- **B3** Both canvases are annotatable: drawing on each saves to its own `page_number` (3 vs 4).
- **B4** `/reader/3` still renders a **single** page (single mode untouched).

## C. Mode toggle + persistence

- **C1** A toggle control sits by the zoom control under the page (desktop).
- **C2** Toggling spread on from `/reader/3` navigates to `/reader/3-4`; toggling off returns to `/reader/3`.
- **C3** After enabling spread, a reload (or a fresh visit to `/reader/N`) opens in **spread** mode (localStorage persisted).
- **C4** The toggle is **not** shown below the `lg` breakpoint.

## D. Navigation

- **D1** Prev/next step a whole spread: from `3-4`, next → `5-6`, prev → `1-2`.
- **D2** Page-jumper to `4` in spread mode lands on `/reader/3-4` (snaps to pair).
- **D3** Surah-jump / juz-jump in spread mode lands on the spread **containing** the target page.
- **D4** Boundaries: prev disabled/clamped at `1-2`; next disabled/clamped at `603-604`.

## E. Mobile

- **E1** `/reader/3-4` on a narrow viewport **redirects to `/reader/3`** and renders a single column.
- **E2** The spread toggle is absent on mobile.

## F. Shared controls + persistence — critical

- **F1** **Persistent pair:** navigating spread→spread (`3-4 → 5-6`) does **not** recreate Fabric —
  `window.__hifthFabricCreatedCount` stays `2` across the navigation (no dispose/reload flash).
- **F2** Pen/color/width selected once apply to **both** pages (draw on either after changing tool).
- **F3** **Clear** wipes **both** pages; **zoom** scales **both** together.
- **F4** **Unified undo order:** draw once on the right page, then twice on the left → three undos
  remove the two left actions first (newest→oldest), then the right action. Redo restores in reverse.
- **F5** Empty-stack undo/redo is a safe no-op.
- **F6** Each page's annotations persist to its own `(set_id, page_number)` row and reload correctly
  after a page-swap and after a full reload.

## G. Notes panel (deferred scope — interim assertion)

- **G1** In spread mode the context panel shows the **lower page's** notes/share without error.
  (Scope decision D11 is deferred; this only asserts the interim behavior, not the final design.)

## Validator output format

For each ID: `PASS` / `FAIL` / `BLOCKED` + one line of evidence (assertion, screenshot path, or
test output). A `FAIL` on any **F** item (data loss / persistence / undo correctness) blocks the
milestone.
</content>
