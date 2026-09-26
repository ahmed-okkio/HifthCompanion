import type { CSSProperties } from 'react';

interface Props {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
  'aria-label': string;
  style?: CSSProperties;
  className?: string;
}

export default function PageNavArrow({ direction, disabled, onClick, 'aria-label': ariaLabel, style, className }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex items-center justify-center rounded-lg border-none bg-transparent shadow-none transition duration-220 ${
        disabled ? 'cursor-default opacity-30' : 'cursor-pointer hover:bg-surface-app hover:shadow-e2 active:scale-94 active:shadow-e1'
      } ${className ?? ''}`}
      style={style}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-colors duration-220">
        {direction === 'left' ? <path d="M15 19l-7-7 7-7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </button>
  );
}
