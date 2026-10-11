/** Routes that need a session; the proxy redirects, and ShellAuthGuard covers SW-served shells. */
export const PROTECTED_PATHS = ['/sets', '/reader', '/tracker', '/wird'];
export const isProtected = (pathname: string) => PROTECTED_PATHS.some((p) => pathname.startsWith(p));
