# Acceptance / Validation Contract — 0009 Marked pages & Needs Focus

> Written **before** code (grilling output). Each item is an observable behavior, not a code
> shape. A validator (fresh context) checks the running system against this list and reports
> pass/fail per ID. **Do not edit this contract to make a failing test pass** — fix the code or
> escalate to amend the contract deliberately.
>
> Test layers:
> - **L** (pure logic): unit tests over the count/badge/needs-focus helpers.
> - **S** (service): the marked-pages aggregate query against a set.
> - **R** (reader UI): the Marked tab in `SurahNavPanel` + patch-on-save.
> - **C** (circles UI): the default-set list on the student-detail page.
>
> **Blocking (FAIL blocks the milestone): L1, S1, R3.**

## L. Count / badge / needs-focus logic

- **L1** *(blocking)* Mark count for a page = `canvas_json.objects.length`. Every Fabric object
  counts 1 (pen path, circle/ellipse, underline/line, highlighter rect, text). A single
  multi-point freehand stroke is one path ⇒ contributes 1, not N.
- **L2** `badgeLevel(count)` returns `grey` for `1–2`, `orange` for `3–5`, `red` for `6+`.
  `count = 0` never appears (empty pages are not rows).
- **L3** "Needs Focus" applies to **every** page whose count equals the set's max count. With an
  empty set (no marked pages) nothing is tagged. A single unique max tags exactly one page; a tie
  at the max tags all tied pages.
- **L4** Sort order is **count descending, then page ascending** (stable on ties).

## S. Marked-pages service

- **S1** *(blocking)* `markedPages(setId)` returns one row per page **that has ≥1 mark** in that
  set, as `{page, count}`, sorted per L4. Pages with zero marks (never stored / deleted) do **not**
  appear. Reading is scoped by existing annotation RLS: a caller only gets rows for a set they may
  read (own set or a set shared with them); no cross-set leakage.
- **S2** The count comes from a **DB-side** `jsonb_array_length(canvas_json->'objects')` aggregate,
  not by downloading each page's canvas to the client.

## R. Reader Marked tab (`SurahNavPanel` on `/reader`)

- **R1** The nav panel has two tabs: **Surahs** (existing list, unchanged default) and **Marked**.
  Switching to Marked shows only pages with ≥1 mark for the **active set** (`selectedSetId`), each
  row = page number + count badge colored per L2, with a "Needs Focus" pill on max-count rows (L3),
  ordered per L4.
- **R2** A Marked-tab row is a **jump link**: activating it navigates the reader to that page (same
  routing as a surah row, including spread mode).
- **R3** *(blocking)* **Patch-on-save, no refetch on page swap.** Drawing/erasing/clearing on a page
  and letting it save updates that page's count **in place** (badge recolors, row re-sorts, Needs
  Focus tag moves) without a page reload and without re-running the aggregate. Navigating between
  pages (prev/next/surah-jump) does **not** refetch. The aggregate runs on initial load and on
  **set-switch** only.
- **R4** Erasing a page down to **zero** marks (or Clear-all) **removes** that page's row from the
  Marked list after the save.
- **R5** Switching the active set refetches and the Marked tab reflects the new set's pages.
- **R6** **Empty state**: a set with zero marked pages shows a "No marked pages yet" message in the
  Marked tab (tab still present, no list, no tag).

## C. Circles student-detail (`tracker/[circleId]/student/[membershipId]`)

- **C1** The student-detail page renders the **default-set** marked-pages list (same badge colors
  and Needs Focus tag, ordered per L4) alongside the existing analytics.
- **C2** The list is visible to **both** the teacher (viewing the student) and the student
  (viewing themselves). It is **read-only** here (no draw-time patching).
- **C3** A student with no default-set marks shows the same empty state (C1 renders "No marked
  pages yet").

## Share / read-only view (`/share/[setId]`)

- **SH1** The Marked tab appears in the read-only share view, **fetch-only**: it lists the shared
  set's marked pages (L2/L3/L4) with no save-patching (nothing is editable). Jump links still work.

## i18n

- **I1** All new strings ("Marked", "Needs Focus", "No marked pages yet", count/aria labels) are
  translated in **both** en and ar via `dictionaries.ts` — no hardcoded English in the new UI.
  Numbers render via the existing `fmtNum` (Eastern Arabic numerals in ar).

## Validator output format

Report one line per ID: `ID: PASS|FAIL — note`. List blocking failures (L1, S1, R3) first.
Any blocking FAIL fails the milestone. Non-blocking FAILs are listed but may be triaged.
