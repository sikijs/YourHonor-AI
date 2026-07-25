'use client';

import { useState, useEffect, useRef } from 'react';
import { api, Note } from '@/lib/api';
import { printContent, notesHtml } from '@/lib/print';

const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 460;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const FAB_SIZE = 56;
const FAB_MARGIN = 24;
const GAP = 12;

export default function ScratchPad() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'se' | 'w'>('se');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0 });
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const saveRef = useRef<() => void>(() => {});

  useEffect(() => {
    setPosition({
      x: window.innerWidth - DEFAULT_WIDTH - FAB_MARGIN,
      y: window.innerHeight - DEFAULT_HEIGHT - FAB_MARGIN - FAB_SIZE - GAP,
    });
  }, []);

  useEffect(() => {
    if (isOpen) fetchNotes();
  }, [isOpen]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition(p => ({
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y),
      }));
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, dragOffset]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.x;
      const dy = e.clientY - resizeStart.y;
      if (resizeDirection === 'w') {
        const newWidth = Math.max(MIN_WIDTH, resizeStart.width - dx);
        setSize(s => ({ ...s, width: newWidth }));
        setPosition(p => ({ ...p, x: resizeStart.posX + (resizeStart.width - newWidth) }));
      } else {
        setSize({
          width: Math.max(MIN_WIDTH, resizeStart.width + dx),
          height: Math.max(MIN_HEIGHT, resizeStart.height + dy),
        });
      }
    };
    const onUp = () => setIsResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizing, resizeStart, resizeDirection]);

  useEffect(() => {
    saveRef.current = handleSave;
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isMinimized) {
        setIsOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isMinimized]);

  async function fetchNotes() {
    setLoading(true);
    setError('');
    try {
      const data = await api.notes.list();
      setNotes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }

  function openNote(note: Note) {
    setCurrentNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setView('editor');
    if (isMinimized) setIsMinimized(false);
  }

  function newNote() {
    setCurrentNote(null);
    setEditTitle('');
    setEditContent('');
    setView('editor');
    if (isMinimized) setIsMinimized(false);
  }

  function goToList() {
    setView('list');
    setCurrentNote(null);
    setError('');
  }

  async function handleSave() {
    if (!editTitle.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (currentNote) {
        const updated = await api.notes.update(currentNote.id, {
          title: editTitle.trim(),
          content: editContent,
        });
        setCurrentNote(updated);
      } else {
        const created = await api.notes.create(editTitle.trim(), editContent);
        setCurrentNote(created);
      }
      await fetchNotes();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!currentNote) return;
    if (!window.confirm('Delete this note?')) return;
    setError('');
    try {
      await api.notes.delete(currentNote.id);
      setCurrentNote(null);
      setView('list');
      await fetchNotes();
    } catch (err: any) {
      setError(err.message || 'Failed to delete note');
    }
  }

  function handleTitleBarMouseDown(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.scratchpad-titlebar-btn')) return;
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  }

  function handleResizeMouseDown(e: React.MouseEvent, direction: 'se' | 'w') {
    e.preventDefault();
    e.stopPropagation();
    setResizeDirection(direction);
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, width: size.width, height: size.height, posX: position.x });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function currentTitle() {
    if (view === 'editor' && editTitle) return editTitle;
    if (currentNote) return currentNote.title;
    return 'Scratch Pad';
  }

  return (
    <>
      <button
        className="scratchpad-fab"
        onClick={() => setIsOpen(o => !o)}
        title={isOpen ? 'Close Notes' : 'Open Notes'}
        aria-label="Toggle scratch pad"
      >
        {isOpen ? '✕' : 'Notes'}
      </button>

      {isOpen && (
        <div className="scratchpad-window"
          style={{
            left: position.x,
            top: position.y,
            width: size.width,
            height: isMinimized ? 'auto' : size.height,
          }}
        >
          <div
            className="scratchpad-titlebar"
            onMouseDown={handleTitleBarMouseDown}
          >
            <span className="scratchpad-titlebar-title">
              {isMinimized ? 'Scratch Pad' : currentTitle()}
            </span>
            <span className="scratchpad-titlebar-btns">
              <button
                className="scratchpad-titlebar-btn"
                onClick={() => setIsMinimized(m => !m)}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? '□' : '−'}
              </button>
              <button
                className="scratchpad-titlebar-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                ×
              </button>
            </span>
          </div>

          {!isMinimized && (
            <div className="scratchpad-body">
              {view === 'list' && (
                <div className="scratchpad-list">
                  <button className="btn btn-secondary" onClick={newNote} style={{ width: '100%', marginBottom: 8 }}>
                    + New Note
                  </button>
                  {loading && (
                    <div className="spinner-container"><span className="spinner" /><p>Loading...</p></div>
                  )}
                  {error && <div className="error">{error}</div>}
                  {!loading && notes.length === 0 && (
                    <div className="scratchpad-empty">
                      <p>No saved notes yet.</p>
                      <p style={{ fontSize: '0.85rem' }}>Create a new note to get started.</p>
                    </div>
                  )}
                  {notes.map(note => (
                    <div key={note.id} className="scratchpad-note-card" onClick={() => openNote(note)}>
                      <div className="scratchpad-note-card-title">{note.title || 'Untitled Note'}</div>
                      <div className="scratchpad-note-card-preview">
                        {note.content ? note.content.replace(/\n/g, ' ').substring(0, 80) : '(empty)'}
                      </div>
                      <div className="scratchpad-note-card-meta">{formatDate(note.updated_at)}</div>
                      <div className="scratchpad-note-card-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
                          onClick={() => openNote(note)}
                        >
                          Open
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
                          onClick={() => printContent(note.title || 'Untitled Note', notesHtml(note.title, note.content))}
                        >
                          Print
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem', borderColor: '#d32f2f', color: '#d32f2f' }}
                          onClick={async () => {
                            if (!window.confirm('Delete this note?')) return;
                            try {
                              await api.notes.delete(note.id);
                              await fetchNotes();
                            } catch (err: any) {
                              setError(err.message || 'Failed to delete note');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === 'editor' && (
                <div className="scratchpad-editor">
                  <button className="btn btn-outline" onClick={goToList} style={{ alignSelf: 'flex-start', fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                    ← Back to Notes
                  </button>
                  {error && <div className="error">{error}</div>}
                  <input
                    type="text"
                    placeholder="Note title..."
                    value={editTitle}
                    onChange={e => { setEditTitle(e.target.value); setSaved(false); }}
                  />
                  <textarea
                    placeholder="Write your notes here..."
                    value={editContent}
                    onChange={e => { setEditContent(e.target.value); setSaved(false); }}
                  />
                  <div className="scratchpad-actions">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editTitle.trim()}>
                      {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 4 }}>
                    {currentNote ? `Last saved ${formatDate(currentNote.updated_at)}` : 'New note'}
                    {' · Ctrl+S to save'}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="scratchpad-resize-handle" onMouseDown={e => handleResizeMouseDown(e, 'se')} />
          <div className="scratchpad-resize-handle-left" onMouseDown={e => handleResizeMouseDown(e, 'w')} />
        </div>
      )}
    </>
  );
}
