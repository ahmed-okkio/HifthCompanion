# Acceptance / Validation Contract — 0006 Tracker & Mushaf fixes

> Written **before** code (grilling output). Each item is an observable behavior, not a code
> shape. A validator (fresh context) checks the running system against this list and reports
> pass/fail per ID. Do not edit this contract to make a failing test pass — fix the code or
> escalate to amend the contract deliberately.
>
> Test layers:
> - **A** (schema): migration + grep assertions.
> - **B** (pure logic): unit tests (recurrence, homework grouping/derivation).
> - **G/M/R/N**: Playwright E2E (multi-actor via the existing tracker seed/reset route).

## A. Schema

- **A1** `homework` has a nullable `group_id uuid` column. No `homework_item` table exists;
  `progress_log.homework_id` FK is unchanged (still → `homework.id`).

## G. Grading (issue 1)

- **G1** A student's submitted logs are **visible to the teacher** in the Homework tab of
  `TeacherStudent`: a log linked to a prescription (`homework_id` set) renders nested under
  that prescription card.
- **G2** Open self-submissions (`homework_id` null) render in a **"Self-submissions" section**
  below the prescriptions list.
- **G3** Each ungraded log shows an inline grader whose grade options come from
  `circle.teacher_statuses` (configurable — changing the circle's teacher statuses changes the
  buttons; no hardcoded pass/redo). Grading sets `teacher_status` + `teacher_comment` via
  `gradeLog` and stamps `reviewed_at`.
- **G4** After grading, the log renders **locked**: chosen status + comment shown, grader
  controls disabled; it cannot be re-graded from the UI.
- **G5** Grading is scoped per log — grading one student's log does not alter another's, and a
  teacher can only grade logs for memberships in a circle they teach (RLS unchanged).

## M. Mushaf button (issue 2)

- **M1** The Mushaf button in `TeacherStudent` renders a book icon **and** the "Mushaf" label,
  and still links to `/share/{defaultSetId}/1` (disabled state when no default set unchanged).

## R. Session time floats (issue 3)

- **R1** A teacher sets a weekly slot at **17:00** and generates sessions; the generated
  session rows display **17:00** to the teacher (not a shifted UTC time).
- **R2** The **same** session displays **17:00** to the student regardless of the student's
  device timezone (floating wall-clock — verified by rendering under a non-UTC TZ).
- **R3** `recurringSlots` is timezone-independent: for a given `{weekdays, time}` it produces
  the same slot wall-clock times regardless of the host process timezone (unit test runs under
  a shifted `TZ`). Ad-hoc sessions created at 17:00 also display 17:00.
- **R4** Weekday selection is honored across the TZ boundary: a Monday-only rule generates only
  slots that render as Monday (no off-by-one-day from UTC vs local `getDay`).

## H. Quran-aware homework (issue 4)

- **H1** Prescribe UI selects **surah(s)** by name (not raw page numbers). Adding a surah with
  no ayah range = whole surah; the UI knows each surah's ayah count and rejects/clamps an ayah
  range outside `1..AYAH_COUNTS[surah]`.
- **H2** Prescribing an assignment with two surahs creates **two `homework` rows** sharing one
  non-null `group_id`, same `type` and `deadline`; whole-surah entries have null
  `ayah_start`/`ayah_end`, narrowed entries store the range.
- **H3** Teacher **and** student render that assignment as **one grouped card** listing both
  surah entries (e.g. "Al-Fatiha (whole)" + "Al-Baqarah 1–20"), showing surah names + ayah
  ranges, not page numbers.
- **H4** Submission linking and grading remain **per surah entry** (per row): a student can
  submit/link against one entry independently; the group card's status reflects the aggregate
  (open until all entries completed).
- **H5** A pre-existing homework row with `group_id = null` still renders correctly as a
  single-entry card (no regression).
- **H6** Derived `page_start`/`page_end` on a whole-surah row match `SURAH_FIRST_PAGES` bounds
  (unit): surah S → `[SURAH_FIRST_PAGES[S], SURAH_FIRST_PAGES[S+1]-1]`, last surah → ends 604.

## N. RTL page nav (issue 5)

- **N1** In the reader (`AnnotationCanvas`), the control that advances to a **higher** page is
  the **left**-side, left-pointing chevron; the **right**-side chevron goes to a lower page —
  consistent with the lower page sitting on the right in a spread.
- **N2** Same mirrored behavior in the read-only/collaborator share nav (`ShareShell`):
  left = next (higher page), right = previous (lower page).
- **N3** Boundary disabling is preserved: at page 1 the "previous" (right) control is disabled;
  at the last page the "next" (left) control is disabled.

## S. Shared rail + `/shared` (issue 7)

- **S1** The rail shows **two** mushaf items: "My Mushaf" (→ `/reader/1`) and "Shared Mushafs"
  (→ `/shared`).
- **S2** On a `/reader/*` route "My Mushaf" is the active rail item; on a `/share/*` route
  "Shared Mushafs" is the active item (and "My Mushaf" is not).
- **S3** `/shared` lists every set shared **with** the viewer (collaborator, not owner), each
  showing the owner's display name and linking to `/share/{setId}/1`. A viewer with no shared
  sets sees an empty state; a set they own does **not** appear here.
- **S4** The mobile nav drawer reflects the same two items and active states (single source of
  truth with the rail).
