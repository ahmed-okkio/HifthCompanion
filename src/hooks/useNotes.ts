'use client';
import { useState, useEffect, useTransition, useMemo } from 'react';
import type { Note } from '@/types';
import { createNote, updateNote, deleteNote, linkNote } from '@/lib/services/notes';
import { createClient } from '@/lib/supabase/client';

export function useNotes(setId: string, pageNum: number, initialNotes: Note[] = []) {
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newBody, setNewBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!setId) { setNotes([]); return; }
    const fetchNotes = (reset: boolean) => {
      supabase
        .from('notes')
        .select('*')
        .eq('set_id', setId)
        .eq('page_number', pageNum)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((res: any) => {
          setNotes(res.data ?? []);
          if (!reset) return;
          setEditingId(null);
          setEditBody('');
          setNewBody('');
        });
    };
    fetchNotes(true);
    // A canvas save may have soft-deleted or restored this page's bound notes; refetch so the
    // panel follows the erase/undo instead of showing notes whose object is gone.
    const onStale = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.setId === setId && d?.pageNum === pageNum) fetchNotes(false);
    };
    window.addEventListener('hifth:notes-stale', onStale);
    return () => window.removeEventListener('hifth:notes-stale', onStale);
  }, [setId, pageNum, supabase]);

  // The badge overlay lives on the canvas (a sibling tree) — broadcasting the list keeps it in
  // sync without a second fetch. Same one-line window bus as 'hifth:note-compose'.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('hifth:notes', { detail: { setId, pageNum, notes } }));
  }, [setId, pageNum, notes]);

  // bodyArg lets a shared composer (spread mode) create against this page without
  // routing through this hook's own newBody state; omitted ⇒ single-panel behavior.
  const handleCreate = (bodyArg?: string, fabricObjectId?: string | null) => {
    const body = (bodyArg ?? newBody).trim();
    if (!body) return;
    // Optimistic: show the note (and clear the input) immediately; reconcile with the server row
    // when it returns, or roll back and restore the draft on failure.
    const now = new Date().toISOString();
    const tempId = `temp-${(globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random()))}`;
    const optimistic: Note = { id: tempId, set_id: setId, page_number: pageNum, body, x: null, y: null, created_at: now, updated_at: now, fabric_object_id: fabricObjectId ?? null };
    setNotes(prev => [...prev, optimistic]);
    if (bodyArg === undefined) setNewBody('');
    startTransition(async () => {
      try {
        const { data, error } = await createNote(setId, pageNum, body, undefined, undefined, fabricObjectId ?? undefined);
        if (error || !data) {
          console.error('[NotesPanel] Create error:', error);
          setNotes(prev => prev.filter(n => n.id !== tempId));
          if (bodyArg === undefined) setNewBody(body); // give the text back to retry
          return;
        }
        setNotes(prev => prev.map(n => n.id === tempId ? data : n)); // temp → real row
      } catch (err) {
        console.error('[NotesPanel] Create error:', err);
        setNotes(prev => prev.filter(n => n.id !== tempId));
        if (bodyArg === undefined) setNewBody(body);
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

  // Link/unlink an existing note to a canvas object (fabricObjectId null = unlink). Optimistic.
  const handleLink = (id: string, fabricObjectId: string | null) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, fabric_object_id: fabricObjectId } : n));
    startTransition(async () => {
      try {
        const { error } = await linkNote(id, fabricObjectId);
        if (error) console.error('[NotesPanel] Link error:', error);
      } catch (err) {
        console.error('[NotesPanel] Link error:', err);
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
    handleCreate, handleUpdate, handleDelete, handleLink, startEdit, cancelEdit,
  };
}
