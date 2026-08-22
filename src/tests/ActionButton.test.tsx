import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionButton } from '@/components/tracker/ui';

describe('ActionButton', () => {
  it('disables itself while an async click is in flight, so it cannot be spam-clicked', async () => {
    let resolve!: () => void;
    let calls = 0;
    const onClick = () => {
      calls += 1;
      return new Promise<void>((r) => { resolve = r; });
    };

    render(<ActionButton onClick={onClick}>Save</ActionButton>);
    const btn = screen.getByRole('button', { name: /save/i });

    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());

    fireEvent.click(btn); // the spam click
    expect(calls).toBe(1);

    resolve();
    await waitFor(() => expect(btn).toBeEnabled());
  });

  it('flashes a success mark once the write lands, then returns to idle', async () => {
    vi.useFakeTimers();
    try {
      render(<ActionButton onClick={() => Promise.resolve()}>Cancel</ActionButton>);
      const btn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(btn);
      await act(async () => { await Promise.resolve(); });
      expect(btn).toHaveAttribute('data-done', 'true');
      act(() => { vi.advanceTimersByTime(1500); });
      expect(btn).not.toHaveAttribute('data-done');
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a synchronous click untouched', () => {
    let calls = 0;
    render(<ActionButton onClick={() => { calls += 1; }}>Toggle</ActionButton>);
    const btn = screen.getByRole('button', { name: /toggle/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(calls).toBe(2);
    expect(btn).toBeEnabled();
  });
});
