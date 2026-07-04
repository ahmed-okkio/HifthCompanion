# PRD 0007 — Tracker & Share UX batch (grill-with-docs output)

> Seven-item UX batch across the teacher's student view (homework prescribe, sessions,
> profile layout) and the shared mushaf header. Decisions below are the settled output of a
> grill; the acceptance contract (`0007-tracker-ux-batch-contract.md`) is the source of truth
> for "done". No schema migration is required — all changes are UI/derivation over the
> existing tracker schema.

## Scope summary

| # | Fix | Surface |
|---|-----|---------|
| 1 | Ayah from/to inputs typeable (no clamp-on-keystroke) | `TeacherStudent.SurahPicker` |
| 2 | Searchable, styled surah picker (shared component) | new `ui.tsx` combobox + `SurahPicker` |
| 3 | Drop "whole" checkbox — range-only picker, 1..max = whole | `SurahPicker`, prescribe write |
| 4 | Prescribe form collapsed behind a button; review is default | `HomeworkPanel` |
| 5 | Virtual repeating sessions; attendance on "next" only; 3 sections | `StudentSessions`, sessions service |
| 6 | Shared mushaf header shows person's name primary, set as subtext | `share/[setId]/[page]`, `ShareShell` |
| 7 | Student page as two-column social-media profile | `TeacherStudent`, student page container |

---

## 1 — Ayah inputs typeable

**Problem:** `SurahPicker`'s ayah from/to `<input type="number">` call
`onChange={e => setAyahStart(clamp(Number(e.target.value)))}` on **every keystroke**. Empty
string → `Number('') = 0` → `clamp → 1`, so the field can't be cleared or mid-edited; it
snaps back and single digits default to the min/max.

**Decision:** Hold the field value as **raw text** while editing; coerce + clamp to
`1..AYAH_COUNTS[surah]` only on **blur** and on **Add**. The field can be empty transiently.
On Add, an empty/invalid field falls back to the clamped bound. Applies to both from and to.

## 2 — Searchable, styled surah picker (shared component)

**Problem:** surah is chosen via a plain `<select>` of 114 `<option>`s — no search, no
styling control.

**Decision:** Build **one reusable combobox** in `components/tracker/ui.tsx` (e.g.
`SurahCombobox`): a styled text input that filters surahs by number or name (en/ar) and shows
a styled dropdown listbox; click or Enter selects, Escape closes, click-outside closes.
Reuses `TOTAL_SURAHS` / `getSurahName`. `SurahPicker` swaps its `<select>` for it.

> Note: the student log form derives its surah from the page (`getSurahForPage`), so the only
> full 114-surah `<select>` today is the prescribe picker — the component has one caller now
> but is written reusable so future call sites drop in.

## 3 — Range-only picker (drop the "whole" concept from the UI)

**Problem:** the "whole" checkbox is an extra toggle; teacher wants ayahs always visible and
whole-surah as the natural default.

**Decision:** Remove the "whole" checkbox. The picker always shows ayah **from/to**, defaulting
to `1` and `AYAH_COUNTS[surah]` (i.e. the full surah). Teacher edits them to narrow.

- **Storage stays clean:** on Add, if the range equals `1..max` for that surah, store
  `ayah_start`/`ayah_end` as **null** (whole surah) so existing cards/labels keep rendering
  "whole"; otherwise store the actual `min..max` range. No new label formats, no DB change.
- The entry chips + prescription cards render exactly as today (whole vs "start–end").

## 4 — Prescribe collapsed behind a button

**Problem:** the always-open prescribe form sits **above** the prescriptions list and
self-submissions, burying the review surface the teacher opens the tab for.

**Decision:** Homework tab defaults to the **review** view — self-submissions + existing
prescription cards. A **"Prescribe homework" button** at the top **inline-expands** the
prescribe form in place; it collapses after a successful prescribe (and via a
cancel/close affordance). No modal. All existing prescribe logic (`SurahPicker`, type,
deadline, instructions, `handlePrescribe`) moves inside the collapsible, unchanged.

## 5 — Virtual repeating sessions

**Problem:** `generateSessions` materializes DB rows over a horizon and attendance is settable
on every row. Teacher wants a schedule that "just repeats" and attendance only on the session
that actually occurred.

**Model (settled):** the weekly rule (`membership.schedule = {weekdays, time}`) is the source
of truth; upcoming sessions are **virtual** (derived via `recurringSlots`). A real `session`
row is created **only on action**: when the "next" session's attendance is set (via
`materializeSession`), when a session is canceled, or for an ad-hoc session.

- **Drop the "Generate sessions" button.** Saving the schedule (weekday toggles + time) is
  all that's needed; the list re-derives from the rule. Ad-hoc add and cancel/reinstate stay.
- **Three sections, in order:**
  1. **Next session** — the **most recent slot at or before now** (nearest past-or-now virtual
     slot, or a same-day materialized/ad-hoc row). This is the **only** attendance-editable
     session; the teacher marks it after it occurs. If no session has occurred yet (brand-new
     schedule), this slot shows the **soonest upcoming** slot as display-only (no attendance
     buttons).
  2. **Upcoming** — future virtual slots (read-only; cancelable). No attendance buttons.
  3. **History** — past **materialized** rows that carry an attendance status (or cancel),
     newest first.
- **Dedup:** virtual slots derived from the rule must be **merged with existing materialized
  rows by `scheduled_at`** (a materialized row wins) so stale rows from the old
  `generateSessions` never double up. No migration needed.
- Marking attendance on the Next session materializes it (if virtual) and persists the status;
  it then belongs to History and the next past-or-now slot becomes the new "Next".

## 6 — Shared mushaf header shows the person, set as subtext

**Problem:** the read-only `ShareShell` header shows the **set name** as the primary context
label; opening a student's mushaf reads as a set, not a person.

**Decision:** Show the **set owner's display name** as the primary header text, with the **set
name as smaller subtext**.

- `share/[setId]/[page]` (READ_ONLY branch) fetches the owner profile
  (`getProfilesByIds([annotationSet.user_id])`) and passes `ownerName` to `ShareShell`
  alongside `setName`. `ShareShell` renders owner name primary + set name secondary in the
  header context slot.
- Guest / E2E with no resolvable owner **falls back** to the set name alone (no crash).
- The **collaborator** view (ReaderShell) already names the owner in its "Editing X's set"
  banner, so viewer-type parity holds without touching ReaderShell.

## 7 — Student page as a two-column profile

**Problem:** the teacher's student view is a stacked hero card + KPI row + tabs; teacher wants
a social-media profile feel.

**Decision:** Restyle `TeacherStudent` into a **two-column profile** (restyle only — no new
data):

- **Left sidebar** (sticky on desktop): avatar, display name, `active · {circle.name}` status
  line, the three KPI stats (streak / open homework / upcoming), and the Mushaf button.
- **Right column** (the "feed"): the existing `TabBar` (sessions / homework / notes /
  analytics) and its panels, unchanged.
- **Mobile:** columns stack — sidebar on top, feed below (single column).
- Widen the page container (currently `max-w-3xl`) to fit two columns comfortably.

---

## Out of scope

- Any schema migration (all seven are UI / derivation only).
- Making the student's own log form (`StudentCircle`) use the new combobox — its surah is
  page-derived; the combobox is built reusable but only wired into prescribe now.
- Cross-timezone session handling (unchanged from 0006 — wall-clock floats).
- Retiring the legacy `generateSessions` server action code (left in place; simply no longer
  called from the UI).
