# PRD: Design Refresh — "Hifth Companion V3" workspace look

> Source of truth: the mockup at `docs/design/v3-mockup.png` plus the V3 UI spec the
> stakeholder supplied. This PRD translates that look-and-feel onto the **existing** reader
> codebase. It is a **presentation / restyle** effort — no data model, API, schema, auth,
> persistence, annotation, notes, sets, or share **contract** changes.

## Problem / Goal

The reader works but looks like a stack of rounded pills with weak hierarchy. The stakeholder
wants the app to look and feel like a premium knowledge workspace (Linear / Arc / Readwise /
Figma / Raycast), with the Quran page as the hero. We are matching the **mockup's visual
design**, not building its missing product features. Where the mockup shows a feature we do not
have (Bookmarks, Tags, Juz selector, Search, Theme toggle, Zoom, note categories, AI panels),
we render the **UI affordance as an inert / placeholder element** (visually present, clearly
non-functional, occupying its whitespace) — never a fake-working control and never a new
backend.

## Non-negotiable constraints (apply to EVERY story)

1. **Presentation only.** No changes to: Supabase schema, the `annotations` / `notes` /
   `annotation_sets` tables, API routes, auth, the save/load/debounce logic, the share URL
   contract, or the page-image source. If a story seems to need a data change, it is out of
   scope — stub the UI instead.
2. **Preserve behavior that already has tests / guards** (these are regression-sensitive and
   were hard-won — see ADR-0001 and PRD-0001):
   - First-click surah navigation; same-page surahs combine into one active button.
   - Soft page swap (Story 24): the Fabric canvas instance is **not** recreated on page change
     (`window.__hifthFabricCreatedCount` stays stable); only background + objects + notes swap.
   - Per-page contain-fit sizing (each of the 604 pages fits its container by its own native
     size; desktop fits height with no document scroll, mobile fits width and scrolls).
   - Active annotation set preserved across navigation (`?set=`), surah-panel scroll position
     restored across navigation.
   - Mobile Move/Draw mode (default Move lets a finger scroll over the image; the fabric
     wrapper gets `pointer-events:none`), fixed mobile chrome, and the nav not covering content
     (`--nav-h` measured from the real `<nav>`).
3. **Preserve all `data-testid` hooks**: `surah-panel`, `surah-scroll-list`,
   `mobile-surah-scroll-list`, `mobile-annotation-bar`. Add new testids rather than removing.
   Keep the E2E suite green: **44 desktop (chromium) + 14 mobile (Pixel 5)**. Update a selector
   only where the DOM genuinely changed, and say so in the story's report.
4. **Tokens first, then consume.** After the token story lands, components must read CSS
   variables — no new hard-coded hex, radius, or shadow values.
5. **No pills.** Global radius scale tops out at **20px**. The only exception is the Tags chips
   (`border-radius: 999px`), and nowhere else.

## Design tokens (target values from the spec)

- **Green:** primary `#0F8A67`, hover `#0D7A5B`, pressed `#0B694E`. Success `#10B981`,
  danger `#EF4444`, warning `#F59E0B`, blue `#3B82F6`, purple `#8B5CF6`.
- **Neutrals:** 950 `#0F172A`, 900 `#111827`, 800 `#1F2937`, 700 `#374151`, 600 `#4B5563`,
  500 `#6B7280`, 400 `#9CA3AF`, 300 `#D1D5DB`, 200 `#E5E7EB`, 100 `#F3F4F6`, 50 `#F8FAFC`.
- **Surfaces:** app background `#F7F8FA`, main surface `#FFFFFF`, workspace `#FCFCFD`,
  reader canvas `#F6F1D9`.
- **Radius:** sm 10, md 14, lg 18, max 20. **Shadows:** e1 `0 1px 2px rgba(0,0,0,.05)`,
  e2 `0 4px 16px rgba(0,0,0,.06)`, e3 `0 12px 32px rgba(0,0,0,.08)`.
- **Type:** Inter (fallback system-ui), letter-spacing `-0.02em`. Scale: XL 32/700,
  H-L 24/700, H-M 20/600, Body 14/500, Small 13/500, Caption 12/500, Meta 11/500.
- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. No arbitrary values.

## Model Routing

Each story is tagged `(Model: Opus)` or `(Model: Sonnet)`.

- **Opus** — structural or regression-sensitive: the 3-region shell restructure, the surah
  sidebar (carries scroll-restore + combine logic), the top-bar restructure (carries the
  page-jump / soft-swap nav), the horizontal toolbar (changes the canvas layout + page-fit and
  the desktop tests scoped to `aside`), and the reader-canvas frame (page-fit).
- **Sonnet** — mechanical / bounded: token definitions, icon-rail markup, placeholder controls,
  card restyles, chips, label/padding passes, and the verification pass.

**Self-check protocol — the implementing agent must run this before starting any story:**
1. Read the `(Model: …)` tag on the story.
2. Compare to the model you are running as.
3. Match → proceed. Mismatch → STOP and ask the user whether to swap models.

**Sequencing / dependencies:** Foundations (1–2) must land first; everything consumes the
tokens. Then shell (3–5) → top bar (6–8) → toolbar (9–10) → canvas (11–12) → context panel
(13–15) → mobile (16) → verification (17). The Sonnet styling stories assume their Opus
structural sibling has already landed.

---

## User Stories

### Foundations

1. As a developer, I want a single design-token layer (colors, neutrals, surfaces, radius,
   shadow, spacing, typography) so that every component restyles from one source and nothing is
   hard-coded. _(Model: Opus)_
   - **Where:** `src/app/globals.css` (`:root` custom properties) and the font setup in
     `src/app/layout.tsx`.
   - **Guidance:** Define CSS variables for the full palette and scales above (e.g.
     `--green-600`, `--neutral-200`, `--surface-app`, `--radius-md`, `--shadow-e2`,
     `--space-16`, plus the existing semantic aliases the code already uses such as
     `--accent-solid`, `--text-primary`, `--border-subtle` — **re-point** those aliases to the
     new palette rather than renaming them, so existing components shift automatically). Swap the
     font to **Inter** (`next/font/google`), keep the `--font-*` variables. Apply
     `letter-spacing: -0.02em` at the body level. Do **not** restyle components in this story —
     only define tokens and verify the app still builds and the suite is green (some colors will
     shift; that is expected and fine). Keep `data-canvas-ready`, shimmer keyframes, the
     `.mobile-nav-offset` / `.mobile-bar-offset` / `.page-display-frame` rules intact.

2. As a user, I want the app to sit on a soft neutral background with crisp white surfaces, so
   that the workspace feels calm and premium. _(Model: Sonnet)_
   - **Where:** `globals.css` body background, the reader root in `ReaderShell.tsx`, `/sets`,
     auth pages.
   - **Guidance:** Background `--surface-app` (`#F7F8FA`); cards/sidebars/panels white;
     workspace `#FCFCFD`. Apply the shadow + radius tokens. Pure CSS/className changes.

### App shell — three regions

3. As a desktop reader, I want a three-region workspace — a left navigation+surah sidebar, the
   centered Quran workspace, and a right context panel — so that content, tools, and admin are
   clearly separated. _(Model: Opus)_
   - **Where:** `src/components/ReaderShell.tsx` (the persistent layout shell that already owns
     the canvas), `src/app/reader/layout.tsx`.
   - **Guidance:** Desktop grid: icon rail `72px` + surah sidebar `260px` | flexible workspace |
     context panel `320px`, 24px gutters, against the `100dvh` fixed app-shell that already
     exists. The surah sidebar and context panel scroll internally; the workspace centers the
     canvas and does not scroll (preserve the current no-document-scroll behavior and
     `lg:overflow-hidden`). **Do not** remount or reparent `AnnotationCanvas` (soft-swap depends
     on it staying mounted in this shell). Mobile is unchanged here (handled in Story 16). Keep
     the `--nav-h` ResizeObserver (measuring the real `<nav>`).

