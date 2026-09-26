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
  // Logged in → splash has nothing to offer; go straight to the daily wird.
  if (user) redirect('/wird');
  return (
    <main
      className="relative min-h-dvh flex flex-col items-center overflow-hidden bg-surface-app text-primary"
    >
      {/* Aurora background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="home-aurora-a absolute -top-[12%] -left-[8%] size-140 rounded-full bg-radial from-accent/22 to-transparent to-65% blur-2xl animate-aurora"
        />
        <div
          className="home-aurora-b absolute top-[8%] -right-[12%] size-155 rounded-full bg-radial from-home-gold/20 to-transparent to-65% blur-2xl animate-aurora-reverse"
        />
        <div
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-subtle to-transparent"
        />
      </div>

      {/* Hero */}
      <section className="relative w-full max-w-280 px-6 pt-16 pb-12 sm:pt-24 flex flex-col items-center text-center">
        {/* Logo — the high-res mark, crisp, no backdrop. */}
        <Image src="/logo.png" alt="HifthCompanion" width={112} height={112} priority className="home-rise w-[clamp(84px,16vw,112px)] h-auto mb-4" />

        <span
          className="home-rise inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-surface-main border border-subtle shadow-e1 text-small font-semibold text-secondary tracking-wider uppercase"
        >
          {dict['home.tagline']}
        </span>

        <h1
          className="home-rise font-bold font-display text-[clamp(2.5rem,7vw,4.25rem)] leading-none tracking-tight [animation-delay:0.05s]"
        >
          {dict['home.heroTitlePrefix']}{' '}
          <span className="bg-linear-120 from-green-600 to-home-gold bg-clip-text text-transparent">
            {dict['home.heroTitleMushaf']}
          </span>
          <br />{dict['home.heroTitleSuffix']}
        </h1>

        <p
          className="home-rise mt-6 max-w-[34ch] sm:max-w-[50ch] text-secondary text-[clamp(1.05rem,2.4vw,1.3rem)] leading-normal [animation-delay:0.1s]"
        >
          {dict['home.heroSubtitle']}
        </p>

        <div
          className="home-rise mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto [animation-delay:0.15s]"
        >
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 font-bold transition-transform hover:-translate-y-0.5 h-14 px-8 rounded-md bg-linear-to-b from-green-600 to-green-700 text-accent-contrast text-base no-underline shadow-accent"
          >
            {dict['home.logIn']}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        {/* Interactive showcase — the real annotator: two flush Mushaf pages with the
            reader's toolbar on top. Visitors can draw on it. */}
        <div className="home-rise relative mt-20 sm:mt-24 w-full [animation-delay:0.2s]">
          <HomeReaderDemo />
        </div>
      </section>

      <footer
        className="relative w-full text-center text-xs tracking-wider uppercase border-t py-4 text-muted border-subtle"
      >
        {dict['home.footer']}
      </footer>
    </main>
  );
}
