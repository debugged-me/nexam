/**
 * SubjectsPage — grid of instructor subjects with create/edit/delete.
 *
 * Uses a card grid (not a DataTable) since subjects are few per instructor
 * and cards read better on mobile. CRUD via /api/subjects.
 */
import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, BookOpen, FileText, ClipboardList, FileCheck } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/subjects.css';

export default function SubjectsPage() {
  const toast = useToast();
  const [subjects, setSubjects] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} (new) | subject (edit)
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    api.get('/subjects')
      .then((data) => setSubjects(data.subjects))
      .catch((err) => toast.error(err.message || 'Could not load subjects.'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/subjects/${editing.id}`, {
          name: editing.name, code: editing.code, description: editing.description,
        });
        toast.success('Subject updated.');
      } else {
        await api.post('/subjects', {
          name: editing.name, code: editing.code, description: editing.description,
        });
        toast.success('Subject created.');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(subject) {
    setDeleting(subject);
    try {
      await api.del(`/subjects/${subject.id}`);
      toast.success('Subject deleted.');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AppShell activeNav="subjects" pageTitle="Subjects">
      <div className="page-header">
        <h1>Subjects</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setEditing({ name: '', code: '', description: '' })}>
            <Plus size={16} /> New subject
          </button>
        </div>
      </div>
          {subjects === null ? (
            <p className="placeholder">Loading…</p>
          ) : subjects.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={40} style={{ color: 'var(--ink-faint)', marginBottom: 12 }} />
              <h3>No subjects yet</h3>
              <p>Create a subject to start uploading materials and generating questions.</p>
              <button className="btn btn-primary" onClick={() => setEditing({ name: '', code: '', description: '' })}>
                <Plus size={16} /> Create your first subject
              </button>
            </div>
          ) : (
            <div className="subject-grid">
              {subjects.map((s) => (
                <div key={s.id} className="subject-card">
                  <div className="subject-card-head">
                    <div>
                      {s.code && <span className="subject-card-code">{s.code}</span>}
                      <h3 className="subject-card-title">{s.name}</h3>
                    </div>
                  </div>
                  {s.description && <p className="subject-card-desc">{s.description}</p>}
                  <div className="subject-card-stats">
                    <div className="subject-stat">
                      <span className="subject-stat-value">{s.question_count}</span>
                      <span className="subject-stat-label">Questions</span>
                    </div>
                    <div className="subject-stat">
                      <span className="subject-stat-value">{s.tos_count}</span>
                      <span className="subject-stat-label">TOS</span>
                    </div>
                    <div className="subject-stat">
                      <span className="subject-stat-value">{s.exam_count}</span>
                      <span className="subject-stat-label">Exams</span>
                    </div>
                  </div>
                  <div className="subject-card-actions">
                    <button className="btn" onClick={() => setEditing(s)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDelete(s)} disabled={deleting?.id === s.id}>
                      {deleting?.id === s.id ? <span className="btn-spinner" /> : <Trash2 size={14} />}
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

      {/* Create/Edit modal */}
      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit subject' : 'New subject'}
        subtitle={editing?.id ? 'Update the subject details.' : 'Create a subject to organize your materials and exams.'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" form="subject-form" type="submit" disabled={saving}>
              {saving && <span className="btn-spinner" />}
              {editing?.id ? 'Save changes' : 'Create subject'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="subject-form" onSubmit={handleSave} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="subj-name">Name <span className="req">*</span></label>
              <input id="subj-name" className="form-input" style={{ paddingLeft: 16 }}
                value={editing.name || ''} maxLength={255} required
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="subj-code">Code</label>
              <input id="subj-code" className="form-input" style={{ paddingLeft: 16 }}
                placeholder="e.g. CS101" maxLength={50}
                value={editing.code || ''}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="subj-desc">Description</label>
              <textarea id="subj-desc" className="form-input" style={{ height: 100, padding: '12px 16px', resize: 'vertical' }}
                maxLength={5000}
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
