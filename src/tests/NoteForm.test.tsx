import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NoteForm from '../components/NoteForm';

describe('NoteForm', () => {
  it('renders textarea with placeholder', () => {
    render(<NoteForm value="" isPending={false} onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Write a note/)).toBeInTheDocument();
  });

  it('Add Note button disabled when value empty', () => {
    render(<NoteForm value="" isPending={false} onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('Add Note').closest('button')).toBeDisabled();
  });

  it('Add Note button disabled when value is whitespace', () => {
    render(<NoteForm value="   " isPending={false} onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('Add Note').closest('button')).toBeDisabled();
  });

  it('Add Note button enabled when value has text', () => {
    render(<NoteForm value="some text" isPending={false} onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('Add Note').closest('button')).not.toBeDisabled();
  });

  it('Add Note button disabled when isPending=true', () => {
    render(<NoteForm value="some text" isPending={true} onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('Add Note').closest('button')).toBeDisabled();
  });

  it('calls onSubmit on Add Note click', () => {
    const onSubmit = vi.fn();
    render(<NoteForm value="hello" isPending={false} onChange={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Add Note'));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('calls onSubmit on Ctrl+Enter', () => {
    const onSubmit = vi.fn();
    render(<NoteForm value="hello" isPending={false} onChange={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/Write a note/), { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('does NOT call onSubmit on plain Enter', () => {
    const onSubmit = vi.fn();
    render(<NoteForm value="hello" isPending={false} onChange={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/Write a note/), { key: 'Enter', ctrlKey: false });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<NoteForm value="" isPending={false} onChange={onChange} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Write a note/), { target: { value: 'new text' } });
    expect(onChange).toHaveBeenCalledWith('new text');
  });

  it('shows Ctrl+Enter hint', () => {
    render(<NoteForm value="" isPending={false} onChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Ctrl\+Enter/)).toBeInTheDocument();
  });
});
