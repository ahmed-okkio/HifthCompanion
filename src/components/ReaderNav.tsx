'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { TOTAL_PAGES, clampPage } from '@/lib/quran';
import LogoutButton from './LogoutButton';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function ReaderNav({ currentPage }: { currentPage: number }) {
  const router = useRouter();
  const [jumpInput, setJumpInput] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, [supabase]);

  const go = (page: number) => {
    const pageNum = clampPage(page);
    router.push(`/reader/${pageNum}`);
    setJumpInput('');
  };

  return (
    <nav className="w-full flex items-center justify-between px-4 py-3 bg-white border-b border-stone-200 shadow-sm">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => go(currentPage - 1)} 
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm font-semibold text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md disabled:opacity-30 transition-all duration-200"
        >
          ← Prev
        </button>
      </div>

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

      <div className="flex items-center gap-4">
        <button 
          onClick={() => go(currentPage + 1)} 
          disabled={currentPage === TOTAL_PAGES}
          className="px-3 py-1.5 text-sm font-semibold text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md disabled:opacity-30 transition-all duration-200"
        >
          Next →
        </button>
        <div className="h-4 w-px bg-stone-200" />
        {isLoggedIn === null ? (
          <div className="w-16 h-8 animate-pulse bg-stone-200 rounded-md" />
        ) : isLoggedIn ? (
          <>
            <Link href="/sets" className="text-sm font-semibold text-stone-600 hover:text-emerald-700">
              My Sets
            </Link>
            <LogoutButton />
          </>
        ) : (
          <Link href="/login" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            Log In
          </Link>
        )}
      </div>
    </nav>
  );
}
