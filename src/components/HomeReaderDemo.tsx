/**
 * HomeReaderDemo — landing-page showcase framed as a mini reader window:
 * top bar + static surah panel (left) + two flush Mushaf pages pre-annotated with
 * the toolbar's marks (highlight / circle / underline) + a static notes panel (right).
 * Entirely static and decorative — no interaction, no Fabric, no auth.
 */

import Image from 'next/image';
import { ALL_TOOLS, TOOL_ICONS, PRESET_COLORS } from '@/lib/canvasTools';
import { getPageImageUrl, getSurahName } from '@/lib/quran';
import { getLocale } from '@/lib/i18n/server';
import { localizeDigits } from '@/lib/i18n/config';
import { getDictionary, type MessageKey } from '@/lib/i18n/dictionaries';

// Surah names resolve through getSurahName(locale); only page/number are local.
const SURAHS = [
  { n: 1, page: 1 },
  { n: 2, page: 2 },
  { n: 3, page: 50 },
  { n: 4, page: 77 },
  { n: 5, page: 106 },
  { n: 6, page: 128 },
  { n: 7, page: 151 },
];

const NOTE_KEYS = [
  { c: 'var(--home-note-green)', key: 'home.demoNote1' as const },
  { c: 'var(--home-note-orange)', key: 'home.demoNote2' as const },
  { c: 'var(--home-note-blue)', key: 'home.demoNote3' as const },
];

// Active (highlighted) tool in the static toolbar.
const ACTIVE_TOOL = 'highlighter';

