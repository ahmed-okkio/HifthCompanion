import { Suspense } from 'react';
import ReaderClient from '@/components/ReaderClient';

export default function ReaderPage() {
  return (
    <Suspense>
      <ReaderClient />
    </Suspense>
  );
}
