import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NoteItem from '../components/NoteItem';
import type { Note } from '@/types';

const note: Note = {
  id: 'n1',
  set_id: 's1',
  page_number: 1,
  body: 'My note body',
  x: null,
  y: null,
  created_at: new Date('2026-01-01T12:00:00Z').toISOString(),
  updated_at: new Date('2026-01-01T12:00:00Z').toISOString(),
};

const defaultProps = {
  note,
  isEditing: false,
  editBody: '',
  isPending: false,
  readOnly: false,
  onEditBodyChange: vi.fn(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe('NoteItem — display mode', () => {
  it('renders note body', () => {
    render(<NoteItem {...defaultProps} />);
    expect(screen.getByText('My note body')).toBeInTheDocument();
  });

  it('calls onEdit with note when Edit clicked', () => {
    const onEdit = vi.fn();
    render(<NoteItem {...defaultProps} onEdit={onEdit} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(note);
  });

  it('calls onDelete with note id when Delete clicked', () => {
    const onDelete = vi.fn();
    render(<NoteItem {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('n1');
  });

  it('hides Edit and Delete in readOnly mode', () => {
    render(<NoteItem {...defaultProps} readOnly={true} />);
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('disables Delete when isPending', () => {
    render(<NoteItem {...defaultProps} isPending={true} />);
    expect(screen.getByText('Delete').closest('button')).toBeDisabled();
  });
});

describe('NoteItem — edit mode', () => {
  const editProps = { ...defaultProps, isEditing: true, editBody: 'Edited text' };

  it('shows textarea with current editBody', () => {
    render(<NoteItem {...editProps} />);
    expect(screen.getByDisplayValue('Edited text')).toBeInTheDocument();
  });

  it('calls onEditBodyChange on textarea input', () => {
    const onEditBodyChange = vi.fn();
    render(<NoteItem {...editProps} onEditBodyChange={onEditBodyChange} />);
    fireEvent.change(screen.getByDisplayValue('Edited text'), { target: { value: 'New text' } });
    expect(onEditBodyChange).toHaveBeenCalledWith('New text');
  });

  it('calls onSave with note id on Save click', () => {
    const onSave = vi.fn();
    render(<NoteItem {...editProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('n1');
  });

  it('calls onCancel on Cancel click', () => {
    const onCancel = vi.fn();
    render(<NoteItem {...editProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables Save when isPending', () => {
    render(<NoteItem {...editProps} isPending={true} />);
    expect(screen.getByText('Save').closest('button')).toBeDisabled();
  });
});
