'use client';
import { useState, useTransition } from 'react';
import type { Note } from '@/types';
import { createNote, updateNote, deleteNote } from '@/lib/services/notes';

export function useNotes(setId: string, pageNum: number, initialNotes: Note[]) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newBody, setNewBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!newBody.trim()) return;
    startTransition(async () => {
      try {
        const { data, error } = await createNote(setId, pageNum, newBody.trim());
        if (error) { console.error('[NotesPanel] Create error:', error); return; }
        if (data) { setNotes(prev => [...prev, data]); setNewBody(''); }
      } catch (err) {
        console.error('[NotesPanel] Create error:', err);
      }
    });
  };

  const handleUpdate = (id: string) => {
    if (!editBody.trim()) return;
    startTransition(async () => {
      try {
        const { error } = await updateNote(id, editBody.trim());
        if (error) { console.error('[NotesPanel] Update error:', error); return; }
        setNotes(prev => prev.map(n => n.id === id ? { ...n, body: editBody.trim() } : n));
        setEditingId(null);
        setEditBody('');
      } catch (err) {
        console.error('[NotesPanel] Update error:', err);
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const { error } = await deleteNote(id);
        if (error) { console.error('[NotesPanel] Delete error:', error); return; }
        setNotes(prev => prev.filter(n => n.id !== id));
      } catch (err) {
        console.error('[NotesPanel] Delete error:', err);
      }
    });
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditBody(note.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody('');
  };

  return {
    notes, newBody, editingId, editBody, collapsed, isPending,
    setNewBody, setEditBody, setCollapsed,
    handleCreate, handleUpdate, handleDelete, startEdit, cancelEdit,
  };
}
