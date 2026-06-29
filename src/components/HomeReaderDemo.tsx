/**
 * HomeReaderDemo — landing-page showcase framed as a mini reader window:
 * top bar + static surah panel (left) + two flush Mushaf pages pre-annotated with
 * the toolbar's marks (highlight / circle / underline) + a static notes panel (right).
 * Entirely static and decorative — no interaction, no Fabric, no auth.
 */

import Image from 'next/image';
import { ALL_TOOLS, TOOL_ICONS, TOOL_LABELS, PRESET_COLORS } from '@/lib/canvasTools';

const SURAHS = [
  { n: 1, name: 'Al-Fatihah', page: 1 },
  { n: 2, name: 'Al-Baqarah', page: 2 },
  { n: 3, name: 'Aal-i-Imran', page: 50 },
  { n: 4, name: "An-Nisa'", page: 77 },
  { n: 5, name: "Al-Ma'idah", page: 106 },
  { n: 6, name: "Al-An'am", page: 128 },
  { n: 7, name: "Al-A'raf", page: 151 },
];

const NOTES = [
  { c: '#22c55e', t: 'Waqf — pause on ٱلرَّحِيمِ' },
  { c: '#f97316', t: 'Revise ayah 6 tomorrow' },
  { c: '#3b82f6', t: 'Tajweed: madd in ٱلضَّآلِّينَ' },
];

// Active (highlighted) tool in the static toolbar.
const ACTIVE_TOOL = 'highlighter';

