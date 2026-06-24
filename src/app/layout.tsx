import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "HifthCompanion — Quran Annotation & Study",
  description: "Read, annotate, and study the Quran with powerful drawing tools and shareable annotations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${geistMono.variable}`}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
