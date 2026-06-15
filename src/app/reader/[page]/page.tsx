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
    <div className="flex flex-col min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-100">
      <ReaderNav currentPage={pageNum} />
      
      <main className="flex-grow flex items-center justify-center p-6 md:p-12">
        <div className="bg-white shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] rounded-2xl overflow-hidden border border-stone-100 max-w-[500px] w-full transition-all duration-300 hover:shadow-[0_25px_60px_-20px_rgba(0,0,0,0.15)]">
          <div className="relative w-full aspect-[3/4]">
            <Image
              src={getPageImageUrl(pageNum)}
              alt={`Quran page ${pageNum}`}
              fill
              className="object-contain p-2"
              priority
              sizes="(max-width: 768px) 100vw, 500px"
            />
          </div>
        </div>
      </main>
      
      <footer className="pb-6 text-center text-stone-400 text-xs tracking-wider uppercase">
        HifthCompanion © 2026
      </footer>
    </div>
  );
}
