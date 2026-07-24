# Build manifest — 0012 Design system consolidation

- PRD: `0012-design-system.md`
- Contract: `0012-design-system-contract.md` (source of truth for done)

Workers run serially. Each milestone is one worker slice. A fresh-context validator is handed
**only the contract** and reports per-ID verdicts.

Security-critical IDs (block on FAIL): **E1** (no schema/RLS change). This PRD has no other security
surface.

Definition of done: every contract ID PASS via a fresh validator.

---

## M1 — Token reconciliation in globals.css

**Goal.** The canonical token layer: new tokens defined, button repointed, radius scale collapsed,
domain token groups added.

**Files.** `src/app/globals.css`

**Work.**
- Add `--teal-600: #0D9488` to the raw-scale (greens/brand) section.
- Add `--accent-contrast: #FFFFFF` in the semantic-alias section (on-accent text/icon).
- Repoint `.btn-primary` gradient stops to `var(--green-600)` and `var(--teal-600)` — no bare hex;
  keep the 135deg direction and the visual result unchanged.
- Collapse radius: set `--radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 20px`
  directly on the semantic aliases; **delete** `--radius-sm-px/--radius-btn-px/--radius-md-px/`
  `--radius-lg-px/--radius-max`. Keep `--radius-page: 6px` and `--radius-canvas: 24px` with their
  existing explanatory comments.
- Add a `--tajweed-*` token group (the 8 rule colors from `LegendModal.tsx:50-57` + the mark colors
  orange/red) and a `--home-*` group (demo-note colors, hero gold `#C9A24B`, marker red `#ef4444`).

**Constraints.**
- Reuse the existing raw-scale / semantic-alias structure and comment style. Do not rename existing
  tokens; only add, repoint, and remove the listed radius raws.
- No visual change to the button or to any surface except the intended radius value shift.

**Contract IDs.** A1, A2, A3, A4, A5, A6, A7

---

## M2 — Tokenize call sites (domain palettes, on-accent, radius consumers)

**Goal.** Every UI-chrome bare literal reads from a token; domain palettes read from the new groups.

**Files.** `src/components/LegendModal.tsx`, `MarkedPagesList.tsx`, `HomeReaderDemo.tsx`,
`src/app/page.tsx`, `MemorizationEditor.tsx`, `MobileAnnotationBar.tsx`, `NoteBadgeLayer.tsx`,
`NoteForm.tsx`, `SpreadNotesPanel.tsx`, `tracker/ui.tsx`, `tracker/TeacherStudent.tsx`,
`tracker/CircleRail.tsx`, `SurahNavPanel.tsx`, `EmailPrefsSection.tsx` (any others surfaced by grep).

**Work.**
- LegendModal + MarkedPagesList: replace bare rule/mark hex with `--tajweed-*` tokens.
- HomeReaderDemo + page.tsx: replace demo/marketing hex with `--home-*` tokens.
- Replace every `var(--accent-contrast, #fff)` and on-accent bare `#fff` with `var(--accent-contrast)`.
- Replace any `--radius-btn`/`--radius-max` consumer with `--radius-md`/`--radius-xl`.

**Constraints.**
- Value hygiene only — do **not** refactor markup, restructure components, or migrate unrelated
  inline styles. Smallest diff that swaps a literal for its token.
- Leave `layout.tsx` `themeColor` metadata as bare hex (Next manifest value, not chrome).
- Do not touch the fabric/canvas rendering colors that are annotation *ink* data, if any surface.

**Contract IDs.** B1, B2, B3, B4, B5, B6

---

## M3 — CSS Modules audit

**Goal.** The three CSS Modules carry no bare hex.

**Files.** `src/components/ReaderNav.module.css`, `src/components/ShareShell.module.css`,
`src/app/reader/[page]/page.module.css`.

**Work.** Grep each for bare hex; replace with the matching `var(--token)`. Add a token if an exact
match is missing (rare — prefer the nearest existing semantic alias).

**Constraints.** No structural CSS changes; color-value swaps only. Create no new module file.

**Contract IDs.** C1, C2

---

## M4 — The reference doc

**Goal.** `docs/design-system.md` — the single page a future feature reads before styling anything.

**Files.** `docs/design-system.md` (new).

**Work.** Write the doc with sections: **Tokens** (color incl. tajweed/home/accent-contrast,
spacing, the collapsed radius scale with the two exceptions + reason, type scale, shadow/elevation,
motion); **Component boundary** (atoms→classes, blocks→primitives, complex→token-valued modules)
with a usage table naming existing components; **Token-bypass policy**; **Resolved contradictions**
table (contradiction → decision); **Non-goals** (dark mode + the token seam note).

**Constraints.** Documentation only — reflect the tokens as they exist *after* M1. Do not restate
the whole PRD; link to it.

**Contract IDs.** D1, D2, D3, D4, D5, D6

---

## Cross-cutting (verified at the end, any milestone can violate)

- **E1** [SEC] — no `.sql` / RLS change ships. **E2** — no new route/schema/component (doc excepted).
  **E3** — build + lint clean. **E4** — button visually unchanged.

Every contract ID is covered by exactly one milestone (A→M1, B→M2, C→M3, D→M4; E cross-cutting).
`/implement docs/prd/0012-design-system-build.md` runs the orchestrated build.
