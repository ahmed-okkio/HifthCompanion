import Link from 'next/link';

/**
 * The app wordmark — logo + "Hifth Companion" in the brand font. Single source
 * of truth so every top bar (ReaderNav, AppHeader) renders an identical,
 * identically-sized brand. Links to the reader home.
 *
 * Plain <img> from /public on purpose (next/image optimizer failed to render
 * the logo on Vercel).
 */
export default function Brand() {
  return (
    <Link href="/reader/1" className="flex items-center gap-3 min-w-0" style={{ textDecoration: 'none', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Hifth Companion logo" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
      <span
        className="whitespace-nowrap"
        style={{
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-brand), system-ui, sans-serif',
          fontSize: '1.2rem',
          fontWeight: 400,
          letterSpacing: '0.01em',
        }}
      >
        Hifth Companion
      </span>
    </Link>
  );
}