4. As a user, I want a slim left icon rail (Surahs, Bookmarks, Notes, Tags, Settings) so the app
   feels like a workspace. _(Model: Sonnet)_
   - **Guidance:** 72px rail, 22px icons, active state = green left indicator + green icon +
     soft green background (`#ECFDF5`). **Only "Surahs" is functional** (the current view);
     Bookmarks / Notes / Tags / Settings are **inert placeholders** (rendered, `aria-disabled`,
     non-navigating, with a subtle "coming soon" affordance or simply no-op). New testid e.g.
     `nav-rail`. Desktop only (`lg:`); the mobile entry points stay as they are.

5. As a desktop reader, I want each surah row to show its number, title, subtitle, and page
   badge, with a clear selected state, so the list reads like a real index. _(Model: Opus)_
   - **Where:** `src/components/SurahNavPanel.tsx`.
   - **Guidance:** Row height ~72px: number, title (600 when selected), subtitle (e.g. English
     name / "The Opening"), right-aligned page badge. Selected: background `#ECFDF5`,
     `border-left: 4px solid var(--green-600)`. **Preserve** the grouping logic
     (`SURAH_FIRST_PAGES`, same-page combine), the `surah-scroll-list` testid + single scroll
     container, the sessionStorage scroll-restore, and first-click navigation. This is a restyle
     of the row markup only — do not touch the navigation/flush/scroll logic. Header reads
     "Surahs". An "Add to My Sets" affordance at the bottom may be an inert placeholder unless it
     maps to existing sets behavior.

### Top workspace bar

6. As a desktop reader, I want a single top workspace bar with the logo, a context selector, a
   centered page navigator, and my account controls, so navigation is calm and legible.
   _(Model: Opus)_
   - **Where:** `src/components/ReaderNav.tsx` + `ReaderNav.module.css`.
   - **Guidance:** 72px bar. Left: book icon + "Hifth Companion". Center: page navigator
     `‹ N / 604 ›`, ~220px, using the **existing** `go()` / clamp / `?set=`-preserving logic and
     the jump-to-page input — do not change navigation behavior, only its styling. Right: My Sets
     link, logout, and placeholders for Search and Theme (Stories 7–8). Keep the `lg:hidden`
     mobile surah button (it must stay hidden on desktop via the module media query) and all
     current page-nav `title`/`aria-label`s that tests rely on (`Next page`, `Previous page`,
     `Click to jump to page`, `Open surah list`).

7. As a reader, I want the top bar to show "Juz N › Surah" context instead of a bare label, so I
   always know where I am. _(Model: Sonnet)_
   - **Guidance:** Derive the current surah from the page (already available via the surah
     grouping). Show a `Juz N › <Surah>` breadcrumb. If a reliable page→Juz mapping does not
     already exist in `src/lib`, render the Juz part as a **static placeholder** ("Juz —") rather
     than inventing data. No dropdown behavior required (it may be a non-interactive label or an
     inert button).

8. As a reader, I want Search and Theme controls visible in the top bar so the layout matches the
   design, even though they are not wired yet. _(Model: Sonnet)_
   - **Guidance:** Render a search input/affordance and a theme toggle as **inert placeholders**
     (disabled or no-op; theme toggle does not implement dark mode — that is a future feature).
     They occupy their position as whitespace-friendly stubs. Mark clearly in code as
     placeholders.

### Annotation toolbar — horizontal

9. As a desktop reader, I want the annotation tools in a horizontal Figma-style bar above the
   page, so the tools feel professional and stop competing with the page. _(Model: Opus)_
   - **Where:** `src/components/AnnotationToolbar.tsx` and the desktop layout in
     `src/components/AnnotationCanvas.tsx` (currently a `72px | page | 72px` grid with a vertical
     toolbar).
   - **Guidance:** Replace the vertical desktop toolbar with a **horizontal** bar:
     Select · Pen · Highlighter · Text · Shapes · Eraser │ Undo · Redo │ color swatches. Bar
     height 88px, radius 18, white, shadow e2, placed above the reader canvas in the workspace
     column. **Restructure the canvas grid** so the page sits below the bar and still
     contain-fits. **Critical regressions to keep green:** the page-fit math reads the frame's
     live top offset (`measurePageOffset`) so it still works with the bar above; the desktop
     E2E asserts on the toolbar **scoped to `aside`** (e.g. `aside button[title="Undo"]`,
     `aside button[title="Red"]`) — keep the desktop toolbar as the single `<aside>` (or update
     those specs deliberately and report it). Tool actions, `window.__annotationTool`, and the
     hover popover must keep working. The **mobile** `MobileAnnotationBar` is unchanged here.

