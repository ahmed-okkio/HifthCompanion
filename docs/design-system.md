# Hifth Companion — Design System

This is the design system for Hifth Companion. Every design token lives in
[`src/app/globals.css`](../src/app/globals.css) — that file is the **single source of
truth**; this page documents what it contains and the rules for using it. For the
rationale behind each decision (why the button gradient was tokenized, why the radius
scale collapsed, why domain colors got their own groups), see the PRD:
[`docs/prd/0012-design-system.md`](prd/0012-design-system.md). This is a practical
reference for the next feature — read it before styling anything.

---

## 1. Tokens

All tokens are CSS custom properties defined in `:root` in `globals.css`. Two layers:
**raw scales** (the only place hex/px values live) and **semantic aliases** (the names
components consume, re-pointed at the raw scale). Consume the semantic name where one
exists.

### Color

**Brand / accent**

| Token | Value | Use |
|-------|-------|-----|
| `--green-600` | `#0F8A67` | primary brand green (`--accent`, `--accent-solid`, `--text-accent`) |
| `--green-700` | `#0D7A5B` | hover (`--accent-hover`) |
| `--green-800` | `#0B694E` | pressed |
| `--teal-600` | `#0D9488` | `.btn-primary` gradient second stop |
| `--green-soft` | `#ECFDF5` | soft green background (active states) |

**Status**

| Token | Value |
|-------|-------|
| `--success` | `#10B981` |
| `--danger-500` | `#EF4444` (alias `--danger`) |
| `--warning` | `#F59E0B` |
| `--blue-500` | `#3B82F6` |
| `--purple-500` | `#8B5CF6` |

**Neutrals** — `--neutral-950 #0F172A`, `-900 #111827`, `-800 #1F2937`, `-700 #374151`,
`-600 #4B5563`, `-500 #6B7280`, `-400 #9CA3AF`, `-300 #D1D5DB`, `-200 #E5E7EB`,
`-100 #F3F4F6`, `-50 #F8FAFC`.

**Surfaces**

| Token | Value | Use |
|-------|-------|-----|
| `--surface-app` | `#F7F8FA` | app background |
| `--surface-main` | `#FFFFFF` | main / cards / panels |
| `--surface-workspace` | `#FCFCFD` | workspace column |
| `--surface-canvas` | `#F6F1D9` | reader cream canvas |

**Text**

| Token | Points at |
|-------|-----------|
| `--text-primary` | `--neutral-900` |
| `--text-secondary` | `--neutral-600` |
| `--text-muted` | `--neutral-500` |
| `--text-accent` | `--green-600` |
| `--accent-contrast` | `#FFFFFF` — text/icon color on any accent/solid fill |

**Borders**

| Token | Points at |
|-------|-----------|
| `--border-subtle` | `--neutral-200` |
| `--border-default` | `--neutral-300` |
| `--border-strong` | `--neutral-400` |
| `--border-accent` | `rgba(15,138,103,0.18)` |

**Domain palettes** — fixed data colors, *not* chrome. The color carries meaning, so it
does not re-theme. Collected into named groups instead of scattered literals.

- `--tajweed-*` (8 recitation-rule colors): `--tajweed-madd-lazim #a51d24`,
  `--tajweed-madd-wajib #e80589`, `--tajweed-madd-jaiz #d58310`,
  `--tajweed-madd-natural #c4a94d`, `--tajweed-tafkhim #06868d`,
  `--tajweed-qalqalah #14afcd`, `--tajweed-ikhfa-ghunnah #04a650`,
  `--tajweed-idgham-silent #9a9a95`. Mushaf mark colors alias into the same group:
  `--mark-orange` → `--warning`, `--mark-red` → `--danger-500`.
- `--home-*` (marketing/demo colors, landing page + reader demo only — deliberately off
  the app accent scale to read as illustrative): `--home-note-green #22c55e`,
  `--home-note-orange #f97316`, `--home-note-blue #3b82f6`, `--home-gold #C9A24B`,
  `--home-marker #ef4444`.

### Spacing

`--space-4 4px`, `-8 8px`, `-12 12px`, `-16 16px`, `-20 20px`, `-24 24px`, `-32 32px`,
`-40 40px`, `-48 48px`, `-64 64px`.

