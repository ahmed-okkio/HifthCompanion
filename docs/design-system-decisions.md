# Design system unification — decisions log

Branch `chore/design-system`. Each entry: what drifted, what won, why, where. Veto any entry and it can be
reverted by its commit. Rules themselves live in [design-system.md](design-system.md).

## Tooling

- **@shadcn/lint** (ESLint plugin) added. It works without shadcn/ui. Our atoms are global classes, so
  `no-restyle` (component contracts) has little to guard; the value is in `no-arbitrary-values`,
  `no-raw-colors`, `no-unknown-classes`, `no-inline-styles`, `require-static-classes`.
- **Atoms moved into `@layer components`.** They were unlayered, so `.btn { display: inline-flex }` beat
  Tailwind utilities such as `lg:hidden`, which forced wrapper `<span>`s. Now utilities override atoms, as
  Tailwind intends. Side effect: any utility on an atom that was silently losing now applies.

## Buttons (commits `9e18e9a`, `2327d3f`)

| Topic | Before | Decision | Why |
|---|---|---|---|
| Form | `.btn` classes plus about 90 inline overrides | Keep global classes (design-system.md §2), with no `<Button>` component | Decided by the user; least churn |
| Sizes | Heights 30/32/34/36/38/40/44, text 10–13px | `.btn-xs` 28 · `.btn-sm` 32 · default 40 · `.btn-lg` 44 · `.btn-tall` 52 | Decided by the user |
| Default `.btn` | `padding: 8px 16px` (about 34px tall) | `min-height: 40px; padding: 0 16px` | The md step of the scale. **Visible:** default buttons get about 6px taller |
| Icon-only | 32/38/40px, several with no hover, ZoomControl hover done in JS | `.btn .btn-ghost .btn-icon` (40px, `.btn-sm` for 32px) | Decided by the user |
| Selected state | green-soft vs accent-muted vs accent fill | Tool toggles use `--accent-muted`; chips use `--accent-solid` fill | Decided by the user |
| JS hover handlers | ZoomControl, AnnotationToolbar, SurahNavPanel rows, LegendModal/SpreadToggle | CSS `:hover` / Tailwind `hover:` | Less code, and works with the keyboard as well |

**Left bespoke on purpose:** canvas tools in MobileAnnotationBar, nav arrows, the wird create FAB, colour
swatches, juz tiles, whole-row clickables, avatar triggers, and the tracker underline tabs (the tracker's own
tab primitive). The SurahNavPanel tabs don't use `SegmentedControl`, because that component only offers
`aria-pressed` and switching would lose the tablist semantics.

**Visible changes to check:** the remove-sub ✕ in the tracker grows from 22px to 32px and loses its red
hover; MobileSurahDrawer close loses its border and white background; the surah/time listbox options shrink
from 34px/13px to 32px/12px.

## Open questions (deferred)

- A `.menu-item` class to replace the JS hover in ProfileMenu and WirdPager menus.
- A `.btn-dashed` class for the tracker "+ add" empty-slot button.
- Should NavRail/MobileNavDrawer active rows move from green-soft to accent-muted? Kept for now, since they
  are navigation rather than tool toggles.
