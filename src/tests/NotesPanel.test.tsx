import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotesPanel from '../components/NotesPanel';
import * as notesService from '@/lib/services/notes';
import type { Note } from '@/types';

vi.mock('@/lib/services/notes', () => ({
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-1',
  set_id: 'set-1',
  page_number: 1,
  body: 'Test note',
  x: null,
  y: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const defaultProps = { setId: 'set-1', pageNum: 1, initialNotes: [] };

describe('NotesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no notes', () => {
    render(<NotesPanel {...defaultProps} />);
    expect(screen.getByText(/No notes yet/)).toBeDefined();
  });

  it('renders existing notes', () => {
    render(<NotesPanel {...defaultProps} initialNotes={[makeNote()]} />);
    expect(screen.getByText('Test note')).toBeDefined();
  });

  it('adds new note on button click', async () => {
    const newNote = makeNote({ id: 'note-2', body: 'New note' });
    vi.mocked(notesService.createNote).mockResolvedValue({ data: newNote, error: null });

    render(<NotesPanel {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Add a note/), { target: { value: 'New note' } });
    fireEvent.click(screen.getByText('Add Note'));

    await waitFor(() => {
      expect(notesService.createNote).toHaveBeenCalledWith('set-1', 1, 'New note');
      expect(screen.getByText('New note')).toBeDefined();
    });
  });

  it('does not create note with empty body', () => {
    render(<NotesPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Note'));
    expect(notesService.createNote).not.toHaveBeenCalled();
  });

  it('shows note count badge', () => {
    render(<NotesPanel {...defaultProps} initialNotes={[makeNote(), makeNote({ id: 'note-2' })]} />);
    expect(screen.getByText('2')).toBeDefined();
  });

  it('collapses and expands on header button click', () => {
    render(<NotesPanel {...defaultProps} initialNotes={[makeNote()]} />);
    fireEvent.click(screen.getByText('Hide'));
    expect(screen.queryByText('Test note')).toBeNull();
    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('Test note')).toBeDefined();
  });

  it('hides edit/delete buttons in readOnly mode', () => {
    render(<NotesPanel {...defaultProps} initialNotes={[makeNote()]} readOnly />);
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.queryByPlaceholderText(/Add a note/)).toBeNull();
  });

  it('updates note text on save', async () => {
    vi.mocked(notesService.updateNote).mockResolvedValue({ error: null });
    render(<NotesPanel {...defaultProps} initialNotes={[makeNote()]} />);

    fireEvent.click(screen.getByText('Edit'));
    const textarea = screen.getByDisplayValue('Test note');
    fireEvent.change(textarea, { target: { value: 'Updated note' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(notesService.updateNote).toHaveBeenCalledWith('note-1', 'Updated note');
      expect(screen.getByText('Updated note')).toBeDefined();
    });
  });

  it('removes note from list on delete', async () => {
    vi.mocked(notesService.deleteNote).mockResolvedValue({ error: null });
    render(<NotesPanel {...defaultProps} initialNotes={[makeNote()]} />);

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(notesService.deleteNote).toHaveBeenCalledWith('note-1');
      expect(screen.queryByText('Test note')).toBeNull();
    });
  });
});
