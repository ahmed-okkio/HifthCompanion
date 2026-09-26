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

## Other atoms (commit `a96360a`, consolidated in `e63ca58`)

| Pattern | Before | Decision |
|---|---|---|
| Menu rows | JS `onMouseEnter` hover in ProfileMenu and the WirdPager options menu | New `.menu-item` / `.menu-item-danger` atoms with CSS hover |
| "+ add" empty slot | Tracker `dashedAdd` with a JS hover | New `.btn-dashed` atom |
| Inputs | 13 inline copies of `.input`, plus bare `<select>`/`<textarea>` | `.input` / `.input-sm` everywhere |
| Pills | Hand-rolled `radius-full` pills, and 999/9999 radius values | `.badge`; `rounded-full` |
| Cards | `.card` plus padding values of 12×14, 14×16 or 16×18 | `.card p-4`; compact rows use `px-4 py-3` |
| Scrims | `rgba(15,23,42,.45)` in some places, `rgba(0,0,0,.4)` in others | `--overlay` token (`bg-overlay`) |
| Modals | Mixed radius (lg/xl) and padding | Modal: `rounded-xl` + `shadow-e3` + `p-6`. Bottom sheet: the same with the top corners rounded only. Popover: `rounded-md` + `shadow-e2` |
| Empty states | Hand-rolled dashed boxes | The `EmptyState` look, with padding 32×24 and small text |
| Skeletons | Hand-written shimmer gradients | `.skeleton` atom using `--skeleton-base` / `--skeleton-shine` |

## Tokens and the Tailwind bridge (commits `0929013`, `f26c04a`)

Tokens are now available as Tailwind utilities through `@theme inline`: `bg-surface-main`, `text-muted`,
`border-subtle`, `shadow-e1..3`, `text-caption`, `animate-fade-in`, `max-w-shell` and so on. The full table is
in design-system.md. The new tokens are:

- Overlays and layering: `--overlay`, `--z-sticky`, `--z-popover`, `--z-overlay`
- Type: `--type-micro-size` (10px, allowed for dense chips), `--tracking-label`
- Colours: `--neutral-hover`, `--success-muted`, `--warning-muted`
- Skeletons: `--skeleton-base`, `--skeleton-shine`
- Shadows: `--shadow-accent`, `--shadow-page`, `--shadow-edge`, `--shadow-float`
- Motion and layout: `--ease-sheet`, `--container-shell`, `--aspect-page`

Snapping rules: spacing snaps to the 4px scale. Font sizes snap to type roles (15/16→14, 17/18→20, 22→24,
12.5→13, 9/9.5→10). Radius, shadow and colour literals snap to tokens.

**Revived:** the `animate-fade-in` and `animate-fade-in-scale` classes had produced no CSS since the "Halqas"
commit. They work again, so about 20 screens now fade in as originally designed. The same applies to
`thin-scroll`, which had been deleted.

## Inline-style migration (commit `e63ca58`)

Design-lint warnings went from 3,268 to 0. Of those, 3,535 were `no-inline-styles` warnings, and every static
`style={{}}` is now a token class. The inline styles that remain are all computed at runtime, and each carries
an `eslint-disable-next-line shadcn/no-inline-styles -- <reason>` comment:

- Canvas, badge and popup coordinates
- The zoom/pan transform and the pager/drawer transforms
- Progress percentages and heatmap colours
- Colours the user picks or that come from data
- `viewTransitionName`
- The page size PageDisplayFrame measures at runtime
- Two sites that e2e selects by inline style: the MobileSurahDrawer `transform` and the MobileAnnotationBar
  `space-around`

**Tech debt:** those two e2e selectors should be switched to `data-testid`.

## Lint (commit `13a2cfc`)

All six `@shadcn/lint` rules are now **errors**, and `src` has 0 violations. `no-arbitrary-values` allow-lists
layout geometry that has no token (`calc()`, `clamp()`, `min()`, vh/vw, grid tracks, `%` offsets, `ch`
widths, CSS-var arbitrary properties, clip-path, stagger delays). See `eslint.config.mjs`.

**Note:** `npm run lint` still exits non-zero because of pre-existing `react-hooks/*` and
`@typescript-eslint/no-explicit-any` errors, which master has too. So lint isn't yet a clean CI gate. Fixing
those is outside this branch's scope.

## Visual review (commit `70ac9b0`)

Master and this branch were compared screen by screen at desktop and mobile widths, plus Arabic (RTL), using
mock data. The before/after screenshots are in `docs/design-review/`. That folder is untracked (9 MB) and
excluded from git through `.git/info/exclude`.

**Regressions fixed:**
- Tracker tab bar: the active tab had a full green border. It's back to a bottom border only.
- Wird heatmap cells had become circles. They are back to 2px radius.
- The mobile annotation bar had lost its floating shadow. It now uses the new `--shadow-float` token.

**Intended changes to look at:**
- The settings juz card has less padding and a smaller heading.
- The surah panel close button is borderless, and the active row uses accent-muted.
- Spacing and type are tighter in the wird form, the legend modal and the sets cards. The heatmap gap goes
  from 3px to 4px.
- The pen tool chevron is bigger. The colour-dot ring changed from dark red to grey.
- Default buttons are about 6px taller (40px), and a few card heights moved by a few px.

**Unchecked:** the mobile Colors popover.

## Open questions and deferred issues

- **Active nav rows:** should the NavRail and MobileNavDrawer active rows move from green-soft to
  accent-muted? I kept green-soft because these are navigation, not tool toggles.
- **Tracker tab underline:** the active tab's underline is invisible on both master and this branch. This is
  a pre-existing bug.
- **Mobile overlaps:** the settings gear overlaps the New wird modal, and the "Sets" text shows through the
  Move button on the mobile bar. Both are pre-existing, and both also happen on master.
- **Tabs:** the SurahNavPanel tabs don't use `SegmentedControl`, because that would lose the tablist
  semantics. Adding a `role="tablist"` mode to `SegmentedControl` would let them share it.
- **`no-restyle`:** this rule guards only imported components (NumberStepper, SegmentedControl). The class
  atoms (`.btn` etc.) can't be contract-checked. That trade-off comes from keeping global-class atoms.
- **Subagent effort:** the `opus-low` agent definition (`~/.claude/agents/opus-low.md`) was not picked up
  mid-session, so every subagent ran on Opus 5.5 at the default effort. Restart the session to load it.
