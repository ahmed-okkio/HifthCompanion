import { describe, it, expect } from 'vitest';
import { shouldRedirect } from '@/components/ShellAuthGuard';

describe('ShellAuthGuard.shouldRedirect (PRD 0016 E8)', () => {
  it('redirects a signed-out user (no session, no stored token)', () => {
    expect(shouldRedirect(false, '')).toBe(true);
    expect(shouldRedirect(false, 'locale=ar; x-e2e-test=true')).toBe(true);
  });
  it('keeps a user whose stored session failed to refresh (flaky network)', () => {
    expect(shouldRedirect(false, 'locale=ar; sb-abcd-auth-token=base64-xyz')).toBe(false);
    expect(shouldRedirect(false, 'sb-abcd-auth-token.0=part')).toBe(false);
  });
  it('never redirects with a session', () => {
    expect(shouldRedirect(true, '')).toBe(false);
  });
});
