import React, { useEffect, useState } from 'react';
import { Eye, LoaderCircle, Pencil, Plus, Save, StickyNote, Trash2, X } from 'lucide-react';

async function callNotesApi(url, options) {
  let credentials = { username: 'mc', password: 'mc1234' };
  try {
    const saved = JSON.parse(localStorage.getItem('fxbrief-credentials') || 'null');
    if (saved && typeof saved.username === 'string' && typeof saved.password === 'string') credentials = saved;
  } catch {}
  const response = await fetch(url, {
    ...options,
    headers: { ...options?.headers, 'x-mcfx-username': credentials.username, 'x-mcfx-password': credentials.password },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not complete the notes request.');
  return data;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadNotes() {
    setLoading(true);
    setError('');
    try {
      const data = await callNotesApi('/api/notes');
      setNotes(data.notes || []);
    } catch (issue) {
      setError(issue.message || 'Could not load your notes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadNotes(); }, []);

  function resetForm() {
    setTitle('');
    setDescription('');
    setEditingId(null);
    setError('');
    setMessage('');
  }

  function editNote(note) {
    setEditingId(note.id);
    setTitle(note.title);
    setDescription(note.description);
    setMessage('');
    setError('');
    document.querySelector('.notes-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const editing = editingId !== null;
    try {
      const url = editing ? `/api/notes?id=${encodeURIComponent(editingId)}` : '/api/notes';
      const data = await callNotesApi(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      const saved = data.note;
      setNotes(current => editing ? current.map(note => note.id === saved.id ? saved : note).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) : [saved, ...current]);
      resetForm();
      setMessage(editing ? 'Note updated.' : 'Note added.');
    } catch (issue) {
      setError(issue.message || 'Could not save the note.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(note) {
    if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
    setError('');
    setMessage('');
    try {
      await callNotesApi(`/api/notes?id=${encodeURIComponent(note.id)}`, { method: 'DELETE' });
      setNotes(current => current.filter(item => item.id !== note.id));
      if (viewing?.id === note.id) setViewing(null);
      if (editingId === note.id) resetForm();
      setMessage('Note deleted.');
    } catch (issue) {
      setError(issue.message || 'Could not delete the note.');
    }
  }

  return <>
    <div className="date-line">PERSONAL WORKSPACE</div>
    <h1>Your notes<span>.</span></h1>
    <p className="intro">Keep trade plans, market observations, and reminders together.</p>

    <section className="notes-panel notes-form-panel">
      <div className="notes-panel-heading"><span className="notes-icon"><StickyNote size={18}/></span><div><small>{editingId === null ? 'NEW NOTE' : 'EDIT NOTE'}</small><h2>{editingId === null ? 'Write a note' : 'Update your note'}</h2></div></div>
      <form className="notes-form" onSubmit={submit}>
        <label>TITLE<input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} placeholder="For example, EUR/USD plan" required/></label>
        <label>DESCRIPTION<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={10000} rows={5} placeholder="Write your market notes…" required/></label>
        <div className="notes-form-footer"><span>{description.length}/10,000 characters</span><div>{editingId !== null&&<button className="notes-button secondary" type="button" onClick={resetForm}><X size={14}/> Cancel</button>}<button className="notes-button primary" type="submit" disabled={saving}>{saving?<LoaderCircle className="spin" size={15}/>:editingId === null?<Plus size={15}/>:<Save size={15}/>} {editingId === null?'Add note':'Save changes'}</button></div></div>
      </form>
      {error&&<p className="notes-feedback error" role="alert">{error}</p>}
      {message&&<p className="notes-feedback success" role="status">{message}</p>}
    </section>

    <section className="notes-panel notes-list-panel">
      <div className="notes-list-heading"><div><small>YOUR NOTEBOOK</small><h2>Saved notes</h2></div><span>{notes.length} {notes.length === 1 ? 'NOTE' : 'NOTES'}</span></div>
      {loading?<div className="notes-state"><LoaderCircle className="spin" size={19}/> Loading your notes…</div>:notes.length?<div className="notes-table-wrap"><table className="notes-table"><thead><tr><th>Title</th><th>Description</th><th>Last updated</th><th>Actions</th></tr></thead><tbody>{notes.map(note=><tr key={note.id}><td className="notes-title-cell">{note.title}</td><td className="notes-description-cell">{note.description}</td><td className="notes-date-cell">{formatDate(note.updatedAt)}</td><td><div className="notes-actions"><button type="button" className="notes-action" onClick={()=>setViewing(note)} aria-label={`Show ${note.title}`} title="Show"><Eye size={15}/><span>Show</span></button><button type="button" className="notes-action" onClick={()=>editNote(note)} aria-label={`Edit ${note.title}`} title="Edit"><Pencil size={15}/><span>Edit</span></button><button type="button" className="notes-action delete" onClick={()=>deleteNote(note)} aria-label={`Delete ${note.title}`} title="Delete"><Trash2 size={15}/><span>Delete</span></button></div></td></tr>)}</tbody></table></div>:<div className="notes-state empty"><StickyNote size={22}/><b>No notes yet</b><span>Add a title and description above to start your notebook.</span></div>}
    </section>

    {viewing&&<div className="note-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setViewing(null)}}><section className="note-modal" role="dialog" aria-modal="true" aria-labelledby="note-modal-title"><button className="note-modal-close" type="button" onClick={()=>setViewing(null)} aria-label="Close note"><X size={17}/></button><small>NOTE DETAILS</small><h2 id="note-modal-title">{viewing.title}</h2><p className="note-modal-date">Last updated {formatDate(viewing.updatedAt)}</p><div className="note-modal-description">{viewing.description}</div><div className="note-modal-actions"><button className="notes-button secondary" type="button" onClick={()=>{setViewing(null);editNote(viewing)}}><Pencil size={14}/> Edit</button><button className="notes-button primary" type="button" onClick={()=>setViewing(null)}>Done</button></div></section></div>}
  </>;
}
