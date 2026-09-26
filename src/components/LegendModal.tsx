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

const ARABIC = "font-arabic";

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
    <div className="min-w-0">
      <div
        dir={primaryAr ? 'rtl' : 'ltr'}
        className={`text-body font-semibold text-primary [unicode-bidi:isolate] ${primaryAr ? ARABIC : ''}`}
      >
        {primary}
      </div>
      <div
        dir={secondaryAr ? 'rtl' : 'ltr'}
        className={`text-small text-secondary [unicode-bidi:isolate] ${secondaryAr ? ARABIC : ''}`}
      >
        {secondary}
      </div>
    </div>
  );
}

function GlyphRow({ g, locale }: { g: Glyph; locale: Locale }) {
  const ar = locale === 'ar';
  return (
    <div className={rowCls}>
      <span className={`w-12 shrink-0 text-center text-2xl leading-none text-primary ${ARABIC}`}>
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
    <div className={rowCls}>
      <span className="flex w-12 shrink-0 justify-center">
        <span
          className="h-5.5 w-5.5 rounded-full ring-1 ring-inset ring-default"
          // eslint-disable-next-line shadcn/no-inline-styles -- per-row tajweed colour from data
          style={{ background: s.color }}
        />
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

const rowCls = 'flex items-center gap-3 px-1 py-2';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mx-1 mb-3 mt-6 text-caption font-semibold uppercase tracking-label text-muted">
      {children}
    </h3>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-5 gap-y-0.5">
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
      className="fixed inset-0 z-100 flex items-center justify-center bg-overlay p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        // overflow-hidden clips inner scroller so all 4 corners stay rounded (Firefox scrollbar fix)
        className="flex max-h-[85vh] w-[min(860px,100%)] flex-col overflow-hidden rounded-xl bg-surface-main shadow-e3"
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-5">
          <h2 className="m-0 text-heading-m font-bold text-primary">{t('reader.symbolGuide')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('share.close')}
            className="btn btn-ghost btn-icon"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="thin-scroll overflow-y-auto px-6 pb-7">
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
        className="mt-3 hidden h-13 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-subtle bg-surface-main px-4 text-small font-medium text-neutral-600 shadow-e2 hover:bg-neutral-100 lg:flex"
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
