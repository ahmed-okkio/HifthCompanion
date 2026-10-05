"use client";

import { useEffect, useState } from "react";

// ~1s launch intro: girih star turns in behind the logo, logo + wordmark rise (CSS, runs
// before hydration). Once hydrated and the 600ms intro has played, the star turns out and
// everything fades (400ms), then the overlay unmounts. Only on full page loads — client
// navigations don't remount the root layout. pointer-events:none so it never blocks input.
// English-only by design (no RTL variant).
const INTRO_MS = 600;
const EXIT_MS = 400;

export function SplashIntro() {
  const [phase, setPhase] = useState<"intro" | "exit" | "gone">("intro");

  useEffect(() => {
    const wait = Math.max(0, INTRO_MS - performance.now());
    const t1 = setTimeout(() => setPhase("exit"), wait);
    const t2 = setTimeout(() => setPhase("gone"), wait + EXIT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === "gone") return null;
  return (
    <div className={`splash${phase === "exit" ? " splash-exit" : ""}`} aria-hidden="true" dir="ltr" lang="en">
      <svg className="splash-star" viewBox="0 0 560 560">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="130" y="130" width="300" height="300" transform={`rotate(${i * 11.25} 280 280)`} />
        ))}
      </svg>
      <div className="splash-rise">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="splash-logo" />
      </div>
      <div className="splash-rise splash-wordmark">Hifth Companion</div>
    </div>
  );
}
