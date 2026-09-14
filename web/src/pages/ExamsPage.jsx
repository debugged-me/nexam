/**
 * ExamsPage — list of exams with create/edit/delete.
 *
 * Exams are print-ready or LMS-exportable question sets assembled from
 * approved questions, optionally aligned to a TOS blueprint.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, FileCheck, Eye } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/exams.css';

export default function ExamsPage() {
  const toast = useToast();
  const [exams, setExams] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [tosList, setTosList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get('/exams')
      .then((data) => setExams(data.exams))
      .catch((err) => toast.error(err.message || 'Could not load exams.'));
  }, [toast]);

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects)).catch(() => {});
    api.get('/tos').then((data) => setTosList(data.tos)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        title: editing.title,
        subject_id: editing.subject_id,
        tos_id: editing.tos_id || undefined,
        format: editing.format || 'print',
        set_count: Number(editing.set_count) || 1,
        duration_minutes: editing.duration_minutes ? Number(editing.duration_minutes) : undefined,
        instructions: editing.instructions || undefined,
        status: editing.status || 'draft',
      };
      if (editing.id) {
        await api.put(`/exams/${editing.id}`, body);
        toast.success('Exam updated.');
      } else {
        await api.post('/exams', body);
        toast.success('Exam created.');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(exam) {
    if (!confirm('Delete this exam? This cannot be undone.')) return;
    try { await api.del(`/exams/${exam.id}`); toast.success('Exam deleted.'); load(); }
    catch (err) { toast.error(err.message || 'Delete failed.'); }
  }

  return (
    <AppShell activeNav="exams" pageTitle="Exams">
      <div className="page-header">
            <h1>Exams</h1>
            <div className="page-header-actions">
              <button className="btn btn-primary" onClick={() => setEditing({ title: '', subject_id: subjects[0]?.id || '', set_count: 1, format: 'print', status: 'draft' })}>
                <Plus size={16} /> New exam
              </button>
            </div>
          </div>
          {exams === null ? (
            <p className="placeholder">Loading…</p>
          ) : exams.length === 0 ? (
            <div className="empty-state">
              <FileCheck size={40} style={{ color: 'var(--ink-faint)', marginBottom: 12 }} />
              <h3>No exams yet</h3>
              <p>Create an exam from your approved questions, optionally aligned to a TOS blueprint.</p>
            </div>
          ) : (
            <div className="exam-list">
              {exams.map((e) => (
                <div key={e.id} className="exam-card">
                  <div>
                    <div className="exam-card-title">{e.title}</div>
                    <div className="exam-card-meta">
                      {e.subject_code || e.subject_name} · {e.question_count} questions · {e.status}
                      {e.duration_minutes ? ` · ${e.duration_minutes} min` : ''}
                    </div>
                  </div>
                  <div className="exam-card-actions">
                    <Link to={`/exams/${e.id}`} className="btn" title="View"><Eye size={14} /></Link>
                    <button className="btn" onClick={() => setEditing({ ...e })} title="Edit"><Pencil size={14} /></button>
                    <button className="btn btn-danger" onClick={() => handleDelete(e)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

      <Modal open={!!editing} title={editing?.id ? 'Edit exam' : 'New exam'} onClose={() => setEditing(null)} size="lg"
        footer={<>
          <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" form="exam-form" type="submit" disabled={saving}>
            {saving && <span className="btn-spinner" />}{editing?.id ? 'Save' : 'Create'}
          </button>
        </>}>
        {editing && (
          <form id="exam-form" onSubmit={handleSave} noValidate>
            <div className="form-group">
              <label className="form-label">Title <span className="req">*</span></label>
              <input className="form-input" style={{ paddingLeft: 16 }} value={editing.title || ''} maxLength={255} required
                onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subject <span className="req">*</span></label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.subject_id || ''} required
                  onChange={(e) => setEditing({ ...editing, subject_id: e.target.value })}>
                  <option value="">Select…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name} — {s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">TOS Blueprint</label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.tos_id || ''}
                  onChange={(e) => setEditing({ ...editing, tos_id: e.target.value })}>
                  <option value="">None</option>
                  {tosList.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Format</label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.format || 'print'}
                  onChange={(e) => setEditing({ ...editing, format: e.target.value })}>
                  <option value="print">Print</option>
                  <option value="lms">LMS Export</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Set Count</label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.set_count || 1}
                  onChange={(e) => setEditing({ ...editing, set_count: e.target.value })}>
                  <option value={1}>1 set (A only)</option>
                  <option value={2}>2 sets (A & B)</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duration (minutes)</label>
                <input type="number" className="form-input" style={{ paddingLeft: 16 }} min={1} value={editing.duration_minutes || ''}
                  onChange={(e) => setEditing({ ...editing, duration_minutes: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.status || 'draft'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Instructions</label>
              <textarea className="form-input" style={{ minHeight: 80, padding: '12px 16px', resize: 'vertical' }}
                value={editing.instructions || ''} maxLength={5000}
                onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} />
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
