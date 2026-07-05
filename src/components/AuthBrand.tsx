'use client';

// Shared brand header for the auth screens (PRD 0008 M5). Renders the logo image
// with a graceful wordmark fallback: if /logo.png is missing or fails to load,
// onError flips to the styled حفظ wordmark — no broken-image icon, no crash (A1).

import { useState } from 'react';
import Link from 'next/link';

export default function AuthBrand({ subtitle }: { subtitle?: string }) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="text-center mb-8">
      <Link href="/reader" className="inline-block">
        {broken ? (
          <span className="text-3xl font-bold" style={{ color: 'var(--text-accent)' }}>
            حفظ
          </span>
        ) : (
          // logo drop-in — actual asset is public/logo.png.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logo.png"
            alt="حفظ"
            onError={() => setBroken(true)}
            style={{ height: 64, width: 'auto', margin: '0 auto', objectFit: 'contain' }}
          />
        )}
      </Link>
      {subtitle && (
        <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
