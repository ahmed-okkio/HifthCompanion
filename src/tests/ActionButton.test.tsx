import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
