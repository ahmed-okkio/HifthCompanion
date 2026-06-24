import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

// V3 design refresh (Story 1): Inter is the UI typeface. We keep the existing
// --font-geist-sans / --font-geist-mono variable names so nothing downstream
// has to change — Inter just backs the sans variable now.
const inter = Inter({
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
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
