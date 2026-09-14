/**
 * QuestionsPage — question bank grid with filters, create/edit, approve/reject,
 * and similarity review.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Check, X, AlertTriangle, FileText } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/questions.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_COLORS = ['var(--bloom-1)', 'var(--bloom-2)', 'var(--bloom-3)', 'var(--bloom-4)', 'var(--bloom-5)', 'var(--bloom-6)'];
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const TYPE_LABELS = { mcq: 'Multiple Choice', true_false: 'True/False', matching: 'Matching', identification: 'Identification' };

export default function QuestionsPage() {
  const toast = useToast();
  const [questions, setQuestions] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ subject_id: '', bloom: '', type: '', status: '' });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.subject_id) params.set('subject_id', filters.subject_id);
    if (filters.bloom) params.set('bloom', filters.bloom);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    api.get(`/questions?${params}`)
      .then((data) => setQuestions(data.questions))
      .catch((err) => toast.error(err.message || 'Could not load questions.'));
  }, [filters, toast]);

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        subject_id: editing.subject_id,
        type: editing.type,
        stem: editing.stem,
        bloom: editing.bloom || undefined,
        topic: editing.topic || undefined,
        answer: editing.answer || undefined,
        explanation: editing.explanation || undefined,
        status: editing.status || 'draft',
      };
      if (editing.type === 'mcq') {
        body.options = (editing.optionsText || '').split('\n').map((s) => s.trim()).filter(Boolean);
      }
      if (editing.id) {
        await api.put(`/questions/${editing.id}`, body);
        toast.success('Question updated.');
      } else {
        await api.post('/questions', body);
        toast.success('Question created.');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(q) {
    try { await api.post(`/questions/${q.id}/approve`); toast.success('Question approved.'); load(); }
    catch (err) { toast.error(err.message || 'Approve failed.'); }
  }
  async function handleReject(q) {
    try { await api.post(`/questions/${q.id}/reject`); toast.success('Question rejected.'); load(); }
    catch (err) { toast.error(err.message || 'Reject failed.'); }
  }
  async function handleDelete(q) {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    try { await api.del(`/questions/${q.id}`); toast.success('Question deleted.'); load(); }
    catch (err) { toast.error(err.message || 'Delete failed.'); }
  }

  return (
    <AppShell activeNav="questions" pageTitle="Questions">
      <div className="q-toolbar">
            <h1>Questions</h1>
            <div className="q-filters">
              <select className="q-filter" value={filters.subject_id} onChange={(e) => setFilters({ ...filters, subject_id: e.target.value })}>
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name} — {s.name}</option>)}
              </select>
              <select className="q-filter" value={filters.bloom} onChange={(e) => setFilters({ ...filters, bloom: e.target.value })}>
                <option value="">All Bloom</option>
                {BLOOM_ORDER.map((b) => <option key={b} value={b}>{BLOOM_LABELS[b]}</option>)}
              </select>
              <select className="q-filter" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                <option value="">All types</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="q-filter" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Approved</option>
              </select>
              <button className="btn btn-primary" onClick={() => setEditing({ type: 'mcq', status: 'draft', subject_id: filters.subject_id || (subjects[0]?.id || '') })}>
                <Plus size={16} /> New question
              </button>
            </div>
          </div>
          {questions === null ? (
            <p className="placeholder">Loading…</p>
          ) : questions.length === 0 ? (
            <div className="empty-state">
              <FileText size={40} style={{ color: 'var(--ink-faint)', marginBottom: 12 }} />
              <h3>No questions yet</h3>
              <p>Create questions manually, import from GIFT/XML, or generate them from your materials.</p>
            </div>
          ) : (
            <table className="q-table">
              <thead>
                <tr><th>Stem</th><th>Subject</th><th>Type</th><th>Bloom</th><th>Status</th><th>Source</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td className="q-stem">
                      <div className="q-stem-text">{q.stem}</div>
                      {q.similarity_flag === 'flagged' && (
                        <Link to={`/questions/${q.id}/similarity`} style={{ color: 'var(--red-600)', fontSize: 'var(--text-xs)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} /> Similarity flagged ({(q.similarity_score * 100).toFixed(0)}%)
                        </Link>
                      )}
                    </td>
                    <td>{q.subject_code || q.subject_name || '—'}</td>
                    <td>{TYPE_LABELS[q.type] || q.type}</td>
                    <td>{q.bloom && (
                      <span className="q-bloom" style={{ background: BLOOM_COLORS[BLOOM_ORDER.indexOf(q.bloom)] }} title={BLOOM_LABELS[q.bloom]}>
                        {BLOOM_ORDER.indexOf(q.bloom) + 1}
                      </span>
                    )}</td>
                    <td>
                      <span className={`q-badge ${q.status === 'active' ? 'active' : 'draft'}`}>{q.status === 'active' ? 'Approved' : 'Draft'}</span>
                      {q.similarity_flag === 'flagged' && <span className="q-badge flagged" style={{ marginLeft: 4 }}>Flagged</span>}
                      {q.similarity_flag === 'rejected' && <span className="q-badge rejected" style={{ marginLeft: 4 }}>Rejected</span>}
                    </td>
                    <td>{q.source}</td>
                    <td>
                      <div className="q-actions">
                        {q.status === 'draft' && <button className="btn" onClick={() => handleApprove(q)} title="Approve"><Check size={14} /></button>}
                        <button className="btn" onClick={() => setEditing({ ...q, optionsText: Array.isArray(q.options) ? q.options.join('\n') : '' })} title="Edit"><Pencil size={14} /></button>
                        {q.status === 'draft' && <button className="btn" onClick={() => handleReject(q)} title="Reject"><X size={14} /></button>}
                        <button className="btn btn-danger" onClick={() => handleDelete(q)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

      <Modal open={!!editing} title={editing?.id ? 'Edit question' : 'New question'} onClose={() => setEditing(null)} size="lg"
        footer={<>
          <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" form="q-form" type="submit" disabled={saving}>
            {saving && <span className="btn-spinner" />}{editing?.id ? 'Save' : 'Create'}
          </button>
        </>}>
        {editing && (
          <form id="q-form" onSubmit={handleSave} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subject <span className="req">*</span></label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.subject_id || ''} onChange={(e) => setEditing({ ...editing, subject_id: e.target.value })} required>
                  <option value="">Select subject…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name} — {s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type <span className="req">*</span></label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.type || 'mcq'} onChange={(e) => setEditing({ ...editing, type: e.target.value })} required>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Bloom Level</label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.bloom || ''} onChange={(e) => setEditing({ ...editing, bloom: e.target.value })}>
                  <option value="">—</option>
                  {BLOOM_ORDER.map((b) => <option key={b} value={b}>{BLOOM_LABELS[b]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" style={{ paddingLeft: 16 }} value={editing.status || 'draft'} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="active">Approved</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Topic</label>
              <input className="form-input" style={{ paddingLeft: 16 }} value={editing.topic || ''} maxLength={255} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Stem <span className="req">*</span></label>
              <textarea className="form-input" style={{ minHeight: 80, padding: '12px 16px', resize: 'vertical' }} value={editing.stem || ''} maxLength={10000} required onChange={(e) => setEditing({ ...editing, stem: e.target.value })} />
            </div>
            {editing.type === 'mcq' && (
              <div className="form-group">
                <label className="form-label">Options (one per line) <span className="req">*</span></label>
                <textarea className="form-input" style={{ minHeight: 100, padding: '12px 16px', resize: 'vertical' }} placeholder={'Option A\nOption B\nOption C\nOption D'} value={editing.optionsText || ''} onChange={(e) => setEditing({ ...editing, optionsText: e.target.value })} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Answer {editing.type === 'mcq' ? '(must match an option)' : editing.type === 'true_false' ? '(True or False)' : ''}</label>
              <input className="form-input" style={{ paddingLeft: 16 }} value={editing.answer || ''} maxLength={10000} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Explanation</label>
              <textarea className="form-input" style={{ minHeight: 60, padding: '12px 16px', resize: 'vertical' }} value={editing.explanation || ''} maxLength={10000} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} />
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
