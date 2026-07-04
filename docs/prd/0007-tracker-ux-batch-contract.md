# Acceptance / Validation Contract — 0007 Tracker & Share UX batch

> Written **before** code (grilling output). Each item is an observable behavior, not a code
> shape. A validator (fresh context) checks the running system against this list and reports
> pass/fail per ID. Do not edit this contract to make a failing test pass — fix the code or
> escalate to amend the contract deliberately.
>
> Test layers:
> - **B** (pure logic): unit tests (session sectioning/dedup, whole-range → null).
> - **P/S/T**: Playwright E2E (teacher actor via the existing tracker seed/reset route).
> - No schema layer — 0007 adds no migration.

## P. Prescribe picker (issues 1–4)

- **P1** In the surah picker, the ayah **from** and **to** fields can be **cleared and
  retyped** freely: selecting the field, deleting to empty, and typing a new number does not
  snap back to a default mid-edit. A single-digit value stays as typed while focused.
- **P2** On **blur** (and on Add), an out-of-range or empty ayah field is coerced/clamped into
  `1..AYAH_COUNTS[surah]`; the persisted prescription never stores an ayah outside that range.
- **P3** The surah field is a **searchable combobox** (not a plain 114-option select): typing
  part of a surah name or its number filters a styled dropdown; selecting an entry sets the
  surah. Component lives in `tracker/ui.tsx` and is reusable (single caller today).
- **P4** There is **no "whole" checkbox**. The picker always shows ayah from/to, defaulting to
  `1` and the surah's ayah count.
- **P5** Adding a surah entry **left at the full `1..max` range** stores `ayah_start`/`ayah_end`
  as **null** (whole surah) and the card/chip renders "whole"; a narrowed entry stores the
  actual range and renders "start–end". (Unit-checkable on the write path + visible on the card.)
- **P6** The Homework tab **defaults to the review view**: self-submissions + existing
  prescription cards are visible without expanding anything; the prescribe form is **hidden**.
- **P7** A **"Prescribe homework" button** inline-expands the prescribe form in place; after a
  successful prescribe the form collapses back and the new prescription appears in the list.

## T. Sessions (issue 5)

- **T1** There is **no "Generate sessions" button**. Saving the weekly schedule (weekday
  toggles + time) alone produces an upcoming session list derived from the rule.
- **T2** The sessions tab shows three ordered sections: **Next session**, **Upcoming**,
  **History**.
- **T3** Attendance buttons appear **only** on the Next session (the most recent slot at/before
  now). Upcoming (future) sessions have **no** attendance buttons.
- **T4** When no session has occurred yet, the Next section shows the **soonest upcoming** slot
  with **no** attendance buttons (display-only), and Upcoming lists the rest.
- **T5** Marking attendance on the Next session **materializes** exactly one `session` row
  (if it was virtual) with the chosen status; re-opening the page shows it in **History**, and
  the next past-or-now slot becomes the new Next session.
- **T6** Virtual slots are **deduped against existing materialized rows** by `scheduled_at`: a
  slot that already has a real row (e.g. legacy `generateSessions` output, ad-hoc, or a marked
  session) appears **once**, using the real row. (Unit-checkable on the merge helper.)
- **T7** Ad-hoc add and cancel/reinstate still work; a canceled session is not offered
  attendance.

## S. Shared mushaf header (issue 6)

- **S1** Opening a shared set read-only shows the **set owner's display name** as the primary
  header text with the **set name as smaller subtext** (not the set name as the primary label).
- **S2** A guest / unresolvable-owner view **falls back** to the set name alone with no error.
- **S3** The collaborator view still names the owner (existing "Editing X's set" banner) — no
  regression; parity of "whose mushaf" holds across viewer types.

## Pr. Profile layout (issue 7)

- **Pr1** On desktop the student page renders a **two-column** layout: a left sidebar
  (avatar, name, `active · {circle}`, the three KPI stats, Mushaf button) and a right column
  containing the existing TabBar + panels.
- **Pr2** On mobile the layout **stacks** to a single column (sidebar above the feed).
- **Pr3** All existing data and controls survive the restyle: the KPIs (streak / open homework
  / upcoming), all four tabs, and the Mushaf button (incl. its no-default-set disabled state)
  are present and functional.
