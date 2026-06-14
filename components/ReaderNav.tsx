'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TOTAL_PAGES, clampPage } from '@/lib/quran';

export default function ReaderNav({ currentPage }: { currentPage: number }) {
  const router = useRouter();
  const [jumpInput, setJumpInput] = useState('');

  const go = (page: number) => {
    const pageNum = clampPage(page);
    router.push(`/reader/${pageNum}`);
    setJumpInput('');
  };

  return (
    <nav className="w-full flex items-center justify-between px-4 py-3 bg-white border-b border-stone-200 shadow-sm">
      <button 
        onClick={() => go(currentPage - 1)} 
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm font-semibold text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md disabled:opacity-30 transition-all duration-200"
      >
        ← Prev
      </button>

      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-stone-800 tabular-nums">
          {currentPage} <span className="text-stone-400 font-normal">/</span> {TOTAL_PAGES}
        </span>
        <input
          type="number"
          min={1}
          max={TOTAL_PAGES}
          value={jumpInput}
          onChange={e => setJumpInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') go(parseInt(jumpInput, 10));
          }}
          placeholder="Go to..."
          className="w-16 px-2 py-1 bg-stone-50 border border-stone-200 rounded-md text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
      </div>

      <button 
        onClick={() => go(currentPage + 1)} 
        disabled={currentPage === TOTAL_PAGES}
        className="px-3 py-1.5 text-sm font-semibold text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md disabled:opacity-30 transition-all duration-200"
      >
        Next →
      </button>
    </nav>
  );
}
