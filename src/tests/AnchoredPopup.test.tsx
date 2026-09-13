import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { AnchoredPopup } from '@/components/tracker/ui';

/** Anchor stub with a controllable rect — jsdom lays everything out at 0x0. */
function Harness({ rect }: { rect: Partial<DOMRect> }) {
  const ref = useRef<HTMLDivElement>(null);
  // Ref callback, not an effect: the rect has to be stubbed before AnchoredPopup measures.
  const attach = (el: HTMLDivElement | null) => {
    ref.current = el;
    if (el) {
      el.getBoundingClientRect = () => ({
        left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40, x: 0, y: 0,
        toJSON: () => ({}), ...rect,
      } as DOMRect);
    }
  };
  return (
    <div>
      <div ref={attach}>anchor</div>
      <AnchoredPopup open anchorRef={ref}>
        <span>option</span>
      </AnchoredPopup>
    </div>
  );
}

describe('AnchoredPopup', () => {
  it('escapes its parent stacking context: renders into <body>, fixed, above everything', () => {
    render(<Harness rect={{}} />);
    const popup = screen.getByText('option').parentElement!;
    expect(popup.parentElement).toBe(document.body);
    expect(popup.style.position).toBe('fixed');
    expect(popup.style.zIndex).toBe('9999');
  });

  it('drops below the anchor when there is room', () => {
    window.innerHeight = 800;
    render(<Harness rect={{ top: 100, bottom: 140 }} />);
    const popup = screen.getByText('option').parentElement!;
    expect(popup.style.top).toBe('144px');
    expect(popup.style.bottom).toBe('');
  });

  it('flips above the anchor when the field sits near the bottom of the viewport', () => {
    window.innerHeight = 600;
    render(<Harness rect={{ top: 520, bottom: 560 }} />);
    const popup = screen.getByText('option').parentElement!;
    expect(popup.style.bottom).toBe('84px'); // 600 - 520 + 4
    expect(popup.style.top).toBe('');
  });
});
