import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MarkedPagesList from '../components/MarkedPagesList';
import type { MarkedPage } from '@/lib/markedPages';

// Pages 4 and 22 are Al-Baqarah, 51 is Aal-i-Imran. Page 22 holds the set max (Needs Focus).
const ROWS: MarkedPage[] = [
  { page: 22, count: 7, colors: { '#ef4444': 4, '#f59e0b': 2, '#111827': 1 } },
  { page: 4, count: 3, colors: { '#22c55e': 2, '#3b82f6': 1 } },
  { page: 51, count: 5, colors: { '#f59e0b': 5 } },
];

describe('MarkedPagesList — colour chips', () => {
  it('names every colour it shows, heaviest first, and omits chips for a pre-migration row', () => {
    render(<MarkedPagesList rows={[{ page: 4, count: 3, colors: { '#3b82f6': 1, '#22c55e': 2 } }, { page: 9, count: 2 }]} />);
    const chips = screen.getAllByLabelText(/marks$/).filter(el => el.tagName === 'SPAN' && /Green|Blue/.test(el.getAttribute('aria-label') ?? ''));
    expect(chips.map(c => c.getAttribute('aria-label'))).toEqual(['2 Green marks', '1 Blue marks']);
    // Page 9 predates mark_colors: total badge only, no chips.
    expect(screen.queryByLabelText(/Red marks/)).toBeNull();
  });
});

describe('MarkedPagesList — surah grouping', () => {
  it('folds pages into mushaf-ordered surah cards and flags the one holding Needs Focus', () => {
    render(<MarkedPagesList rows={ROWS} grouped onJump={vi.fn()} />);
    const names = screen.getAllByText(/Al-Baqara|Aal-i-Imraan/).map(el => el.textContent);
    expect(names).toEqual(['Al-Baqara', 'Aal-i-Imraan']);
    expect(screen.getByText('2 pages · 10 marks')).toBeTruthy();
    // Exactly one card carries the focus dot — Al-Baqarah's, which holds page 22.
    expect(screen.getAllByLabelText('Contains a page that needs focus')).toHaveLength(1);
  });

  it('opens the card holding the page being read, and toggles on click', () => {
    const { container } = render(<MarkedPagesList rows={ROWS} grouped currentPage={22} onJump={vi.fn()} />);
    const cards = container.querySelectorAll('details');
    expect([...cards].map(c => (c as HTMLDetailsElement).open)).toEqual([true, false]);

    fireEvent.click(screen.getByText('Aal-i-Imraan'));
    expect([...container.querySelectorAll('details')].map(c => (c as HTMLDetailsElement).open)).toEqual([true, true]);

    fireEvent.click(screen.getByText('Al-Baqara'));
    expect([...container.querySelectorAll('details')].map(c => (c as HTMLDetailsElement).open)).toEqual([false, true]);
  });

  it('falls back to the flat count-desc list when not grouped', () => {
    render(<MarkedPagesList rows={ROWS} onJump={vi.fn()} />);
    expect(screen.queryByText('Al-Baqara')).toBeNull();
    const pages = screen.getAllByText(/^Page \d+$/).map(el => el.textContent);
    expect(pages).toEqual(['Page 22', 'Page 51', 'Page 4']);
  });
});
