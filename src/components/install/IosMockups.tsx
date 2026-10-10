/**
 * Coded mockups of the iOS Safari "Add to Home Screen" flow, standing in for
 * screenshots. Deliberately fixed light-mode iOS colours and English system
 * labels, because they depict Apple's UI, not ours.
 * ponytail: modelled on iOS 18/26 Safari; refresh if Apple moves the buttons again.
 */

import type { ReactNode } from 'react';

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[220px] h-[400px] rounded-[2.2rem] border-[6px] border-[#1c1c1e] bg-[#f2f2f7] overflow-hidden relative shadow-lg text-[#000] select-none" aria-hidden="true">
      <div className="flex justify-between items-center px-5 pt-2 text-[10px] font-semibold">
        <span>9:41</span>
        <span className="w-14 h-4 rounded-full bg-[#1c1c1e]" />
        <span className="w-5 h-2.5 rounded-[3px] border border-[#1c1c1e] p-[1px]"><span className="block h-full w-full rounded-[1px] bg-[#1c1c1e]" /></span>
      </div>
      {children}
    </div>
  );
}

/** Faint page content behind the browser chrome. */
function PageBehind({ dim = false }: { dim?: boolean }) {
  return (
    <div className={`px-4 pt-4 flex flex-col gap-2 ${dim ? 'opacity-40' : ''}`}>
      <div className="h-3 w-24 rounded bg-[#d1d1d6]" />
      <div className="h-24 rounded-lg bg-white" />
      <div className="h-2 w-full rounded bg-[#d1d1d6]" />
      <div className="h-2 w-5/6 rounded bg-[#d1d1d6]" />
      <div className="h-2 w-4/6 rounded bg-[#d1d1d6]" />
    </div>
  );
}

const Ring = 'ring-[3px] ring-[#ff9500] ring-offset-2 ring-offset-white animate-pulse';

function ShareIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function AppIcon({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon-192.png" alt="" width={size} height={size} className="rounded-[22%] border border-[#e5e5ea]" />;
}

export function IosStepShare() {
  return (
    <Phone>
      <PageBehind />
      <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t border-[#d1d1d6] px-3 pt-2 pb-5">
        <div className="rounded-xl bg-[#e9e9ee] text-center text-[11px] py-1.5 mb-2">
          🔒 hifth-companion.vercel.app
        </div>
        <div className="flex justify-between items-center px-2 text-[#007aff] text-lg">
          <span>‹</span>
          <span className="opacity-30">›</span>
          <span className={`rounded-md p-1 ${Ring}`}><ShareIcon /></span>
          <span>📖</span>
          <span>⧉</span>
        </div>
      </div>
    </Phone>
  );
}

export function IosStepAddToHome() {
  const rows = ['Copy', 'Add to Reading List', 'Add Bookmark', 'Add to Favourites'];
  return (
    <Phone>
      <PageBehind dim />
      <div className="absolute inset-x-0 bottom-0 top-16 rounded-t-2xl bg-[#f2f2f7] px-3 pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div className="flex items-center gap-2 mb-3">
          <AppIcon size={32} />
          <div className="text-[11px] leading-tight">
            <div className="font-semibold">HifthCompanion</div>
            <div className="text-[#8e8e93]">hifth-companion.vercel.app</div>
          </div>
        </div>
        <div className="rounded-xl bg-white text-[12px] divide-y divide-[#e5e5ea]">
          {rows.map(r => <div key={r} className="px-3 py-2">{r}</div>)}
          <div className={`px-3 py-2 flex justify-between items-center rounded-lg font-medium ${Ring}`}>
            Add to Home Screen <span className="text-base leading-none">⊞</span>
          </div>
        </div>
      </div>
    </Phone>
  );
}

export function IosStepConfirm() {
  return (
    <Phone>
      <div className="flex justify-between items-center px-3 py-3 text-[12px] bg-[#f9f9f9] border-b border-[#d1d1d6]">
        <span className="text-[#007aff]">Cancel</span>
        <span className="font-semibold text-[11px] whitespace-nowrap">Add to Home Screen</span>
        <span className={`text-[#007aff] font-semibold rounded-md px-1.5 ${Ring}`}>Add</span>
      </div>
      <div className="m-3 rounded-xl bg-white p-3 flex gap-3 items-center">
        <AppIcon size={44} />
        <div className="flex-1 min-w-0 text-[12px]">
          <div className="border-b border-[#e5e5ea] pb-1">HifthCompanion</div>
          <div className="text-[#8e8e93] pt-1 text-[10px] truncate">hifth-companion.vercel.app</div>
        </div>
      </div>
      <div className="mx-3 rounded-xl bg-white px-3 py-2 flex justify-between items-center text-[12px]">
        Open as Web App
        <span className="w-9 h-5 rounded-full bg-[#34c759] relative"><span className="absolute end-0.5 top-0.5 w-4 h-4 rounded-full bg-white" /></span>
      </div>
    </Phone>
  );
}
