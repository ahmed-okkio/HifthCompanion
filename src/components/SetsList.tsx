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
    <div className="flex flex-col gap-4">
      {/* Create */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateSet()}
          placeholder="New set name..."
          className="flex-1 border rounded px-3 py-2"
        />
        <button onClick={handleCreateSet} className="bg-emerald-700 text-white px-4 rounded">
          Create
        </button>
      </div>

      {/* List */}
      {sets.length === 0 && <p className="text-gray-400">No sets yet. Create one above.</p>}
      {sets.map(set => (
        <div key={set.id} className="flex items-center justify-between border rounded px-4 py-3">
          {editingId === set.id ? (
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameSet(set.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className="flex-1 border rounded px-2 py-1 mr-2"
            />
          ) : (
            <span className="flex-1 font-medium">{set.name}</span>
          )}
          <div className="flex gap-2 text-sm">
            {editingId === set.id ? (
              <>
                <button onClick={() => handleRenameSet(set.id)} className="text-emerald-600">Save</button>
                <button onClick={() => setEditingId(null)} className="text-gray-400">Cancel</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setEditingId(set.id); setEditName(set.name); }}
                  className="text-blue-500"
                >
                  Rename
                </button>
                <button onClick={() => handleDeleteSet(set.id)} className="text-red-400">Delete</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
