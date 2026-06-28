'use client';
import { useState } from 'react';
import type { AnnotationSet } from '@/types';
import { createAnnotationSet, updateAnnotationSet, deleteAnnotationSet } from '@/lib/services/annotationSets';

export default function SetsList({ initialSets }: { initialSets: AnnotationSet[] }) {
  const [sets, setSets] = useState<AnnotationSet[]>(initialSets);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function handleCreateSet() {
    if (!newName.trim()) return;
    try {
      const newSet = await createAnnotationSet(newName);
      setSets([newSet, ...sets]);
      setNewName('');
    } catch (error) {
      console.error('Error creating set:', error);
    }
  }

  async function handleRenameSet(id: string) {
    if (!editName.trim()) return;
    try {
      await updateAnnotationSet(id, editName);
      setSets(sets.map(s => s.id === id ? { ...s, name: editName.trim() } : s));
      setEditingId(null);
    } catch (error) {
      console.error('Error renaming set:', error);
    }
  }

  async function handleDeleteSet(id: string) {
    if (!confirm('Delete this set and all its annotations?')) return;
    try {
      await deleteAnnotationSet(id);
      setSets(sets.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting set:', error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Create new set */}
      <div className="card flex gap-2 items-center"
           style={{ padding: '12px 16px' }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
          placeholder="New set name..."
          className="input"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button onClick={handleCreateSet}
                disabled={!newName.trim()}
                className="btn btn-primary flex items-center gap-1"
                style={{ flexShrink: 0, minHeight: '44px' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="sm:inline">Create</span>
        </button>
      </div>

      {/* Empty state */}
      {sets.length === 0 && (
        <div className="card text-center animate-fade-in"
             style={{ padding: '40px 24px', color: 'var(--text-muted)' }}>
          <div className="flex justify-center mb-3 text-emerald-500">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-sm font-medium">No annotation sets yet</p>
          <p className="text-xs mt-1">Create one above to start annotating the Quran</p>
        </div>
      )}

      {/* Set items */}
      {sets.map((set, i) => (
        <div key={set.id}
             className="card group animate-fade-in"
             style={{
               padding: '14px 18px',
               animationDelay: `${i * 50}ms`,
             }}>
          {/* Top row: name / edit-input */}
          {editingId === set.id ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenameSet(set.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="input input-sm"
                style={{ flex: 1, minWidth: 0, minHeight: '44px' }}
              />
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => handleRenameSet(set.id)}
                        className="btn btn-ghost flex items-center gap-1"
                        style={{ minHeight: '44px', padding: '4px 12px', fontSize: '13px', color: 'var(--text-accent)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </button>
                <button onClick={() => setEditingId(null)}
                        className="btn btn-ghost flex items-center gap-1"
                        style={{ minHeight: '44px', padding: '4px 12px', fontSize: '13px' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                     style={{ background: 'var(--accent)' }} />
                <span className="font-medium text-sm truncate"
                      style={{ color: 'var(--text-primary)' }}>
                  {set.name}
                </span>
                {set.is_default && (
                  <span className="badge flex-shrink-0" style={{ fontSize: '11px' }}>Default</span>
                )}
              </div>
              {/* Always visible on touch (hover: none); hover-reveal on pointer devices */}
              <div className="sets-actions flex gap-1 flex-shrink-0">
                <button
                  onClick={() => { setEditingId(set.id); setEditName(set.name); }}
                  className="btn btn-ghost flex items-center gap-1"
                  style={{ minHeight: '44px', padding: '4px 12px', fontSize: '13px' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span className="hidden sm:inline">Rename</span>
                </button>
                {!set.is_default && (
                  <button onClick={() => handleDeleteSet(set.id)}
                          className="btn btn-danger-ghost flex items-center gap-1"
                          style={{ minHeight: '44px', padding: '4px 12px', fontSize: '13px' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
