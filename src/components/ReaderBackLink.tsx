'use client';
import Link from 'next/link';
import { useClientValue } from '@/hooks/useClientValue';
import { Icon } from '@/components/tracker/ui';
import { useI18n } from '@/components/I18nProvider';

export default function ReaderBackLink() {
  const { t, locale } = useI18n();
  const last = useClientValue(() => localStorage.getItem('hifth:lastPage'), null);
  const href = last ? `/reader/${last}` : '/reader';
  return (
    <Link href={href} className="btn btn-ghost flex items-center gap-1.5 text-caption min-h-11">
      <span className={`inline-flex ${locale === 'ar' ? '-scale-x-100' : ''}`}>
        <Icon name="arrow-left" size={15} />
      </span> {t('reader.backToReader')}
    </Link>
  );
}