10. As a reader, I want the tool buttons and color swatches styled to the spec, so the bar looks
    crisp. _(Model: Sonnet)_
    - **Guidance:** Tool buttons 48×48, radius 12, 22px icon, 11px label, hover `#F3F4F6`,
      active `#ECFDF5`. Swatches circular 18px: red, orange, green, blue, purple, black.
      Restyle only; keep handlers + titles.

### Reader canvas

11. As a reader, I want the Quran page presented on a warm cream canvas with generous padding and
    a subtle shadow, so it reads like the hero of the page. _(Model: Opus)_
    - **Where:** `src/components/PageDisplayFrame.tsx`.
    - **Guidance:** Frame surface `#F6F1D9`, radius 24, padding 32, subtle shadow
      `0 8px 24px rgba(0,0,0,.05)`, page `object-fit: contain`, desktop max-height target ~700px.
      **Preserve** the per-page contain-fit sizing (the `size` prop drives width/height), the
      no-inline-maxHeight rule (mobile must not clip), the `data-canvas-ready` hook, and the
      always-mounted shimmer (Story 25 crash fix). Restyle the frame chrome only.

12. As a reader, I want zoom controls under the page (`[-] 100% [+]  Fit to width`), so the design
    matches — even though zoom is not wired yet. _(Model: Sonnet)_
    - **Guidance:** Render the control (white, radius 16, height 56, bottom-center) as an **inert
      placeholder** showing `100%` and a "Fit to width" affordance. Do **not** implement Fabric
      zoom in this story (zoom interacts with annotation coordinates and is risky); a real zoom
      can be a separate future Opus story. Keep it visually present.

### Right context panel

13. As a reader, I want a Notes card with a count, a full-width New Note button, and note cards
    that carry a colored category accent, so notes feel first-class. _(Model: Sonnet)_
    - **Where:** the notes panel components (`NotesPanel` and children).
    - **Guidance:** Panel width 320, vertical stack. Notes card header "Notes (count)". New Note
      button full-width, 48px, green outline. Note card: white, radius 16, 1px `#E5E7EB` border,
      a **left accent bar**, title, content, timestamp, actions. **Preserve** all existing notes
      behavior and data (create/read/list, `setId`/`pageNum`). The category color is **presentation
      only** — there is no category column; default the accent to green and treat
      Reflection/Tajweed/Memorization colors as a future enhancement (do not add a DB field).

14. As a reader, I want the Share control as its own card with a clear "Create Share Link" CTA, so
    sharing stops wasting space. _(Model: Sonnet)_
    - **Guidance:** Separate card: short description + full-width green "Create Share Link" button
      wired to the **existing** share flow (`ShareButton` / current share URL generation). Restyle
      only; the share contract is untouched.

15. As a reader, I want a Tags card with chips, so the panel matches the design. _(Model: Sonnet)_
    - **Guidance:** A Tags card with example chips (Opening, Reflection, Tajweed), `border-radius:
      999px` (the **only** place pills are allowed). Tags are **inert placeholders** (no tagging
      backend). Clearly a stub.

### Mobile

