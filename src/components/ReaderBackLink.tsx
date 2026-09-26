'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/tracker/ui';
import { useI18n } from '@/components/I18nProvider';

export default function ReaderBackLink() {
  const { t, locale } = useI18n();
  const [href, setHref] = useState('/reader');
  useEffect(() => {
    const last = localStorage.getItem('hifth:lastPage');
    if (last) setHref(`/reader/${last}`);
  }, []);
  return (
    <Link href={href} className="btn btn-ghost flex items-center gap-1.5 text-caption min-h-11">
      <span className={`inline-flex ${locale === 'ar' ? '-scale-x-100' : ''}`}>
        <Icon name="arrow-left" size={15} />
      </span> {t('reader.backToReader')}
    </Link>
  );
}
