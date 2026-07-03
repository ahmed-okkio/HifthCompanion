# PRD 0006 — Tracker & Mushaf fixes (grill-with-docs output)

> Batch of six fixes across the tracker (grading, sessions, homework) and the reader
> (mushaf button, RTL nav, whose-mushaf rail). Decisions below are the settled output of a
> grill; the acceptance contract (`0006-tracker-mushaf-fixes-contract.md`) is the source of
> truth for "done". One issue from the original batch (a Symbols explainer page) was
> **dropped** and is out of scope.

## Scope summary

| # | Fix | Surface |
|---|-----|---------|
| 1 | Teacher can see + grade student logs | `TeacherStudent` Homework tab |
| 2 | Book logo on the Mushaf button | `TeacherStudent.MushafButton` |
| 3 | Session generate time is timezone-agnostic | `recurrence.ts`, sessions display |
| 4 | Quran-aware, multi-surah homework | homework prescribe + list, migration |
| 5 | Page-swap arrows respect RTL | `AnnotationCanvas`, `ShareShell` |
| 7 | Rail shows whose mushaf; new `/shared` page | `NavRail`, new route |

---

## 1 — Teacher review + grading of logs

**Problem:** `TeacherStudent` has tabs sessions/homework/notes/analytics and no surface to
see or grade submitted logs, even though `gradeLog()` (progressLog.ts) and the `logs` prop
already exist. Teacher can never review submissions.

**Decision:** Surface grading **inside the Homework tab** (no new tab).

- **Linked logs** (`progress_log.homework_id` set) render nested under their prescription card.
- **Open self-submissions** (`homework_id` null) render in a **"Self-submissions" section
  below** the prescriptions list.
- Each log shows the student's range/type/notes/status and an **inline grader**: grade buttons
  sourced from `circle.teacher_statuses` (configurable `{label, polarity}` — do **not**
  hardcode pass/redo) + a `teacher_comment` field. Submit calls the existing
  `gradeLog(id, { teacher_status, teacher_comment })`.
- A reviewed log (`reviewed_at` set) renders **locked/graded** (shows the chosen status +
  comment, grader disabled), matching the existing student-side "locked" treatment.

**Plumbing:** `TeacherStudent` already receives `logs` and `circle`; pass
`circle.teacher_statuses` down to the Homework panel. No schema change.

## 2 — Book logo on the Mushaf button

**Decision:** `MushafButton` (TeacherStudent) renders the **open-book SVG + existing "Mushaf"
label** (icon + label, not icon-only). Reuse the book path already in `NavRail.IconSurahs` /
`ShareShell` brand — no new asset. One-file change.

## 3 — Timezone-agnostic session times (floating wall-clock)

**Problem:** `recurringSlots` runs inside the `generateSessions` server action, so
`slot.setHours` uses the **server** timezone (UTC), while ad-hoc sessions build their ISO on
the client. A teacher who picks 17:00 sees a shifted time.

**Decision:** Times **float** — a session at 17:00 shows as **17:00 to every client**, no
per-viewer conversion. No schema change (`scheduled_at` stays `timestamptz`):

- Store the picked wall-clock **as if UTC**: `recurringSlots` uses `setUTCHours` /
  `getUTCDay`; ad-hoc builds `` `${date}T${time}:00Z` ``.
- **Render** every session time **and date** with `timeZone: 'UTC'` — audit all
  `scheduled_at` display sites: `fmtTime`, the `toLocaleDateString` weekday/day labels,
  `DateChip`, and the student-side session list in `StudentCircle`.

Rationale: 1:1 circles are effectively single-locale; "class at 5pm" is a wall-clock label.
Absolute-instant mode adds per-user TZ + DST machinery for a cross-TZ case that barely exists
here; `recurrence.ts` already defers cross-TZ.

## 4 — Quran-aware, multi-surah homework

**Problem:** prescribe form is page-range only (NumberStepper 1–604), not Quran-aware.

**Model (settled):** a prescription targets **one or more surahs**. Each surah entry defaults
to the **whole surah** and can optionally be narrowed to an **ayah range** (start/end clamped
by `AYAH_COUNTS[surah]`). One **type** and one **deadline** apply to the whole assignment.

**Storage — `group_id`, no table rework:** `homework` keeps one surah/range per row.

- Migration: add nullable `group_id uuid` to `homework`.
- Prescribe writes **N rows** (one per surah) sharing a generated `group_id`, each with
  `surah`, `ayah_start`/`ayah_end` (null when whole surah), same `type`/`deadline`, and
  `page_start`/`page_end` **derived** best-effort (whole surah: `SURAH_FIRST_PAGES[surah]` …
  `SURAH_FIRST_PAGES[surah+1] - 1`, last surah → 604; kept only for reader-linking/back-compat).
- Both teacher and student lists **`groupBy(group_id)`** and render the group as **one card**;
  entries listed inside; **submission linking, grading, and status stay per-row (per-surah)** —
  unchanged mechanics.
- **Group status** (card badge) = aggregate of its rows (open until all rows completed).
- **Legacy rows** (`group_id` null) render as their own single-entry card (back-compat).
- **Display:** cards show **surah name + ayah range** (e.g. "Al-Baqarah 1–20", "Al-Fatiha
  (whole)"), not raw page numbers, using `surahNames.json`.

Why not a full rework: `progress_log.homework_id` already points at one surah/range — the exact
grain students submit and teachers grade at. A child `homework_item` table would force the FK
to move (`homework_item_id`), dragging `linkedCount`, `homeworkStatus`, analytics, RLS, and a
data migration, for zero new capability. No richer assignment-level features are planned.

## 5 — RTL page-swap arrows

**Problem:** reader (`AnnotationCanvas`) and share (`ShareShell`) arrows use LTR convention
(prev = left-pointing on the left, next = right-pointing on the right), but the mushaf is RTL —
the spread already puts the lower page on the **right** (`flex-row-reverse`), so advancing to a
higher page means moving **left**. Arrows contradict the layout.

**Decision:** **Mirror fully for RTL.** Next (higher page) = **left**-pointing chevron on the
**left** side; Previous (lower page) = **right**-pointing chevron on the **right** side. Apply in
both `AnnotationCanvas` (single + spread, `flush` start/end branches) and `ShareShell`. No
keyboard/swipe handlers exist, so this is arrow buttons only.

## 7 — Rail shows whose mushaf + `/shared` page

**Problem:** the left `NavRail` is shared by `/reader` (your set) and `/share/*` (someone
else's) with no indication of which. Guest read-only uses `ShareShell` (no rail) and is out of
scope; collaborator share renders through `ReaderShell` (has the rail).

**Decision:** Split the single "Mushaf" rail item into two, so the **active item** signals
whose mushaf:

- Rename `surahs` item → label **"My Mushaf"**, `href: '/reader/1'`, `matchPrefixes: ['/reader']`.
- Add a **"Shared Mushafs"** item (new handshake/shared icon) at the end,
  `href: '/shared'`, `matchPrefixes: ['/shared', '/share']`. Active on any `/share/*` route.
- New **`/shared` page**: server component calling the existing
  `sharedWithMe()` (collaborators.ts) — lists every set shared with the viewer (owner display
  name via `getProfilesByIds`), each row linking to `/share/{setId}/1`. Reuse existing
  card/AppShell styling.
- Mirror the split in `MobileNavDrawer` (it renders `RAIL_ITEMS` — single source of truth, so
  it follows automatically; verify labels/active-state).

---

## Out of scope

- **Symbols explainer page** — dropped from this batch.
- Absolute-instant / cross-timezone session handling.
- Any `homework_item` child table / assignment entity.