export default async function HomeReaderDemo() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  return (
    <div
      className="relative w-full overflow-hidden mx-auto max-w-265 rounded-canvas bg-surface-main border border-subtle shadow-e3"
    >
      {/* Top bar — 1fr | auto | 1fr grid so the page pill is centred regardless of the
          differing brand / avatar widths. */}
      <div className="grid items-center grid-cols-[1fr_auto_1fr] px-4 py-2 border-b border-subtle">
        <span className="flex items-center justify-self-start gap-2">
          <Image src="/logo.png" alt="" width={26} height={26} className="h-6.5 w-auto" />
          <span className="font-bold hidden sm:inline font-[family-name:var(--font-brand),system-ui,sans-serif] text-body tracking-[-0.01em]">Hifth Companion</span>
        </span>
        <span className="inline-flex items-center justify-self-center gap-2 h-8 px-3 rounded-md border border-neutral-200 shadow-e1 text-small text-muted">
          <span className="uppercase tracking-wider text-micro">{dict['home.page']}</span>
          <span className="font-bold text-green-700">1</span>
          <span>/</span>
          <span className="font-bold text-primary">604</span>
        </span>
        <span className="inline-flex items-center justify-center justify-self-end size-7.5 rounded-full bg-green-soft text-green-700 text-small font-bold">A</span>
      </div>

      {/* Body — surah | workspace | notes */}
      <div className="flex items-stretch">
        {/* Surah panel (static) — hidden below md */}
        <aside className="hidden md:flex flex-col flex-shrink-0 w-46 border-e border-subtle bg-surface-main" aria-hidden>
          <div className="px-3 py-3 border-b border-subtle text-caption font-bold uppercase tracking-wider text-muted">{dict['home.surahs']}</div>
          <ul className="list-none m-0 p-2 flex flex-col gap-1">
            {SURAHS.map((s) => {
              const active = s.n === 1;
              return (
                <li key={s.n} className={`flex items-center gap-2 px-2 py-2 rounded-md ${active ? 'bg-green-soft' : 'bg-transparent'}`}>
                  <span className={`inline-flex items-center justify-center flex-shrink-0 size-6 rounded-sm text-meta font-bold ${active ? 'bg-green-600 text-accent-contrast' : 'bg-neutral-100 text-muted'}`}>{localizeDigits(s.n, locale)}</span>
                  <span className="flex flex-col min-w-0">
                    <span className={`font-semibold truncate text-small ${active ? 'text-green-700' : 'text-primary'}`}>{getSurahName(s.n, locale)}</span>
                    <span className="text-meta text-muted">{dict['home.page']} {localizeDigits(s.page, locale)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Workspace — toolbar + flush pages with pre-drawn annotations */}
        <div className="flex flex-col items-center flex-1 min-w-0 bg-surface-app p-[clamp(12px,2.5vw,22px)]">
          {/* Static toolbar (non-interactive) */}
          <div className="flex items-center overflow-x-auto thin-scroll gap-1 p-2 rounded-lg bg-surface-main border border-subtle shadow-e2 max-w-full pointer-events-none" aria-hidden>
            {ALL_TOOLS.map((t) => {
              const active = t === ACTIVE_TOOL;
              return (
                <span key={t} className={`flex flex-col items-center justify-center shrink-0 gap-1 w-12.5 h-12 rounded-md ${active ? 'bg-green-soft text-green-600' : 'bg-transparent text-muted'}`}>
                  <span className="flex items-center justify-center [&>svg]:!h-4.5 [&>svg]:!w-4.5 size-4.5">{TOOL_ICONS[t]}</span>
                  <span className="text-micro font-semibold leading-none">{dict[`tool.${t}` as MessageKey]}</span>
                </span>
              );
            })}
            <span aria-hidden className="w-px h-7.5 bg-subtle mx-1 shrink-0" />
            <span className="flex flex-col items-center justify-center shrink-0 gap-1 w-12.5 h-12 text-[var(--danger-500)]">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              <span className="text-micro font-semibold leading-none">{dict['home.clear']}</span>
            </span>
            <span aria-hidden className="w-px h-7.5 bg-subtle mx-1 shrink-0" />
            <span className="flex items-center shrink-0 gap-2 px-1">
              {PRESET_COLORS.map((c, i) => (
                <span key={c.value} className={`size-4.75 rounded-full border-2 ${i === 2 ? 'border-primary outline-2 outline-offset-2 outline-primary' : 'border-transparent'}`}
                  // eslint-disable-next-line shadcn/no-inline-styles -- swatch colour from data
                  style={{ backgroundColor: c.value }} />
              ))}
            </span>
          </div>

          {/* Two flush pages + pre-drawn annotation overlay (percentage-positioned). */}
          <div className="relative mt-4 w-fit max-w-full rounded-page overflow-hidden shadow-e2">
            <div className="flex items-stretch gap-0">
              <Image src={getPageImageUrl(2)} alt="" width={300} height={470} priority draggable={false} className="block h-auto w-[clamp(140px,30vw,280px)]" />
              <Image src={getPageImageUrl(1)} alt="" width={300} height={470} priority draggable={false} className="block h-auto w-[clamp(140px,30vw,280px)]" />
            </div>

            {/* Annotations — decorative, pointer-events:none. Coords are % of the spread. */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              {/* Highlighter over a line on the right (Fatihah) page */}
              {/* eslint-disable-next-line shadcn/no-inline-styles -- %-coords on the page spread */}
              <span className="absolute rounded-sm bg-[rgba(34,197,94,0.32)]" style={{ left: '57%', top: '32.5%', width: '33%', height: '3.2%' }} />
              {/* Circle around an ayah marker on the last line of the right page */}
              {/* eslint-disable-next-line shadcn/no-inline-styles -- %-coords on the page spread */}
              <span className="absolute size-5 rounded-full border-[2.5px] border-[var(--home-marker)]" style={{ left: '80%', top: '58%' }} />
              {/* Highlighter on the left (Baqarah) page */}
              {/* eslint-disable-next-line shadcn/no-inline-styles -- %-coords on the page spread */}
              <span className="absolute rounded-sm bg-[rgba(249,115,22,0.30)]" style={{ left: '13%', top: '40%', width: '30%', height: '3.4%' }} />
              {/* Pen tick on the left page */}
              {/* eslint-disable-next-line shadcn/no-inline-styles -- %-coords on the page spread */}
              <svg className="absolute size-4.5" style={{ left: '8%', top: '38%' }} viewBox="0 0 24 24" fill="none" stroke="var(--home-note-green)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
            </div>
          </div>
        </div>

        {/* Notes panel (static) — hidden below md */}
        <aside className="hidden md:flex flex-col flex-shrink-0 w-52 border-s border-subtle bg-surface-main" aria-hidden>
          <div className="flex items-center justify-between px-3 py-3 border-b border-subtle">
            <span className="text-caption font-bold uppercase tracking-wider text-muted">{dict['home.notes']}</span>
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-green-soft text-green-700 text-meta font-bold">{dict['home.myNotes']}</span>
          </div>
          <div className="p-2 flex flex-col gap-2">
            {NOTE_KEYS.map((nt, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-md bg-surface-app border border-subtle">
                <span className="flex-shrink-0 size-2 rounded-full mt-1"
                  // eslint-disable-next-line shadcn/no-inline-styles -- note colour from data
                  style={{ background: nt.c }} />
                <span className="text-small leading-[1.4] text-secondary">{dict[nt.key]}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
