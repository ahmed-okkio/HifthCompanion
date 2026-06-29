# PRD 0004 — Double-page spread (two-page Mushaf view)

> Status: planned (grilled 2026-06-28). Acceptance contract: `0004-double-page-spread-contract.md`.
> Touches the persistent reader shell + Fabric canvas (Story 24, `ReaderShell.tsx`,
> `useAnnotationCanvas.ts`), the page routing (`/reader/[page]`), and `lib/quran.ts` pairing.

## Problem / Goal

The reader shows one Mushaf page at a time. A physical Mushaf is read as a two-page
**spread** — hufaadh memorize against that two-page picture. The single-page view loses that
spatial layout and doubles the page-turn cadence.

**Goal:** a desktop spread mode that renders two pages side by side, both fully annotatable,
navigated a spread at a time, while keeping single-page mode and every existing single-page
link (`/reader/N`, surah-jump, share, bookmarks) working unchanged.

## Principles

- **Two real canvases, not one stitched.** The annotation model is keyed `set_id` + `page_number`.
  Each page in the spread is its own Fabric instance loading/saving its own page. No change to the
  data model, no merged-page row.
- **Single mode is untouched.** Spread is additive. `/reader/N` still renders a single page; all
  existing links keep working. Mobile is unchanged (single column).
- **Laziest thing that works.** No print-spread, no zoom-pan-per-page, no per-page set selection.
  Reuse the existing toolbar, sets card, and save path.

## Decisions (locked during grilling)

| # | Area | Decision |
|---|------|----------|
| D1 | Canvas model | **Two independent Fabric instances**, each keyed `(set_id, page_number)`, each loads/saves its own page. The Story-24 single persistent instance becomes a persistent **pair** — both survive spread→spread navigation (swap backgrounds + objects, no dispose). |
| D2 | Pairing | **Strict pairs** `(1,2),(3,4)…(603,604)`. No solo cover. 604 is even → exactly 302 spreads, no orphan page. |
| D3 | RTL order | Right page = **odd** (lower number), left page = even. Reading right→left, so the lower-numbered page sits on the right. |
| D4 | URL | Spread = `/reader/3-4`. Single = `/reader/3` (still valid). **Both modes coexist.** The range route parses `"N-M"`; the single route is unchanged. |
| D5 | Mode toggle | Button placed by the floating zoom control **under the page**. Desktop only (hidden below `lg`). Choice persisted in **localStorage**, applied on load. |
| D6 | Mobile | `/reader/N-M` on a narrow viewport **redirects** to `/reader/N` (the lower/right page). Spread is desktop-only; toggle hidden on mobile. |
| D7 | Nav stepping | Prev/next step by **2** (`3-4 → 5-6`). Page-jumper, surah-jump, and juz-jump to any page N **snap to N's spread** (e.g. jump to 4 → `/reader/3-4`). |
| D8 | Tools | Pen/color/width are **shared** — draw on whichever page you point at; the active tool applies to both canvases. |
| D9 | Zoom + Clear | Act on **both** pages together. |
| D10 | Undo/redo | **One chronological timeline across both canvases.** Each committed action records which canvas it hit, in order. Undo pops the most-recent action regardless of page (draw on p1, then twice on p2 → undo removes the two p2 actions first, then the p1 action). Redo is symmetric. |
| D11 | Notes/Share panel | **Deferred** — scope (active-page vs both-stacked) is blocked on another in-flight feature. Interim: the spread route fetches and shows the **lower page's** notes/share, structured so it can swap to per-active-page later. |

## Pairing helpers (`lib/quran.ts`)

```
spreadOf(page)   → [low, high]   // (3) → [3,4]; (4) → [3,4]; strict odd/even pairs
spreadUrl(page)  → "low-high"    // (3 | 4) → "3-4"
parseSpread(seg) → [low, high] | null   // "3-4" → [3,4]; "3" → null
```

RTL render order is a layout concern: the JSX places `high` (even) on the left and `low` (odd) on
the right; the data is page-numeric, the visual order is flipped in the flex container.

## Unified spread history (D10)

A shell-level controller wraps the two existing `CanvasHistory` instances:

```
order: Array<'left' | 'right'>      // push canvas id on each committed action
undo() → pop last id → that canvas.undo();  re-mirror canUndo/canRedo from the merged stack
redo() → reverse
```

Each `CanvasHistory` stays per-canvas (its own snapshot stack); the controller only owns the
*ordering*. Empty stack → no-op. This lives in the shell, not in `useAnnotationCanvas`, so a single
toolbar drives both hooks.

## Scope / work breakdown

1. **Pairing helpers** — `spreadOf`, `spreadUrl`, `parseSpread` in `lib/quran.ts` (+ unit test).
2. **Range route** — `/reader/[page]` accepts `"N-M"`. Server: validate, mobile-redirect to `/reader/N`
   (UA/responsive — redirect logic), fetch lower-page notes/share (D11 interim). Single `"N"` path
   unchanged.
3. **Shell** — `ReaderShell` renders one or two `AnnotationCanvas` in a RTL flex container based on
   mode; sizing splits the workspace width between the two (each height-bound as today).
4. **Dual-instance hook** — `useAnnotationCanvas` instantiated twice (one per page) or parametrized
   so two live independently; each keeps the Story-24 soft-swap on spread nav. Verify the persistent
   pair: navigating a spread does **not** dispose/recreate either Fabric (`__hifthFabricCreatedCount`
   stays at 2 across spread nav).
5. **Shared toolbar + history controller** — tools shared to both; zoom + clear fan out to both;
   undo/redo driven by the merged ordering (D10).
6. **Mode toggle** — button by the zoom control, localStorage-persisted, desktop-only; rewrites URL
   `N ↔ N-M`.
7. **Nav by 2 + snap** — `ReaderNav.go` and surah/juz jump emit the spread URL in spread mode; prev/next
   step 2.

## Non-goals (explicitly out)

- Per-page set selection (both pages share the one selected set).
- Spread-aware print / share-image of the whole spread.
- Independent per-page zoom or pan.
- Spread on mobile (redirects to single).
- Resolving the notes/share panel scope (D11 — deferred to the other feature).

## References

- Acceptance / validation contract: `docs/prd/0004-double-page-spread-contract.md`
- Persistent-canvas (soft page swap) origin: Story 24 — `useAnnotationCanvas.ts` header comment.
- Reader shell regions: `src/components/ReaderShell.tsx`.
- Pairing data: `src/lib/quran.ts`, `src/data/surahFirstPages.json`, `juzStartPages.json`.
</content>
</invoke>
