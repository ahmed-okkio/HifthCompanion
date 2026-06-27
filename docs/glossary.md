# Glossary

Shared vocabulary for HifthCompanion. Keep terms here when a word carries a
specific, load-bearing meaning in the code or product.

## Navigation & chrome

- **Chrome** — the persistent app frame around page content: the nav rail, top
  header, and profile menu. Distinct from page content.
- **Rail / NavRail** — the slim left icon column. The app's *global section
  switcher* (see **Section**). Desktop only; its mobile equivalent is the
  **Nav drawer**. (ADR 0002 D1)
- **Section** — a top-level destination in the rail. The sections are
  **Surahs** (`/reader`), **Halaqas** (`/tracker`), **Sets** (`/sets`).
  Settings is *not* a section. (ADR 0002 D2)
- **Nav drawer / MobileNavDrawer** — the `< lg` left slide-in listing the same
  sections as the rail.
- **Surah drawer / MobileSurahDrawer** — the reader's mobile surah-jump sheet.
  Separate from the Nav drawer. (ADR 0002 D7)
- **Profile menu / ProfileMenu** — the avatar dropdown (name + email, language,
  Settings, Log out). Shown only when authenticated. Replaced the old
  LogoutButton. (ADR 0002 D5)
- **AppShell** — chrome wrapper for non-reader pages (tracker, sets, share).
- **ReaderShell** — the reader's dedicated fixed-viewport layout (ADR 0001).
- **Auth-conditional chrome** — rule that the rail always renders, but the
  profile menu renders only for an authenticated user; otherwise a Log In link.
  (ADR 0002 D4)

## Domain (tracker) — see ADR / PRD for detail

- **Halaqah** (pl. **Halaqat**) — a teacher-led memorization study circle. The
  rail label **Halaqas** is the user-facing English plural for this section.
- **Set / Annotation set** — a named collection of a user's Quran page
  annotations. Surfaced as the **Sets** section.
- **Share view** — `/share/[userId]/[page]`, a view of another user's
  annotation set; becoming collaboratively editable.
