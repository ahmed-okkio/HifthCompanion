# HifthCompanion — Domain Glossary

## Core Concepts

**Page**
A single page of the Mushaf (1–604). The atomic unit of reading and annotation. A Page has an image (fetched from QuranHub CDN) and may have Annotations and Notes associated with it in a given Set.

**Set** (aka Annotation Set)
A named, user-owned collection of Annotations and Notes across any number of Pages. A User may have many Sets. A Set is the unit of sharing — a Share Link grants read-only access to one Set.

**Annotation**
The Fabric.js canvas state for one Page within one Set. Stores drawing strokes, highlights, shapes, and text as serialized JSON. One Set has at most one Annotation per Page.

**Note**
A freeform text entry attached to a specific Page within a Set. Notes have optional x/y coordinates (positional), but positioning is not required.

**Tool**
A drawing mode the user selects on the canvas (pen, highlighter, circle, underline, text, eraser). Tools are UI state only — not persisted.

**Share Link**
A read-only URL exposing one Set for one User's pages to any visitor without auth. Already implemented at `/share/[userId]/[page]`.

## Roles (incoming — not yet implemented)

**Student**
A user who reads, annotates, and takes Notes. The current app assumes everyone is a Student.

**Teacher**
Creates Sets and assigns them to Students. Can view Student annotations. Owns the canonical version of a Set in a collaborative context.

**Admin**
Manages users, roles, and platform content.

**Collaborator**
A second user annotating the same Set. Conflict model: last-write-wins (decided — see ADR).

**Guest**
Unauthenticated visitor with a Share Link. Read-only. No account required.

## Settled Decisions

- Collaboration conflict model: **last-write-wins** (async, simple, no real-time sync needed for v1 of collab)
- Scale target: **more features + roles**, not raw traffic optimization
- AnnotationCanvas split: **by concern** — ToolbarPanel, CanvasLayer, AnnotationHistory + shared hook
- Testing strategy: **logic-first unit tests + lean E2E** — extract pure business logic, test that; E2E covers 3–5 critical paths only; retire MockSupabaseClient
