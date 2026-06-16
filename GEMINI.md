# Project Instructions

## Development Workflow
- **Always run type checking after code changes:** Use `npx tsc --noEmit` to verify type safety.
- **Verify Build and Test:** After any code change, perform the following:
  1. `npx tsc --noEmit` (Type Check)
  2. `npm run build:check` (Build Verification)
  3. `npm run test` (Unit/Component Tests via Vitest)
  4. `npm run test:e2e` (E2E Tests via Playwright - mandatory for new features or route changes)
- **High-Signal Testing Policy (MANDATORY):**
  - **Assert on Functionality:** E2E tests must verify the *outcome* of an action (e.g., "the drawing is restored"), not just the *presence* of a UI component.
  - **Strict Error Handling:** All E2E tests must explicitly listen for and fail on browser console errors (e.g., `page.on('console', msg => { if (msg.type() === 'error') throw new Error(msg.text()); });`).
  - **Regression Prevention:** Do not accept test failures, even if deemed "minor". The test suite must be green before the agent considers the task finalized.

Utilize ask_user where possible and try to close alignment gaps