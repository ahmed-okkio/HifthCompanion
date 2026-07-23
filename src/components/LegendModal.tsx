'use client';

/**
 * LegendModal — reference sheet for mushaf symbols.
 *
 * Three sections:
 *   1. Waqf (pause) marks — real Unicode codepoints from the Quranic Annotation
 *      block, rendered in the same Arabic face the mushaf uses.
 *   2. Tajweed colours — this mushaf's own scheme baked into the page PNGs.
 *      Swatches are hard-coded; there is no asset to extract from the images.
 *   3. Other marks — sajdah, madda, small-alef etc.
 *
 * Bilingual: every row carries EN + AR. The active locale picks the primary
 * (bold) line; the other language is the secondary line. In `ar` the dialog
 * flips to RTL.
 */

import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';
import type { Locale } from '@/lib/i18n/config';

const ARABIC = "'Noto Sans Arabic Web', serif";

type Glyph = { char: string; name: string; nameAr: string; meaning: string; meaningAr: string; standalone?: boolean };

// Arabic Quranic Annotation block — the standard waqf set. These are combining
// marks, so they render over a dotted-circle base (◌) to sit centred (see GlyphRow).
const WAQF: Glyph[] = [
  { char: 'ۘ', name: 'Mīm', nameAr: 'ميم', meaning: 'Waqf lāzim — compulsory stop', meaningAr: 'وقف لازم' },
  { char: 'ۖ', name: 'Ṣalā', nameAr: 'صلى', meaning: 'Preferable to continue', meaningAr: 'الوصل أولى' },
  { char: 'ۚ', name: 'Jīm', nameAr: 'جيم', meaning: 'Permissible stop', meaningAr: 'وقف جائز' },
  { char: 'ۙ', name: 'Lā', nameAr: 'لا', meaning: 'Do not stop (continue)', meaningAr: 'لا تقف' },
  { char: 'ۛ', name: 'Three dots', nameAr: 'المعانقة', meaning: "Mu'ānaqah — stop at one of the pair, not both", meaningAr: 'قف على أحد الموضعين لا كليهما' },
  { char: 'ۜ', name: 'Sīn', nameAr: 'سكتة', meaning: 'Saktah — brief pause without breath', meaningAr: 'سكتة لطيفة بدون تنفس' },
];

const OTHER: Glyph[] = [
  { char: '۩', name: 'Sajdah', nameAr: 'سجدة', meaning: 'Prostration of recitation', meaningAr: 'سجدة التلاوة', standalone: true },
  { char: 'ۤ', name: 'Madda', nameAr: 'مدّة', meaning: 'Elongation of the vowel', meaningAr: 'إطالة حركة المدّ' },
  { char: 'ٰ', name: 'Small alef', nameAr: 'ألف خنجرية', meaning: 'Dagger alef — long "ā" sound', meaningAr: 'تنطق ألفاً' },
  { char: 'ۦ', name: 'Small yā', nameAr: 'ياء صغيرة', meaning: 'Silent yā marker', meaningAr: 'ياء لا تُلفظ' },
];

// Tajweed swatch. `ar`/`arDesc` are the Arabic term + gloss; `en`/`enDesc` the English pair.
type Swatch = { color: string; name: string; ar: string; en: string; arDesc: string };

// Matches this mushaf's own legend (the two reference images). ponytail: hex values
// are sampled from the legend swatches — the necessary-prolongation red is still a guess.
const TAJWEED: Swatch[] = [
  { color: 'var(--tajweed-madd-lazim)', name: 'Necessary prolongation', ar: 'مدّ لزوماً', en: '6 vowels', arDesc: '٦ حركات' },
  { color: 'var(--tajweed-madd-wajib)', name: 'Obligatory prolongation', ar: 'مدّ واجب', en: '4 or 5 vowels', arDesc: '٤ أو ٥ حركات' },
  { color: 'var(--tajweed-madd-jaiz)', name: 'Permissible prolongation', ar: 'مدّ جوازاً', en: '2, 4 or 6 vowels', arDesc: '٢ أو ٤ أو ٦ حركات' },
  { color: 'var(--tajweed-madd-natural)', name: 'Natural prolongation', ar: 'مدّ حركتان', en: '2 vowels', arDesc: 'حركتان' },
  { color: 'var(--tajweed-tafkhim)', name: 'Tafkhīm', ar: 'تفخيم', en: 'emphatic (heavy) letter', arDesc: 'حرف مفخّم (ثقيل)' },
  { color: 'var(--tajweed-qalqalah)', name: 'Qalqalah', ar: 'قلقلة', en: 'echoing / bouncing sound', arDesc: 'صوت القلقلة المرتد' },
  { color: 'var(--tajweed-ikhfa-ghunnah)', name: 'Ikhfāʾ & Ghunnah', ar: 'إخفاء ومواقع الغُنّة', en: 'hiding & nasalization (2 vowels)', arDesc: 'إخفاء وغُنّة (حركتان)' },
  { color: 'var(--tajweed-idgham-silent)', name: 'Idghām & silent', ar: 'إدغام وما لا يُلفظ', en: 'merging & unpronounced', arDesc: 'إدغام وحرف لا يُلفظ' },
];