### Radius

Collapsed 4-step scale (no pills except circles):

| Token | Value |
|-------|-------|
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-xl` | `20px` |

**Named exceptions** (both tokenized so no bare off-scale literal lives in component code):

- `--radius-page` `6px` — page-image corners, kept small/sharp per design feedback.
- `--radius-canvas` `24px` — the reader hero frame only; a deliberate exception above the
  20px global max, sanctioned for that single frame.

`--radius-full` `9999px` — circles only (badges/pills, avatars).

### Type scale

Each entry is a size + weight pair (`--type-<name>-size` / `--type-<name>-weight`):

| Name | Size | Weight |
|------|------|--------|
| `xl` | 32px | 700 |
| `heading-l` | 24px | 700 |
| `heading-m` | 20px | 600 |
| `body` | 14px | 500 |
| `small` | 13px | 500 |
| `caption` | 12px | 500 |
| `meta` | 11px | 500 |

### Shadow / elevation

Raw elevation scale: `--shadow-e1 0 1px 2px rgba(0,0,0,.05)`,
`--shadow-e2 0 4px 16px rgba(0,0,0,.06)`, `--shadow-e3 0 12px 32px rgba(0,0,0,.08)`.

Semantic aliases: `--shadow-sm` → e1, `--shadow-md` → e2, `--shadow-lg` → e3.
`--shadow-panel` (`e1, e2`) — symmetric floating-panel shadow for fixed/sticky surfaces.

### Motion

- `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)`
- `--duration-fast` `150ms`, `--duration-normal` `250ms`, `--duration-slow` `400ms`

---

## 2. Component boundary

Three styling mechanisms, each at its own altitude. Pick by what you're building:

| Need | Use | Example |
|------|-----|---------|
| Atom (button / input / badge / card) | Global CSS class in `globals.css` | `.btn` `.btn-primary` `.btn-ghost` `.btn-outline` `.input` `.badge` `.card` |
| Structural / stateful block | React primitive (currently `src/components/tracker/ui.tsx`) | `PageHeader`, `SectionTitle`, `EmptyState`, `Toggle` |
| Genuinely complex scoped styling | Token-valued CSS Module | `ReaderNav`, `ShareShell`, reader page `.module.css` |

Rules:

- Atoms are global classes — do not re-implement a button as a component.
- CSS Module internals must reference `var(--token)` — no bare hex/px inside them either.
- **Promotion rule:** a tracker primitive moves to a shared `src/components/ui/` **only
  when it is first reused outside tracker** — on demand, not upfront.

---

## 3. Token-bypass policy

UI chrome uses **tokens only** — never bare hex or px. The only sanctioned bare values
are fixed **domain palettes**, and even those are collected into named token groups
(`--tajweed-*`, `--home-*`) rather than scattered literals. Chrome has no exceptions.

The one documented non-chrome hex: `themeColor` in `layout.tsx` (the Next.js manifest),
which is metadata consumed outside the CSS token layer.

---

## 4. Resolved contradictions

From the audit (PRD 0012); see the PRD for full context.

| Contradiction found | Decision |
|---------------------|----------|
| `.btn-primary` gradient used a bare off-scale `#0d9488` | Tokenized as `--teal-600`; gradient reads `var(--green-600)` → `var(--teal-600)` |
| No "on-accent" token — ~8 files invented a `#fff` fallback | Defined `--accent-contrast: #FFFFFF` |
| Radius sprawl (7 tokens + stray arbitrary values) | Collapsed to 4 (`sm/md/lg/xl`) + 2 named exceptions (`page 6`, `canvas 24`) |
| Three styling mechanisms with no stated boundary | Component boundary rule (§2) with usage table + promotion rule |
| Scattered domain-palette hex (tajweed, marks, demo) | Collected into `--tajweed-*` and `--home-*` token groups |

---

## 5. Non-goals

- **Dark mode is not built.** `color-scheme: light` stays; there is no
  `@media (prefers-color-scheme)` work. The token indirection (semantic aliases pointing
  at raw scales) is the seam that would make dark mode possible later — a dark theme would
  re-point the aliases, no component changes — but that is future work, not shipped here.
- No bulk migration of the existing inline `style={{}}` uses; they migrate per-feature as
  files are touched.
