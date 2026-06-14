import { notFound } from 'next/navigation';
import { getPageImageUrl, TOTAL_PAGES } from '@/lib/quran';
import ReaderNav from '@/components/ReaderNav';
import Image from 'next/image';

interface Props {
  params: { page: string };
}

export default async function ReaderPage({ params }: Props) {
  const { page } = await params;
  const pageNum = parseInt(page, 10);
  
  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 text-stone-900">
      <ReaderNav currentPage={pageNum} />
      
      <main className="flex-grow flex items-start justify-center p-4 md:p-8">
        <div className="bg-white shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] rounded-lg overflow-hidden border border-stone-200 max-w-[600px] w-full">
          <div className="relative w-full aspect-[3/4]">
            <Image
              src={getPageImageUrl(pageNum)}
              alt={`Quran page ${pageNum}`}
              fill
              className="object-contain"
              style={{ objectFit: 'contain' }}
              priority
              sizes="(max-width: 768px) 100vw, 600px"
            />
          </div>
        </div>
      </main>
      
      <footer className="pb-8 text-center text-stone-400 text-sm">
        HifthCompanion © 2026
      </footer>
    </div>
  );
}
