# Quran Annotator — Product Requirements Document

## Kanban Workflow
Agents must update the status of each User Story as they work.
- `[TODO]` - Not started
- `[IN PROGRESS]` - Actively being worked on
- `[COMPLETE]` - Done and verified

## Vision
A web app where users can read the Tajweed Quran, draw and annotate pages, organise annotations into named sets, and share read-only views via simple page-based URLs. Built for web-first with mobile app as a future phase.

## Tech Stack
- **Frontend:** Next.js (App Router)
- **Backend/Auth/DB:** Supabase (Postgres + Auth + Storage)
- **Canvas:** Fabric.js or Konva.js (annotation layer over page images)
- **Content:** QuranHub/quran-pages-images (604 page images + ayah location JSON, open source)
- **Hosting:** Vercel

---

## Data Model (Reference)

```
users           → managed by Supabase Auth
annotation_sets → id, user_id, name, created_at
pages           → page_number (1–604), image_url (static asset)
annotations     → id, set_id, page_number, canvas_json (Fabric.js state), updated_at
notes           → id, annotation_id, page_number, x, y, body, created_at
```

---

## User Stories — Vertical Slices

Each slice is independently deployable and testable.

---

### Slice 1 — Static Quran Reader [COMPLETE]
**Goal:** Users can navigate and read Quran pages with no auth.>

- Serve 604 Tajweed page images from Supabase Storage or public CDN
- `/reader/[page]` route renders the page image full-width
- Previous / Next page buttons
- Jump-to-page input
- Page number shown in UI and URL

**Done when:** Any visitor can browse all 604 pages by URL.

### Slice 2 — Auth (Sign Up / Login / Logout) [COMPLETE]
**Goal:** Users can create accounts and stay logged in.

- Email + password sign up with Supabase Auth
- Email verification flow
- Login page
- Logout button
- Redirect unauthenticated users away from protected routes
- Persist session with Supabase client

**Done when:** A user can register, verify email, log in, and log out.

### Slice 3 — Annotation Sets (CRUD) [COMPLETE]
**Goal:** Logged-in users can create and manage named annotation sets.

- "My Sets" page listing all sets for the current user
- Create set (name input)
- Rename set
- Delete set (with confirmation)
- Sets stored in `annotation_sets` table scoped to `user_id`

**Done when:** A user can create, rename, and delete annotation sets.

### Slice 4 — Canvas Annotation Layer [COMPLETE]
**Goal:** Users can draw on a Quran page within a selected set.

- Canvas overlay rendered on top of page image at `/reader/[page]`
- Active annotation set selectable from a dropdown in the toolbar
- Load existing `canvas_json` for (set, page) on mount
- Auto-save canvas state to `annotations` table on change (debounced)
- Toolbar: freehand pen tool (default)

**Done when:** A user can draw on a page, navigate away, return, and see their drawing restored.

### Slice 5 — Highlighter Tool [COMPLETE]
**Goal:** Users can highlight text areas on a page.

- Highlighter tool added to toolbar (semi-transparent filled rectangle)
- Colour picker with preset colours (yellow, green, blue, red, orange)
- Opacity control for highlighter
- Toolbar button switches between pen and highlighter modes

**Done when:** A user can drag to highlight a region with a chosen colour.

### Slice 6 — Shapes Tool [COMPLETE]
**Goal:** Users can draw circles and underlines on a page.

- Circle tool: click-drag to place ellipse
- Underline tool: click-drag to draw a horizontal line
- Both use the active colour from the colour picker
- Tools accessible from toolbar

**Done when:** A user can add circles and underlines to a page annotation.

### Slice 7 — Text Annotations [COMPLETE]
**Goal:** Users can add typed text labels on a page.

- Text tool in toolbar
- Click on canvas to place a text box at that position
- Inline text editing (Fabric.js IText or equivalent)
- Font size and colour respect active toolbar settings
- Text saved as part of `canvas_json`

**Done when:** A user can place, edit, and save text labels on a page.

### Slice 8 — Notes / Comments on Selections [COMPLETE]
**Goal:** Users can attach a written note to a specific canvas selection.

- Select an existing annotation object (shape, highlight, pen stroke)
- "Add note" button appears in context toolbar
- Side panel opens with a text area for the note body
- Note saved to `notes` table linked to `annotation_id`, `page_number`, `x`, `y`
- Notes shown in a collapsible side panel listing all notes for the current page

**Done when:** A user can attach a note to a marking and read it back in the side panel.

### Slice 9 — Read-Only Share Links [COMPLETE]
**Goal:** Users can share a page with their annotations as a read-only link.

- "Share" button on reader page
- Generates URL: `/share/[username]/[page]?set=[set_id]`
- Share view renders the page image + canvas in read-only mode (no toolbar)
- No auth required to view a share link
- Canvas interaction (pan/zoom) still works; drawing is disabled

**Done when:** An unauthenticated visitor can open a share link and see the sharer's annotations.

### Slice 10 — Toolbar UX Polish [COMPLETE]
**Goal:** Toolbar is intuitive and non-intrusive on the reader.

- Collapsible/expandable toolbar (minimise icon)
- Active tool highlighted
- Undo / Redo buttons (Fabric.js history)
- Eraser tool
- Clear page button (with confirmation)
- Toolbar state persisted in localStorage

**Done when:** A user can undo strokes, erase, and collapse the toolbar without losing work.

---

## Out of Scope (v1)
- Collaborative real-time editing
- Bookmarks per ayah (next phase)
- Mobile app
- Audio recitation
- Social/follow features
- Multiple users editing the same set

---

## Content Asset Setup (Pre-dev Task)
Clone `QuranHub/quran-pages-images`, upload 604 Tajweed images to Supabase Storage, set public bucket policy, generate a `pages` seed file mapping `page_number → image_url`. This is a one-time setup step that all slices depend on.
