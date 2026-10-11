// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';

// PRD 0016 F3: public/sw.js run against fake CacheStorage + fetch. Covers the shell lookup
// (D3), the cache allowlist (D6 [SEC]: nothing credentialed or HTML-from-network is stored) and
// the old-build purge (D5).
const ORIGIN = 'https://app.test';
const BUILD = 'b2';
const src = readFileSync('public/sw.js', 'utf8');

type Ev = { request?: Request; respondWith?: (p: Promise<Response>) => void; waitUntil: (p: Promise<unknown>) => void };
let caches: Map<string, Map<string, Response>>;
let handlers: Record<string, (e: Ev) => void>;
let fetched: string[];
let offline = false;

const key = (r: Request | string) => new URL(typeof r === 'string' ? r : r.url, ORIGIN).href;
function open(name: string) {
  if (!caches.has(name)) caches.set(name, new Map());
  const c = caches.get(name)!;
  return {
    match: async (r: Request | string) => c.get(key(r))?.clone(),
    put: async (r: Request | string, res: Response) => { c.set(key(r), res); },
    add: async (r: Request | string) => { c.set(key(r), await fakeFetch(r)); },
    keys: async () => [...c.keys()].map((u) => new Request(u)),
  };
}
async function fakeFetch(r: Request | string) {
  if (offline) throw new TypeError('offline');
  fetched.push(key(r));
  return new Response(`net:${key(r)}`, { headers: { 'content-type': 'text/html' } });
}

function boot() {
  caches = new Map();
  handlers = {};
  fetched = [];
  offline = false;
  const self = {
    location: { href: `${ORIGIN}/sw.js?v=${BUILD}`, origin: ORIGIN },
    addEventListener: (t: string, h: (e: Ev) => void) => { handlers[t] = h; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    registration: {},
  };
  const cs = {
    open: async (n: string) => open(n),
    keys: async () => [...caches.keys()],
    delete: async (n: string) => caches.delete(n),
    match: async (r: Request | string) => {
      for (const c of caches.values()) { const hit = c.get(key(r)); if (hit) return hit.clone(); }
    },
  };
  new Function('self', 'caches', 'fetch', src)(self, cs, fakeFetch);
}

async function dispatch(type: string, request?: Request) {
  let waited: Promise<unknown> = Promise.resolve();
  let res: Promise<Response> | undefined;
  handlers[type]({ request, respondWith: (p) => { res = p; }, waitUntil: (p) => { waited = p; } });
  await waited;
  return res && (await res);
}
const nav = (path: string) => ({ method: 'GET', url: `${ORIGIN}${path}`, mode: 'navigate', credentials: 'include' }) as unknown as Request;
const stored = () => [...caches.entries()].flatMap(([n, c]) => [...c.keys()].map((u) => `${n} ${u.replace(ORIGIN, '')}`));

describe('service worker caches (PRD 0016 D3, D5, D6, F3)', () => {
  beforeEach(() => {
    boot();
    const shell = open(`hc-shell-${BUILD}`);
    shell.put(`/_shell/${BUILD}/manifest.json`, new Response(JSON.stringify({ routes: { '/wird': 'wird.html', '/reader/:page': 'reader/view.html' } })));
    shell.put(`/_shell/${BUILD}/en/wird.html`, new Response('shell:wird'));
    shell.put(`/_shell/${BUILD}/en/reader/view.html`, new Response('shell:reader'));
    shell.put('/offline.html', new Response('offline'));
  });

  it('answers a shell route from this build\'s shell without the network (D3)', async () => {
    expect(await (await dispatch('fetch', nav('/wird/')))!.text()).toBe('shell:wird');
    expect(await (await dispatch('fetch', nav('/reader/9')))!.text()).toBe('shell:reader');
    expect(fetched).toEqual([]);
  });

  it('never stores a credentialed navigation or API response (D6)', async () => {
    const before = stored();
    expect(await (await dispatch('fetch', nav('/onboarding')))!.text()).toBe(`net:${ORIGIN}/onboarding`);
    expect(await dispatch('fetch', new Request(`${ORIGIN}/api/me`))).toBeUndefined(); // not intercepted
    expect(await dispatch('fetch', new Request(`${ORIGIN}/wird`, { method: 'POST' }))).toBeUndefined();
    expect(await dispatch('fetch', new Request('https://other.test/x.js'))).toBeUndefined();
    expect(stored()).toEqual(before);
  });

  it('stores only /_next/static and Mushaf images (D6)', async () => {
    await dispatch('fetch', new Request(`${ORIGIN}/_next/static/chunks/a.js`));
    await dispatch('fetch', new Request('https://x.supabase.co/storage/v1/object/public/tajweed-pages/12.png'));
    expect(stored()).toContain(`hc-static-v1 /_next/static/chunks/a.js`);
    expect(stored()).toContain('hc-pages-v1 https://x.supabase.co/storage/v1/object/public/tajweed-pages/12.png');
  });

  it('falls back to /offline.html for an unmapped route when the network fails (D4)', async () => {
    offline = true;
    expect(await (await dispatch('fetch', nav('/onboarding')))!.text()).toBe('offline');
  });

  it('activate deletes every older hc-shell-* cache and keeps the allowlist (D5)', async () => {
    for (const n of ['hc-shell-old', 'hc-shell-b1', 'hc-pages-v1', 'hc-static-v1', 'hc-locale', 'stray']) open(n);
    await dispatch('activate');
    expect([...caches.keys()].sort()).toEqual(['hc-locale', 'hc-pages-v1', `hc-shell-${BUILD}`, 'hc-static-v1']);
  });
});
