// PRD 0016 C5: copy complete prerendered route documents to public/_shell/{buildId}/{locale}/
// for the service worker to serve cache-first. Fails the build if a listed route is still
// postponed (its HTML would be an open document waiting for a resume).
import { readFileSync, rmSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Visible route -> prerendered file under .next/server/app/{locale}/. Extend per converted route.
const ROUTES = { '/wird': 'wird', '/wird/manage': 'wird/manage' };
const LOCALES = ['en', 'ar'];

const app = '.next/server/app';
const buildId = readFileSync('.next/BUILD_ID', 'utf8').trim();
rmSync('public/_shell', { recursive: true, force: true });
const out = join('public/_shell', buildId);
const assets = {}; // "{locale}/{file}.html" -> /_next/static URLs that shell boots with

for (const locale of LOCALES) {
  for (const file of Object.values(ROUTES)) {
    const src = join(app, locale, file);
    const meta = JSON.parse(readFileSync(`${src}.meta`, 'utf8'));
    const html = readFileSync(`${src}.html`, 'utf8');
    if (meta.postponed || !html.trimEnd().endsWith('</html>')) {
      console.error(`build-shells: ${locale}/${file} is postponed, not a complete static shell`);
      process.exit(1);
    }
    const dest = join(out, locale, `${file}.html`);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(`${src}.html`, dest);
    // Skew: the shell must boot with its own build's chunks, so the SW precaches these with it.
    assets[`${locale}/${file}.html`] = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)].map((m) => m[0]))];
  }
}

const routes = Object.fromEntries(Object.entries(ROUTES).map(([r, f]) => [r, `${f}.html`]));
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ buildId, locales: LOCALES, routes, assets }));
console.log(`build-shells: ${Object.keys(routes).length} routes x ${LOCALES.length} locales, ${new Set(Object.values(assets).flat()).size} assets -> ${out}`);
