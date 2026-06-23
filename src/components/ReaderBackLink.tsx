'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function ReaderBackLink() {
  const [href, setHref] = useState('/reader');
  useEffect(() => {
    const last = localStorage.getItem('hifth:lastPage');
    if (last) setHref(`/reader/${last}`);
  }, []);
  return (
    <Link href={href} className="btn btn-ghost" style={{ fontSize: '12px', minHeight: '44px' }}>
      ← Back to Reader
    </Link>
  );
}
