"use client";

import { useEffect, useState } from "react";

// ~1s launch intro: static logo until window load, then the girih star turns in behind it
// while the wordmark rises and the logo lifts 10px from where Android's launch icon sat
// (600ms), then the star turns out and everything fades (400ms)
// and the overlay unmounts. Only on full page loads — client
// navigations don't remount the root layout. pointer-events:none so it never blocks input.
// English-only by design (no RTL variant).
const INTRO_MS = 600;
const EXIT_MS = 400;

export function SplashIntro() {
  const [phase, setPhase] = useState<"wait" | "intro" | "exit" | "gone">("wait");

  // Android's PWA launch screen covers the page until load, so the intro only starts
  // after load; until then the static logo matches the OS splash it replaces.
  useEffect(() => {
    const start = () => requestAnimationFrame(() => setPhase("intro"));
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  useEffect(() => {
    if (phase === "intro") { const t = setTimeout(() => setPhase("exit"), INTRO_MS); return () => clearTimeout(t); }
    if (phase === "exit") { const t = setTimeout(() => setPhase("gone"), EXIT_MS); return () => clearTimeout(t); }
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div className={`splash splash-${phase}`} aria-hidden="true" dir="ltr" lang="en">
      <svg className="splash-star" viewBox="0 0 560 560">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="130" y="130" width="300" height="300" transform={`rotate(${i * 11.25} 280 280)`} />
        ))}
      </svg>
      <div className="splash-lift">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="splash-logo" />
      </div>
      <div className="splash-wordmark">Hifth Companion</div>
    </div>
  );
}
