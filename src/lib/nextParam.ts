/**
 * Sanitize a post-auth `?next=` redirect target. Only same-origin absolute
 * paths are allowed — anything else (external URL, protocol-relative `//host`)
 * falls back, so the param can't be used as an open redirect.
 */
export function safeNext(next: string | null | undefined, fallback = '/reader'): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return fallback;
}
