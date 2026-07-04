'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/tracker/ui';

export default function ReaderBackLink() {
  const [href, setHref] = useState('/reader');
  useEffect(() => {
    const last = localStorage.getItem('hifth:lastPage');
    if (last) setHref(`/reader/${last}`);
  }, []);
  return (
    <Link href={href} className="btn btn-ghost flex items-center gap-1.5" style={{ fontSize: '12px', minHeight: '44px' }}>
      <Icon name="arrow-left" size={15} /> Back to Reader
    </Link>
  );
}