/** Two-line label: bold primary + muted secondary. Each line's dir/font follow its own
 *  language and it's bidi-isolated, so an Arabic term inside an English line (or vice
 *  versa) keeps its own run and never reorders the rest. */
function Label({ primary, secondary, primaryAr, secondaryAr }: { primary: string; secondary: string; primaryAr: boolean; secondaryAr: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        dir={primaryAr ? 'rtl' : 'ltr'}
        style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', fontFamily: primaryAr ? ARABIC : undefined, unicodeBidi: 'isolate' }}
      >
        {primary}
      </div>
      <div
        dir={secondaryAr ? 'rtl' : 'ltr'}
        style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: secondaryAr ? ARABIC : undefined, unicodeBidi: 'isolate' }}
      >
        {secondary}
      </div>
    </div>
  );
}

function GlyphRow({ g, locale }: { g: Glyph; locale: Locale }) {
  const ar = locale === 'ar';
  return (
    <div style={rowStyle}>
      <span style={{ fontFamily: ARABIC, fontSize: 26, lineHeight: 1, width: 48, textAlign: 'center', color: 'var(--text-primary)', flexShrink: 0 }}>
        {/* combining marks attach to the dotted-circle base so they render centred, not floating */}
        {g.standalone ? g.char : `◌${g.char}`}
      </span>
      <Label
        primary={ar ? g.nameAr : g.name}
        secondary={ar ? g.meaningAr : g.meaning}
        primaryAr={ar}
        secondaryAr={ar}
      />
    </div>
  );
}

function SwatchRow({ s, locale }: { s: Swatch; locale: Locale }) {
  const ar = locale === 'ar';
  return (
    <div style={rowStyle}>
      <span style={{ width: 48, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: s.color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }} />
      </span>
      {/* AR: Arabic term + Arabic gloss. EN: English name + Arabic term — English gloss. */}
      <Label
        primary={ar ? s.ar : s.name}
        secondary={ar ? s.arDesc : `${s.ar} — ${s.en}`}
        primaryAr={ar}
        secondaryAr={ar}
      />
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 4px',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '24px 4px 12px' }}>
      {children}
    </h3>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '2px 20px' }}>
      {children}
    </div>
  );
}

export default function LegendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('reader.symbolGuide')}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-main)',
          borderRadius: 'var(--radius-lg, 14px)',
          boxShadow: 'var(--shadow-e3, 0 20px 60px rgba(0,0,0,0.3))',
          width: 'min(860px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden', // clips inner scroller so all 4 corners stay rounded (Firefox scrollbar fix)
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 12px', flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('reader.symbolGuide')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('share.close')}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, lineHeight: 0 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="thin-scroll" style={{ overflowY: 'auto', padding: '0 24px 28px' }}>
          <SectionTitle>{t('legend.waqf')}</SectionTitle>
          <Grid>{WAQF.map(g => <GlyphRow key={g.char} g={g} locale={locale} />)}</Grid>

          <SectionTitle>{t('legend.tajweed')}</SectionTitle>
          <Grid>{TAJWEED.map(s => <SwatchRow key={s.name} s={s} locale={locale} />)}</Grid>

          <SectionTitle>{t('legend.other')}</SectionTitle>
          <Grid>{OTHER.map(g => <GlyphRow key={g.char} g={g} locale={locale} />)}</Grid>
        </div>
      </div>
    </div>
  );
}

/** Floating pill button (matches ZoomControl styling) that opens the legend. */
export function LegendButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t('reader.symbolGuide')}
        title={t('reader.symbolGuide')}
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center justify-center gap-2"
        style={{
          marginTop: 'var(--space-12)',
          height: '52px',
          padding: '0 var(--space-16)',
          background: 'var(--surface-main)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(15, 23, 42, 0.05)',
          boxShadow: 'var(--shadow-e2)',
          cursor: 'pointer',
          color: 'var(--neutral-600)',
          fontSize: '13px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-main)'; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {t('reader.symbolGuide')}
      </button>
      <LegendModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
