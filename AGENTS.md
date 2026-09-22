<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
`
# Project Instructions

## Development Workflow
- **Verify Build and Test:** After any code change, perform the following:
  1. `npx tsc --noEmit` (Type Check)
  2. `npm run build:check` (Build Verification)
  3. `npm run test` (Unit/Component Tests via Vitest)
  4. `npm run test:e2e` (E2E Tests via Playwright - mandatory for new features or route changes). Runs against a production build on port 3100. While iterating, run just the impact area: `npm run test:e2e:<area>`, where area is `annotations` | `reader` | `sets` | `tracker` | `wird` | `mobile`. Run the full suite before finishing. Only one e2e run at a time: runs share the port, the `.next` build and the server-side mock store.
- **Manual/Exploratory Verification:** For hands-on checking of the running app in a real browser (poking at a change, reproducing a bug, confirming a fix before writing the E2E), agents drive Chrome with **chrome-agent** (`chrome-agent launch` / `status` / `attach`). See `docs/tools/chrome-agent.md`. This is the preferred manual-testing tool; Playwright below remains the automated regression gate — chrome-agent does not replace `npm run test:e2e`.
- **High-Signal Testing Policy (MANDATORY):**
  - **Assert on Functionality:** E2E tests must verify the *outcome* of an action (e.g., "the drawing is restored"), not just the *presence* of a UI component.
  - **Strict Error Handling:** All E2E tests must explicitly listen for and fail on browser console errors (e.g., `page.on('console', msg => { if (msg.type() === 'error') throw new Error(msg.text()); });`).
  - **Regression Prevention:** Do not accept test failures, even if deemed "minor". The test suite must be green before the agent considers the task finalized.

Utilize ask_user where possible and try to close alignment gaps