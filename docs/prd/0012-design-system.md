# PRD 0012 — Design system consolidation (grill-with-docs output)

> Hifth Companion already has a mature token layer (`src/app/globals.css`, "V3 knowledge
> workspace", PRD 0002). This PRD does **not** invent a design system — it **consolidates** the one
> that exists: names the canonical choices, resolves the contradictions the audit found, and writes
> the reference doc future features build against. The acceptance contract
> (`0012-design-system-contract.md`) is the source of truth for "done".

## Problem / Goal

The audit of 83 `.tsx` files found a token layer with strong but incomplete adoption (696 of 802
inline `style={{}}` reference `var(--…)`) and several live contradictions:

- **The primary button fights its own tokens.** `.btn-primary` renders a green→teal
  `linear-gradient` using a bare `#0d9488` that lives in no scale, while `--accent-solid` is flat
  `--green-600` (`src/app/globals.css`).
- **A missing "on-accent" token.** ~8 files write `var(--accent-contrast, #fff)` or bare `#fff` for
  text/icons on a green fill; `--accent-contrast` was never defined, so every call site invents the
  fallback (`MemorizationEditor.tsx:190`, `MobileAnnotationBar.tsx:189`, `NoteBadgeLayer.tsx:163`,
  `tracker/ui.tsx:799`, `tracker/TeacherStudent.tsx:527`, others).
- **Radius sprawl.** Seven radius tokens (`--radius-sm/btn/md/lg/max/canvas/page`) plus stray
  `rounded-2xl` and arbitrary `[Npx]` in markup.
- **Three styling mechanisms, no stated boundary.** Global CSS classes (`.btn/.card/.input/.badge`),
  React primitives (`tracker/ui.tsx`), and three `.module.css` files — with no rule for which to
  reach for.
- **Scattered domain-palette literals.** LegendModal's 8 tajweed rule colors, the mark colors in
  `MarkedPagesList.tsx`, and the marketing demo colors in `HomeReaderDemo.tsx` / `page.tsx` are
  bare hex with no home.

Goal: lock a canonical decision for each, tokenize the values that should be tokens, and publish
`docs/design-system.md` so new work is consistent by construction instead of by inspection.

## Principles

- **Consolidate, don't rebuild.** The token layer stays; we sharpen it. No mass rewrite of the 802
  inline styles — they migrate organically as files are touched.
- **Tokens are the single source of truth for UI chrome.** No bare hex/px in chrome, ever. The only
  sanctioned bare values are fixed *domain* data (tajweed rule colors, mushaf mark colors) — and
  even those get collected into named token groups so they aren't scattered literals.
- **Each tool at its altitude.** Atoms = CSS classes. Structural/stateful blocks = React
  primitives. Genuinely complex scoped styling = CSS Modules (token-valued). No tool deprecated.
- **The doc is the deliverable.** Code edits here are only what's needed to make the doc's canonical
  claims true.

## Decisions (locked in grill)

| # | Decision | Why |
|---|----------|-----|
| D1 | **Scope = reference doc + reconcile decisions.** No bulk migration of the 802 inline styles. | Highest leverage, matches the token layer's maturity; migration happens per-feature. |
| D2 | **Primary button keeps the green→teal gradient; add `--teal-600: #0D9488` to the raw scale.** `.btn-primary` gradient references `var(--green-600)`→`var(--teal-600)`, no bare hex. | Preserve the intended look; kill the off-scale literal. |
| D3 | **Define `--accent-contrast: #FFFFFF`** — the canonical text/icon color on any accent/solid fill. | Name already used as a fallback in ~8 files; defining it makes those correct with zero migration. |
| D4 | **Component boundary:** atoms (button/input/badge/card) = global CSS classes; structural/stateful blocks (PageHeader, SectionTitle, EmptyState, Toggle) = React primitives. Promote a tracker primitive to a shared `components/ui/` **only when it's first reused outside tracker**. | Names the split the code already has; no migration. Promotion is on-demand, not upfront. |
| D5 | **Collapse the radius scale to `sm 8 / md 12 / lg 16 / xl 20`, keeping `page 6` and `canvas 24` as named exceptions.** Drop raw `--radius-sm-px/btn-px/md-px/lg-px/max`; the semantic aliases hold the px values directly. `--radius-btn` usages move to `--radius-md`. | One coherent 4-step scale; two documented exceptions with a reason each. Small, bounded migration. |
| D6 | **CSS Modules remain sanctioned** for complex scoped styling; their internals must reference `var(--token)` — no bare hex/px. Audit the 3 existing files. | Deprecating them would force migration and fight D1. |
| D7 | **Token-bypass policy:** UI chrome = tokens only. Bare hex allowed **only** for fixed domain palettes, and those are collected into named token groups: `--tajweed-*` (8 rule colors + mark colors), `--home-*` (marketing/demo colors). | Even domain color stops being scattered literals; chrome has no exceptions. |

Non-goal: **dark mode.** The token indirection is the seam that would make it possible later; it is
not built here (`color-scheme: light` stays). No `@media (prefers-color-scheme)` work.

## Capability / flow resolution

This PRD produces one document and a bounded set of token edits. No new routes, no schema, no RLS,
no data flow. There is **no security surface** — no cross-user access, no trust boundary, no PII
path is touched. (Called out explicitly per the grill security requirement: nothing here changes
who can read or write anything.)

## Scope / work breakdown

1. **Token reconciliation** in `globals.css`: add `--teal-600`, `--accent-contrast`; repoint
   `.btn-primary` gradient to tokens; collapse the radius scale (D5); add the `--tajweed-*` and
   `--home-*` token groups (D7).
2. **Tokenize domain-palette literals**: move LegendModal's 8 rule colors + `MarkedPagesList` mark
   colors to `--tajweed-*`; move `HomeReaderDemo`/`page.tsx` demo colors to `--home-*`. Replace the
   ~8 `#fff`/`var(--accent-contrast, #fff)` chrome call sites with plain `var(--accent-contrast)`.
   Fix any `--radius-btn` consumers to `--radius-md`.
3. **CSS Modules audit**: scan the 3 `.module.css` files; replace any bare hex/px with tokens.
4. **The reference doc** `docs/design-system.md`: tokens (color/space/radius/type/shadow/motion),
   the component boundary rule (D4) with a usage table, the bypass policy (D7), and the resolved-
   contradictions table.

## Non-goals

- Migrating the 802 inline styles or the module.css files off their mechanism (only value hygiene).
- Dark mode / theming.
- New components, routes, schema, or RLS changes.
- Restyling any screen's visual design beyond the radius-scale value shift (D5) and the button
  gradient now reading from a token (visually identical).

## Security notes

None. No trust boundary, RLS policy, or data-access path is added, dropped, or widened. A validator
should confirm no `.sql` migration and no RLS change ships with this PRD.

## References

- Precedent token layer: `src/app/globals.css` (PRD 0002 "V3 knowledge workspace").
- Existing React primitives: `src/components/tracker/ui.tsx`.
- Domain palette: `src/components/LegendModal.tsx:50-57`.
- Contract: `0012-design-system-contract.md`.
- Build manifest: `0012-design-system-build.md`.