export default function HomeReaderDemo() {
  return (
    <div
      className="relative w-full overflow-hidden mx-auto"
      style={{
        maxWidth: 1060, borderRadius: 'var(--radius-canvas)',
        background: 'var(--surface-main)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-e3)',
      }}
    >
      {/* Top bar — 1fr | auto | 1fr grid so the page pill is centred regardless of the
          differing brand / avatar widths. */}
      <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span className="flex items-center justify-self-start" style={{ gap: 8 }}>
          <Image src="/logo.png" alt="" width={26} height={26} style={{ height: 26, width: 'auto' }} />
          <span className="font-bold hidden sm:inline" style={{ fontFamily: 'var(--font-brand), system-ui, sans-serif', fontSize: 15, letterSpacing: '-0.01em' }}>Hifth Companion</span>
        </span>
        <span className="inline-flex items-center justify-self-center" style={{ gap: 8, height: 32, padding: '0 13px', borderRadius: 'var(--radius-md-px)', border: '1px solid var(--neutral-200)', boxShadow: 'var(--shadow-e1)', fontSize: 12.5, color: 'var(--text-muted)' }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10.5 }}>Page</span>
          <span className="font-bold" style={{ color: 'var(--green-700)' }}>1</span>
          <span>/</span>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>604</span>
        </span>
        <span className="inline-flex items-center justify-center justify-self-end" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--green-soft)', color: 'var(--green-700)', fontSize: 12.5, fontWeight: 700 }}>A</span>
      </div>

      {/* Body — surah | workspace | notes */}
      <div className="flex items-stretch">
        {/* Surah panel (static) — hidden below md */}
        <aside className="hidden md:flex flex-col flex-shrink-0" style={{ width: 184, borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-main)' }} aria-hidden>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Surahs</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SURAHS.map((s) => {
              const active = s.n === 1;
              return (
                <li key={s.n} className="flex items-center" style={{ gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-md-px)', background: active ? 'var(--green-soft)' : 'transparent' }}>
                  <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 24, height: 24, borderRadius: 8, fontSize: 11, fontWeight: 700, background: active ? 'var(--green-600)' : 'var(--neutral-100)', color: active ? '#fff' : 'var(--text-muted)' }}>{s.n}</span>
                  <span className="flex flex-col" style={{ minWidth: 0 }}>
                    <span className="font-semibold truncate" style={{ fontSize: 13, color: active ? 'var(--green-700)' : 'var(--text-primary)' }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Page {s.page}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Workspace — toolbar + flush pages with pre-drawn annotations */}
        <div className="flex flex-col items-center flex-1 min-w-0" style={{ background: 'var(--surface-app)', padding: 'clamp(12px, 2.5vw, 22px)' }}>
          {/* Static toolbar (non-interactive) */}
          <div className="flex items-center overflow-x-auto thin-scroll" style={{ gap: 3, padding: 7, borderRadius: 'var(--radius-lg-px)', background: 'var(--surface-main)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-e2)', maxWidth: '100%', pointerEvents: 'none' }} aria-hidden>
            {ALL_TOOLS.map((t) => {
              const active = t === ACTIVE_TOOL;
              return (
                <span key={t} className="flex flex-col items-center justify-center shrink-0"
                  style={{ gap: 3, width: 50, height: 48, borderRadius: 'var(--radius-btn-px)', background: active ? 'var(--green-soft)' : 'transparent', color: active ? 'var(--text-accent)' : 'var(--text-muted)' }}>
                  <span className="flex items-center justify-center [&>svg]:!h-[18px] [&>svg]:!w-[18px]" style={{ width: 18, height: 18 }}>{TOOL_ICONS[t]}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1 }}>{TOOL_LABELS[t]}</span>
                </span>
              );
            })}
            <span aria-hidden style={{ width: 1, height: 30, background: 'var(--border-subtle)', margin: '0 3px', flexShrink: 0 }} />
            <span className="flex flex-col items-center justify-center shrink-0" style={{ gap: 3, width: 50, height: 48, color: 'var(--danger-500)' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              <span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1 }}>Clear</span>
            </span>
            <span aria-hidden style={{ width: 1, height: 30, background: 'var(--border-subtle)', margin: '0 3px', flexShrink: 0 }} />
            <span className="flex items-center shrink-0" style={{ gap: 7, paddingInline: 4 }}>
              {PRESET_COLORS.map((c, i) => (
                <span key={c.value} style={{ width: 19, height: 19, borderRadius: '50%', backgroundColor: c.value, border: i === 2 ? '2px solid var(--text-primary)' : '2px solid transparent', outline: i === 2 ? '2px solid var(--text-primary)' : 'none', outlineOffset: 2 }} />
              ))}
            </span>
          </div>

          {/* Two flush pages + pre-drawn annotation overlay (percentage-positioned). */}
          <div className="relative mt-4" style={{ width: 'fit-content', maxWidth: '100%', borderRadius: 'var(--radius-page)', overflow: 'hidden', boxShadow: 'var(--shadow-e2)' }}>
            <div className="flex items-stretch" style={{ gap: 0 }}>
              <Image src="/quran-pages/002.png" alt="" width={300} height={470} priority draggable={false} style={{ display: 'block', height: 'auto', width: 'clamp(140px, 30vw, 280px)' }} />
              <Image src="/quran-pages/001.png" alt="" width={300} height={470} priority draggable={false} style={{ display: 'block', height: 'auto', width: 'clamp(140px, 30vw, 280px)' }} />
            </div>

            {/* Annotations — decorative, pointer-events:none. Coords are % of the spread. */}
            <div className="absolute inset-0" aria-hidden style={{ pointerEvents: 'none' }}>
              {/* Highlighter over a line on the right (Fatihah) page */}
              <span style={{ position: 'absolute', left: '57%', top: '34.5%', width: '33%', height: '3.4%', background: 'rgba(34,197,94,0.32)', borderRadius: 3 }} />
              {/* Underline under a phrase on the right page */}
              <span style={{ position: 'absolute', left: '60%', top: '46.5%', width: '27%', height: 0, borderBottom: '2.5px solid #3b82f6', borderRadius: 2 }} />
              {/* Circle around an ayah marker on the right page */}
              <span style={{ position: 'absolute', left: '85.5%', top: '40%', width: 22, height: 22, border: '2.5px solid #ef4444', borderRadius: '50%' }} />
              {/* Highlighter on the left (Baqarah) page */}
              <span style={{ position: 'absolute', left: '13%', top: '40%', width: '30%', height: '3.4%', background: 'rgba(249,115,22,0.30)', borderRadius: 3 }} />
              {/* Pen tick on the left page */}
              <svg style={{ position: 'absolute', left: '8%', top: '38%', width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
            </div>
          </div>
        </div>

        {/* Notes panel (static) — hidden below md */}
        <aside className="hidden md:flex flex-col flex-shrink-0" style={{ width: 208, borderLeft: '1px solid var(--border-subtle)', background: 'var(--surface-main)' }} aria-hidden>
          <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Notes</span>
            <span className="inline-flex items-center" style={{ gap: 5, height: 24, padding: '0 9px', borderRadius: 'var(--radius-full)', background: 'var(--green-soft)', color: 'var(--green-700)', fontSize: 11, fontWeight: 700 }}>My Notes</span>
          </div>
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {NOTES.map((nt, i) => (
              <div key={i} className="flex items-start" style={{ gap: 9, padding: '10px 11px', borderRadius: 'var(--radius-md-px)', background: 'var(--surface-app)', border: '1px solid var(--border-subtle)' }}>
                <span className="flex-shrink-0" style={{ width: 9, height: 9, borderRadius: '50%', background: nt.c, marginTop: 5 }} />
                <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--text-secondary)' }}>{nt.t}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
