// PRD 0016 D2/D4: copy each PPR route's build-time shell HTML + postponedState into public/_shell/
// so the SW can precache them. Source: .next/server/app/{locale}/{route}.html + .meta (JSON, `postponed`).
import fs from 'node:fs';

const ROUTES = ['wird']; // ponytail: /wird only for the Phase 2 spike; Phase 4 generates the full list.
const LOCALES = ['en', 'ar'];
const buildId = fs.readFileSync('.next/BUILD_ID', 'utf8').trim();
// Vercel skew protection pins requests to a deployment via this id (?dpl= / x-deployment-id).
const dpl = process.env.VERCEL_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID || '';
const out = 'public/_shell';
fs.rmSync(out, { recursive: true, force: true });
const shells = {};
for (const locale of LOCALES) {
  for (const route of ROUTES) {
    const base = `.next/server/app/${locale}/${route}`;
    const meta = JSON.parse(fs.readFileSync(`${base}.meta`, 'utf8'));
    if (!meta.postponed) throw new Error(`${base}: not a PPR route (no postponed state)`);
    fs.mkdirSync(`${out}/${buildId}/${locale}`, { recursive: true });
    fs.copyFileSync(`${base}.html`, `${out}/${buildId}/${locale}/${route}.html`);
    fs.writeFileSync(`${out}/${buildId}/${locale}/${route}.postponed`, meta.postponed);
    shells[`/${route}`] = true;
  }
}
fs.writeFileSync(`${out}/manifest.json`, JSON.stringify({ buildId, dpl, locales: LOCALES, routes: Object.keys(shells) }));
console.log(`shells: ${Object.keys(shells).join(', ')} x ${LOCALES.join('/')} (build ${buildId}, dpl ${dpl || 'none'})`);
