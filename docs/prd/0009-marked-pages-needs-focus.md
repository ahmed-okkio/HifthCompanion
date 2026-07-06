# PRD 0009 — Marked pages & Needs Focus (grill-with-docs output)

> A per-set view of which Mushaf pages carry the most annotations, surfaced as a new "Marked" tab
> in the reader's surah nav panel and mirrored (default set) on the Circles student-detail page.
> An annotation is a mistake/correction mark; more marks on a page ⇒ more attention needed. The
> acceptance contract (`0009-marked-pages-needs-focus-contract.md`) is the source of truth for
> "done".

## Problem / Goal

- Annotations are stored per page (`annotations.canvas_json.objects[]`) but there is **no view of
  where the marks concentrate**. A user can't see "which pages did I/my teacher mark up most".
- We already have two notions of weakness — teacher-graded `weakestSurahs()` (from `ProgressLog`)
  and self-declared `UserHifth.weakest_surahs`. Neither uses the annotation marks themselves.

Goal: count annotation marks per page for a set, list the marked pages (marked-only) with a
count badge and a "Needs Focus" tag on the heaviest page(s), in the reader nav panel, and show the
default-set version on the Circles student-detail page.

## Principles

- **Page granularity, not surah.** Annotations are per-page with pixel coords and no ayah tag; a
  page spans multiple surahs. Attributing marks to a surah is inherently ambiguous, so the unit is
  the **page**. This sidesteps attribution entirely.
- **One signal only (for now).** This feature is annotation counts alone. It does **not** merge in
  graded-log negatives or the self-declared surah list (non-goal; those keep their own surfaces).
- **Per-set, not unioned.** Each set has its own marked-page stat. Reader shows the active set;
  Circles shows the student's default set.
- **Fetch once, patch locally.** One DB aggregate per set on load / set-switch; draw-time edits
  patch the single affected page's count in memory. No polling, no per-page-swap refetch.
- **Honest naming.** The badge counts marks; it does not prove weakness (a teacher marking a page
  thoroughly is not student failure). Tab reads "Marked"; the heaviest-page tag reads "Needs Focus".

## Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | The unit is the **page**, not the surah. "Most-annotated pages", surfaced as a **Marked** tab. Reject surah attribution. | Annotations are per-page; a page spans ≥1 surah with no per-mark ayah mapping. User pivoted to weakest-*page*. |
| D2 | **One mark = one Fabric object** = one entry in `canvas_json.objects[]`. Pen path, circle, underline, highlighter rect, text each count 1. A multi-point freehand stroke is one path ⇒ 1. | Matches storage exactly; count is `objects.length`. |
| D3 | **Single signal: annotation counts only.** Do not combine graded-log negatives or `UserHifth.weakest_surahs`. | User: "keep it clean, only annotations for now." Those signals aren't page-native and would dilute the ranking. |
| D4 | **Per-set stat, no union.** Reader Marked tab uses the **active set** (`selectedSetId`); Circles uses the student's **default set** (`AnnotationSet.is_default`). | User: "each set has its own stat." |
| D5 | Name = **Marked** (tab) + **Needs Focus** (tag on max-count page). Not "weakest". | User picked "Needs Focus" over honest-literal names; badge stays honest (counts marks, doesn't claim weakness). |
| D6 | Count source = **DB aggregate**, one query per set: `select page_number, jsonb_array_length(canvas_json->'objects') as n from annotations where set_id = $1 order by n desc`. Empty pages are already deleted from the table (`annotationStore.save`), so no zero rows. | Reader only loads the open page's canvas; the tab needs all pages. Postgres counts server-side; small payload. |
| D7 | **Fetch once, patch locally.** Query fires on initial load and on **set-switch** only. The panel lives in the persistent reader shell (does not remount on page nav), so page swaps never refetch. Draw/erase/clear patches the one affected page's count in memory via a new `onSaved(page, count)` callback out of `useAnnotationCanvas` (chokepoint: `saveCanvas`, which already has `payload.objects.length`). Count 0 ⇒ remove the page's row. Full reload (F5) refetches once. | User asked how to stop recounting on every swap/refresh. Persistent panel + in-memory patch = one query per load, zero while working. |
| D8 | Badge color by count: **grey `1–2`, orange `3–5`, red `6+`**. | User confirmed. Round, legible, no config. |
| D9 | **Needs Focus tag** = a pill on **every page tied at the max count** in the set. Zero marks in the set ⇒ no tag. | User confirmed tag-all-ties (honest; rare to tie high). |
| D10 | Marked tab **sort = count desc, then page asc**. | Heaviest first; page order stable on ties. |
| D11 | **Circles placement**: the student-detail page `tracker/[circleId]/student/[membershipId]`, visible to **both teacher and student**, next to existing analytics (heatmap, coverage). Uses the student's default set. | User chose "Student detail page". One surface, both roles. |
| D12 | **Share/read-only view** (`/share/[setId]`) shows the Marked tab too, **fetch-only** (no draw-time patching — nothing editable). | User chose "Yes, fetch-only". Free; useful for reviewing a shared mushaf. |
| D13 | **Empty state**: a set with zero marked pages shows a "No marked pages yet" message in the tab — no list, no tag. Tab is always present (not hidden). | User chose empty-state message over hide-tab (avoids jumpy appear/disappear). |
| D14 | **Mobile**: desktop `SurahNavPanel` first; mobile drawer (`MobileSurahDrawer`/`MobileNavDrawer`) parity in the same pass if cheap, else a follow-up. | Default taken while user away; user may scope to desktop-only. |

## Data & compute

- New read service (e.g. `lib/services/markedPages.ts`): `markedPages(supabase, setId): Promise<{page:number; count:number}[]>` running the D6 aggregate, sorted per D10.
- New pure helper (e.g. in `lib/analytics.ts` or a small `lib/markedPages.ts`):
  - `badgeLevel(count): 'grey'|'orange'|'red'` per D8.
  - `maxCount(rows)` / `isNeedsFocus(count, max)` per D9.
- Reader wiring: reader fetches `markedPages(activeSet)` and passes rows + an `onSaved` patch handler down to `SurahNavPanel`. `useAnnotationCanvas` gains an `onSaved?(page, count)` prop, called from `saveCanvas` after a successful save (count = `payload.objects.length`, or 0 on the empty-delete path).
- Circles wiring: student-detail page fetches `markedPages(defaultSet)` server-side and renders the same presentational list (read-only, no patch).

## UI

- **Marked tab** in `SurahNavPanel`: a two-tab header (Surahs | Marked). Marked lists only pages
  with ≥1 mark, each row = page number + a count badge (grey/orange/red) + "Needs Focus" pill on
  max-count rows. Rows are jump-to-page links (reuse `handleSelect`/spread routing).
- Badge and pill use existing design tokens (`--neutral-*`, an orange, a red/`--red-*`, radius,
  type sizes) — no new palette.

## i18n

- New keys (en + ar) via `dictionaries.ts`: tab labels ("Surahs" already exists / "Marked"),
  "Needs Focus", "No marked pages yet", and any count/aria labels. No hardcoded English.

## Non-goals

- Surah-level attribution or a "weakest surah" from annotations (explicitly dropped for page).
- Merging graded-log negatives or `UserHifth.weakest_surahs` into this ranking.
- Cross-set union / aggregate across all a user's sets.
- Real-time recount / websockets. Fetch-once + local patch only.
