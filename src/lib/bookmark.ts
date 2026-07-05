// Bookmark ("default page") is per-mushaf and local to you. The own reader keeps
// the legacy global key; each shared set gets its own key, so a shared mushaf's
// bookmark persists independently and never leaks across mushafs.
export function pinStorageKey(basePath?: string): string {
  return !basePath || basePath === '/reader'
    ? 'pinnedSurahPage'
    : `pinnedSurahPage:${basePath}`;
}