16. As a mobile reader, I want the new look applied to the phone layout without losing any of the
    current mobile behavior. _(Model: Sonnet)_
    - **Where:** `MobileAnnotationBar.tsx`, `MobileSurahDrawer.tsx`, mobile branches of
      `ReaderShell` / context panel.
    - **Guidance:** Re-skin to the new tokens: floating bottom toolbar with glass / 16px backdrop
      blur; notes and tags as bottom drawers; share as an action (not a always-visible card).
      **Preserve, verbatim in behavior:** Move/Draw mode (default Move, wrapper
      `pointer-events:none`), the compact toolbar that fits with no horizontal scroll, fixed top
      nav + fixed bottom bar, content padded clear of both (`--nav-h` / `mobile-bar-offset`), the
      surah drawer open/scroll-to-current/close, and the nav-not-covering-content fix. This is a
      restyle, not a re-architecture.

### Verification

17. As a maintainer, I want the E2E suite to keep protecting the reader through the redesign, so
    we ship the new look without regressions. _(Model: Sonnet)_
    - **Guidance:** After each structural story, run desktop (`chromium`, 44) + mobile
      (`mobile` Pixel 5, 14) projects and keep them green. Where the redesign legitimately moves
      DOM, update selectors minimally and preserve the **assertion intent** (do not weaken).
      Re-scope the toolbar selectors if the toolbar element changes (keep them pointed at the
      desktop toolbar, not the mobile bar). Add light structure assertions for the new shell
      (three regions present at desktop width; icon rail visible; context panel present). The 6
      canvas-draw tests are reliable now (`retries: 1`); do not reintroduce flakiness or the
      `PageDisplayFrame` mount crash.

---

## Implementation Decisions

- **One token layer, re-pointed aliases.** Story 1 redefines the palette and **re-points the
  existing semantic aliases** (`--accent-solid`, `--text-primary`, `--border-subtle`, etc.) so the
  current components shift to the new look automatically; later stories then refine specific
  components. This avoids a big-bang rewrite and keeps the suite green between stories.
- **The shell stays the layout authority.** `ReaderShell` already is the persistent `100dvh`
  flex/grid shell that owns the mounted canvas (so soft-swap survives). The redesign re-skins and
  re-columns it; it does **not** move the canvas out of the shell.
- **Horizontal toolbar is the one structural risk.** It changes the canvas grid and the desktop
  toolbar DOM that several E2E selectors target (`aside`-scoped). Keep the desktop toolbar a
  single `<aside>` (or update + report the specs), and re-verify page-fit after the bar moves
  above the page.
- **Missing features are inert UI, not stubs that lie.** Bookmarks, Tags, Search, Theme, Zoom,
  Juz mapping, note categories, and all "Future Features" are rendered as visually-present but
  non-functional placeholders. No new tables, routes, or fake data.
- **No data/contract changes.** Annotation, notes, sets, share, and auth all keep their current
  shapes and flows.

## Testing Decisions

- Keep the existing seams: desktop `chromium` (44) and mobile `mobile` Pixel 5 (14) Playwright
  projects, against the real app, asserting externally-observable layout/behavior (bounding
  boxes, scroll metrics, URL changes, visibility) — never internal component state.
- Preserve every regression guard listed in "Non-negotiable constraints": first-click nav,
  combine, soft-swap (`__hifthFabricCreatedCount`), per-page fit (canvas fills frame; desktop no
  scroll; mobile no clip), set/scroll preservation, Move/Draw gating, fixed mobile chrome, nav
  not covering content.
- Preserve / extend `data-testid`s; add ones for the new regions (`nav-rail`, context panel,
  horizontal toolbar) rather than renaming.

## Out of Scope (this redesign)

- Any new product feature behind the placeholders: Bookmarks, Tags, Search, Juz navigation,
  Theme/Dark mode, Zoom, note categories, AI panels, study sessions, analytics, sync, offline.
- Data model / API / schema / auth / persistence / share-contract changes.
- New annotation tools or canvas capabilities beyond restyling the existing ones.
- Tablet-specific layouts beyond the desktop/mobile split.

## Further Notes

- The mockup lives at `docs/design/v3-mockup.png`; this PRD plus that image are the source of
  truth. Decisions here do not contradict ADR-0001 (reader layout model) — they re-skin it.
- Recommended first three: Story 1 (tokens) → Story 3 (3-region shell) → Story 9 (horizontal
  toolbar), since they unblock the most downstream styling and carry the real risk.
