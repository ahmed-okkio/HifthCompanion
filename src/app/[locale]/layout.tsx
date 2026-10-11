import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { TopProgressBar } from "@/components/TopProgressBar";
import { SplashIntro } from "@/components/SplashIntro";
import { notFound } from "next/navigation";
import { defaultLocale, dirFor, isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// UI typeface: Plus Jakarta Sans — a modern, geometric sans for a premium feel.
// We keep the existing --font-geist-sans / --font-geist-mono variable names so nothing
// downstream has to change — Plus Jakarta Sans just backs the sans variable now.
const sans = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Brand wordmark only — a modern, light geometric sans for the product name.
const brand = Outfit({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["400"],
});

// Locale comes from the hidden [locale] segment (proxy rewrites /x -> /{cookie locale}/x),
// so this layout reads no cookies/headers (PRD 0016 B3).
// Prerender a shell per locale (cacheComponents needs known root params).
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type LocaleParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(isLocale(locale) ? locale : defaultLocale);
  return {
    title: dict['common.metaTitle'],
    description: dict['common.metaDescription'],
    // manifest.ts is auto-linked by Next; appleWebApp + apple-touch-icon make the
    // app installable on iOS (M4-1).
    appleWebApp: {
      capable: true,
      title: "HifthCompanion",
      statusBarStyle: "default",
    },
    icons: {
      apple: "/apple-touch-icon.png",
    },
  };
}

// themeColor belongs in the viewport export in Next 16. Matches --surface-main
// (the top nav bar background) so the installed-PWA status bar blends with it.
export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  // Edge-to-edge on Android Chrome: paint behind the gesture bar instead of a black strip.
  // Bottom-fixed UI already pads with env(safe-area-inset-bottom).
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode } & LocaleParams>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={dirFor(locale)} className={`${sans.variable} ${geistMono.variable} ${brand.variable}`}>
      <body className="font-sans">
        <SplashIntro />
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <I18nProvider locale={locale}>
          {/* ponytail: catch-all boundary so unconverted routes build under cacheComponents;
              Phase 3 moves Suspense down to each data section. */}
          <Suspense fallback={null}>{children}</Suspense>
        </I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
