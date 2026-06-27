# ADR 0002 — Unified app chrome: global nav rail + profile menu

- Status: Accepted
- Date: 2026-06-27
- Deciders: Ahmed Hamad

## Context

The app had grown two halves with divergent chrome:

- **Reader** (`/reader`, `/share`) — `ReaderShell` with a desktop-only 72px
  icon **NavRail** (only "Surahs" functional; Bookmarks/Notes/Tags/Settings were
  inert placeholders) and a red **LogoutButton** in `ReaderNav`.
- **Tracker / Sets** (`/tracker*`, `/sets`) — `AppHeader` only (brand +
  breadcrumb + free-form `right` slot). No rail at all.

There was no consistent way to move between the two halves, and the logout
button was a bare action rather than the account menu users expect. The rail
also leaked a conceptual error: it mixed *section navigation* (Surahs → reader,
Halaqas → tracker) with *reader-only content types* (Bookmarks/Notes/Tags) that
can never apply on a tracker page.

## Decisions

### D1 — The rail is a global section switcher (app navbar)
The left rail is the single, app-wide navigation spine — like a website navbar,
not a reader-local tool. It appears on every page (desktop) with a mobile drawer
equivalent. The former Bookmarks/Notes/Tags were throwaway placeholders and are
removed; they may return later as *reader-local* sub-navigation, never as global
rail items.

### D2 — Sections are Surahs, Halaqas, Sets
Every rail item is a real destination:

| Item | Route | Active when path… |
|------|-------|-------------------|
| Surahs | `/reader/1` | starts `/reader` or `/share` |
| Halaqas | `/tracker` | starts `/tracker` |
| Sets | `/sets` | starts `/sets` |

No inert "coming soon" items in the rail. **Settings** is not a section — it
lives only in the profile menu (currently an inert placeholder there).

### D3 — The rail is the single source of section nav
Inline links that duplicate the rail are removed: the reader top-bar "My Sets"
pill, and the sets-page "Tracker" + back-to-reader links. Brand logo → home
(`/reader/1`) is kept as the conventional brand affordance.

### D4 — Chrome is auth-conditional, and `/share` joins it
One rule everywhere: **rail always shows; the profile menu shows when
authenticated, otherwise a Log In link.** This already matched `ReaderShell`'s
`account = null` path. `/share` (public shared-set view, soon collaboratively
editable) adopts the same chrome so a logged-in editor can navigate back to
their own sections, while a guest viewer sees the rail + Log In.

### D5 — Logout moves into a profile dropdown
The red `LogoutButton` is deleted. A `ProfileMenu` (avatar → dropdown) carries:
name + email header, language switcher, an inert Settings entry, and Log out.
Closes on outside-click / Escape.

### D6 — Remove the dark-mode theme toggle stub
Dark mode is not supported and not planned soon. The inert sun-icon theme toggle
placeholder in `ReaderNav` is removed (not merely hidden) to avoid signalling a
feature that does not exist.

### D7 — Keep reader's two mobile triggers distinct
On mobile the reader has a hamburger (left, near brand → section drawer
`MobileNavDrawer`) and the existing surah-list button (in the page navigator →
`MobileSurahDrawer`). They serve different jobs (app sections vs. surah jump) and
stay separate rather than merging into one busy drawer.

### D8 — Single auth fetch per render
`getMyChrome(user)` accepts the auth user the page already loaded, instead of
calling `supabase.auth.getUser()` a second time. One JWT validation per render.

## Components

- `NavRail.tsx` — exports `RAIL_ITEMS`, `isRailItemActive`; items are real
  `next/link`s; active state route-derived via `usePathname`.
- `MobileNavDrawer.tsx` — left slide-in mirroring the rail (shared item defs).
- `ProfileMenu.tsx` — avatar dropdown (replaces `LogoutButton`, now deleted).
- `AppShell.tsx` — chrome wrapper for non-reader pages (fixed rail + `AppHeader`
  + mobile drawer + profile menu).
- `AppHeader.tsx` — gains an `onOpenNav` mobile hamburger slot.
- `ReaderShell.tsx` / `ReaderNav.tsx` — take `account`, mount `MobileNavDrawer`,
  render `ProfileMenu`.
- `lib/services/profile.ts` — `getMyChrome(user)`.

## Consequences

- Consistent wayfinding across both apps; one place to reason about nav.
- Reader content tools (bookmarks/notes/tags) are now an explicitly *future,
  reader-local* concern, decoupled from global nav.
- `/share` chrome depends on auth state — guests never see account affordances.
- Removing dark-mode/theme + placeholders trims dead affordances from the UI.
