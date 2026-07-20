import type { CSSProperties } from 'react';

interface Props {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
  'aria-label': string;
  style?: CSSProperties;
}

export default function PageNavArrow({ direction, disabled, onClick, 'aria-label': ariaLabel, style }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        border: 'none',
        background: 'transparent',
        boxShadow: 'none',
        cursor: disabled ? 'default' : 'pointer',
        borderRadius: 'var(--radius-lg-px)',
        transition: 'background 220ms ease, box-shadow 220ms ease, transform 120ms var(--ease-out)',
        opacity: disabled ? 0.3 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        const el = e.currentTarget;
        el.style.background = 'var(--surface-app)';
        el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.background = 'transparent';
        el.style.boxShadow = 'none';
      }}
      onMouseDown={e => {
        if (disabled) return;
        const el = e.currentTarget;
        el.style.transform = 'scale(0.94)';
        el.style.boxShadow = '0 2px 8px rgba(15,23,42,0.18)';
      }}
      onMouseUp={e => {
        const el = e.currentTarget;
        el.style.transform = '';
        el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transition: 'color 220ms ease' }}>
        {direction === 'left' ? <path d="M15 19l-7-7 7-7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </button>
  );
}
