import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { TopProgressBar } from "@/components/TopProgressBar";
import { dirFor } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
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

// themeColor belongs in the viewport export in Next 16. Matches --green-600.
export const viewport: Viewport = {
  themeColor: "#0F8A67",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirFor(locale)} className={`${sans.variable} ${geistMono.variable} ${brand.variable}`}>
      <body className="font-sans">
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
