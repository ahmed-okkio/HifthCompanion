import Image from 'next/image';
import Link from 'next/link';
import HomeReaderDemo from '@/components/HomeReaderDemo';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function generateMetadata() {
  const dict = getDictionary(await getLocale());
  return { title: dict['home.metaTitle'] };
}

export default async function Home() {
  const dict = getDictionary(await getLocale());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Logged in → splash has nothing to offer; go straight to My Mushaf.
  if (user) redirect('/reader');
  return (
    <main
      className="relative min-h-[100dvh] flex flex-col items-center overflow-hidden"
      style={{ background: 'var(--surface-app)', color: 'var(--text-primary)' }}
    >
      {/* Aurora background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="home-aurora-a absolute"
          style={{
            top: '-12%', left: '-8%', width: 560, height: 560, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(15,138,103,0.22), transparent 65%)',
            filter: 'blur(40px)', animation: 'home-aurora 18s ease-in-out infinite',
          }}
        />
        <div
          className="home-aurora-b absolute"
          style={{
            top: '8%', right: '-12%', width: 620, height: 620, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,175,110,0.20), transparent 65%)',
            filter: 'blur(48px)', animation: 'home-aurora 22s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--border-subtle), transparent)' }}
        />
      </div>

      {/* Hero */}
      <section className="relative w-full max-w-[1120px] px-6 pt-16 pb-12 sm:pt-24 flex flex-col items-center text-center">
        {/* Logo — the high-res mark, crisp, no backdrop. */}
        <Image src="/logo.png" alt="HifthCompanion" width={112} height={112} priority className="home-rise" style={{ width: 'clamp(84px, 16vw, 112px)', height: 'auto', marginBottom: 14 }} />

        <span
          className="home-rise inline-flex items-center gap-2 mb-6"
          style={{
            padding: '6px 14px', borderRadius: 'var(--radius-full)',
            background: 'var(--surface-main)', border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-e1)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}
        >
          {dict['home.tagline']}
        </span>

        <h1
          className="home-rise font-bold"
          style={{
            fontFamily: 'var(--font-brand), system-ui, sans-serif',
            fontSize: 'clamp(2.5rem, 7vw, 4.25rem)', lineHeight: 1.05, letterSpacing: '-0.03em',
            animationDelay: '0.05s',
          }}
        >
          {dict['home.heroTitlePrefix']}{' '}
          <span
            style={{
              background: 'linear-gradient(120deg, var(--green-600), #C9A24B)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}
          >
            {dict['home.heroTitleMushaf']}
          </span>
          <br />{dict['home.heroTitleSuffix']}
        </h1>

        <p
          className="home-rise mt-6 max-w-[34ch] sm:max-w-[50ch]"
          style={{ color: 'var(--text-secondary)', fontSize: 'clamp(1.05rem, 2.4vw, 1.3rem)', lineHeight: 1.55, animationDelay: '0.1s' }}
        >
          {dict['home.heroSubtitle']}
        </p>

        <div
          className="home-rise mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto"
          style={{ animationDelay: '0.15s' }}
        >
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 font-bold transition-transform hover:-translate-y-0.5"
            style={{
              height: 54, padding: '0 var(--space-32)', borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(180deg, var(--green-600), var(--green-700))',
              color: '#fff', fontSize: '1.02rem', textDecoration: 'none',
              boxShadow: '0 10px 24px rgba(15,138,103,0.28)',
            }}
          >
            {dict['home.logIn']}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        {/* Interactive showcase — the real annotator: two flush Mushaf pages with the
            reader's toolbar on top. Visitors can draw on it. */}
        <div className="home-rise relative mt-20 sm:mt-24 w-full" style={{ animationDelay: '0.2s' }}>
          <HomeReaderDemo />
        </div>
      </section>

      <footer
        className="relative w-full text-center text-xs tracking-wider uppercase border-t"
        style={{ padding: '18px 0', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
      >
        {dict['home.footer']}
      </footer>
    </main>
  );
}
