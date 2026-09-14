/**
 * QuestionsPage — question bank grid with filters, create/edit, approve/reject,
 * and similarity review.
 *
 * Faithful React port of application/views/questions/index.php + form.php.
 * Uses the same class names as the PHP app for strict visual parity.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Check, X, Info, Search, Upload, Sparkles,
  MoreVertical, FileText,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/questions.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const BLOOM_LEVELS = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };
const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / false', matching: 'Matching type', identification: 'Identification' };

export default function QuestionsPage() {
  const toast = useToast();
  const [questions, setQuestions] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ subject_id: '', bloom: '', type: '', status: '' });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);

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

  // Client-side search filter (mirrors DataTables search)
  const filteredQuestions = useMemo(() => {
    if (!questions) return null;
    if (!search.trim()) return questions;
    const q = search.toLowerCase();
    return questions.filter((item) =>
      (item.stem || '').toLowerCase().includes(q) ||
      (item.topic || '').toLowerCase().includes(q)
    );
  }, [questions, search]);

  const activeFilterCount = [filters.subject_id, filters.bloom, filters.type, filters.status].filter(Boolean).length;

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

  function openEdit(q) {
    setMenuOpen(null);
    setEditing({ ...q, optionsText: Array.isArray(q.options) ? q.options.join('\n') : '' });
  }

  return (
    <AppShell activeNav="questions" pageTitle="Questions" wide>
      <header className="list-head">
        <div className="list-head-main">
          <h1 className="list-head-title">
            Questions
            {filteredQuestions && filteredQuestions.length > 0 && (
              <span className="list-head-count">{filteredQuestions.length}</span>
            )}
          </h1>
          <details className="list-head-info">
            <summary aria-label="About questions"><Info size={16} /></summary>
            <p>One reusable bank. Tag each item with a topic and Bloom level so blueprints can draw from it.</p>
          </details>
        </div>
      </header>

      {filteredQuestions === null ? (
        <p className="placeholder">Loading…</p>
      ) : filteredQuestions.length === 0 && !activeFilterCount && !search ? (
        <div className="empty-state">
          <h4>Your question bank is empty</h4>
          <p>Add a question manually, import from GIFT/XML, or auto-generate from a blueprint (TOS) using your uploaded materials.</p>
          <div className="empty-state-actions">
            <button type="button" className="btn btn-primary" onClick={() => setEditing({ type: 'mcq', status: 'draft', subject_id: subjects[0]?.id || '' })}>
              <Plus size={16} /> New Question
            </button>
            <button type="button" className="btn btn-outline">
              <Upload size={16} /> Import
            </button>
            <Link to="/tos" className="btn btn-outline">
              <Sparkles size={16} /> Auto-generate from Blueprint
            </Link>
          </div>
        </div>
      ) : (
        <section className="dataset" data-density="comfortable">
          {/* Toolbar */}
          <div className="dataset-bar">
            <div className="dataset-bar-lead">
              <label className="ds-search" htmlFor="questions-search">
                <Search size={15} />
                <span className="sr-only">Search questions</span>
                <input
                  id="questions-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Search stems and topics…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd aria-hidden="true">/</kbd>
              </label>

              <select
                className="q-filter-select"
                data-active={!!filters.subject_id}
                value={filters.subject_id}
                onChange={(e) => setFilters({ ...filters, subject_id: e.target.value })}
              >
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name} — {s.name}</option>)}
              </select>
              <select
                className="q-filter-select"
                data-active={!!filters.status}
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
              <select
                className="q-filter-select"
                data-active={!!filters.bloom}
                value={filters.bloom}
                onChange={(e) => setFilters({ ...filters, bloom: e.target.value })}
              >
                <option value="">All Bloom</option>
                {BLOOM_ORDER.map((b) => <option key={b} value={b}>{BLOOM_LABELS[b]}</option>)}
              </select>
              <select
                className="q-filter-select"
                data-active={!!filters.type}
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              >
                <option value="">All types</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="dataset-bar-trail">
              <button type="button" className="btn btn-outline btn-sm">
                <Upload size={16} /> Import
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ type: 'mcq', status: 'draft', subject_id: filters.subject_id || (subjects[0]?.id || '') })}>
                <Plus size={16} /> New Question
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="dataset-scroll">
            <table className="grid datatable" data-grid="questions" data-grid-label="questions">
              <caption className="sr-only">Questions in your question bank</caption>
              <thead>
                <tr>
                  <th className="col-select wp-4">
                    <span className="sr-only">Select all rows on this page</span>
                  </th>
                  <th className="col-primary wp-32" data-name="Question" data-locked>Question</th>
                  <th className="wp-16" data-name="Subject">Subject</th>
                  <th className="wp-11" data-name="Bloom">Bloom</th>
                  <th className="wp-12" data-name="Type">Type</th>
                  <th className="wp-10" data-name="Status">Status</th>
                  <th className="wp-10" data-name="Updated">Updated</th>
                  <th className="col-actions wp-5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="ds-noresults">
                      <span className="ds-noresults-title">No questions found</span>
                      <span className="ds-noresults-sub">
                        <button type="button" onClick={() => { setFilters({ subject_id: '', bloom: '', type: '', status: '' }); setSearch(''); }}>
                          Clear filters
                        </button>
                      </span>
                    </td>
                  </tr>
                ) : filteredQuestions.map((q) => {
                  const stem = (q.stem || '').replace(/\s+/g, ' ').trim();
                  const active = q.status === 'active';
                  const level = q.bloom ? BLOOM_LEVELS[q.bloom] || 0 : 0;
                  const subject = q.subject_name || '';
                  const touched = q.updated_at || q.created_at || '';
                  const isAI = q.source === 'ai';
                  return (
                    <tr key={q.id} data-id={q.id}>
                      <td className="col-select" />
                      <td>
                        <span className="g-primary">
                          <button
                            type="button"
                            className="g-title"
                            title={stem}
                            onClick={() => openEdit(q)}
                            style={{ textAlign: 'left', cursor: 'pointer' }}
                          >
                            {stem.length > 120 ? stem.slice(0, 120) + '…' : stem}
                          </button>
                          {q.similarity_flag === 'flagged' && (
                            <Link to={`/questions/${q.id}/similarity`} className="sim-flag" title="Possible duplicate — click to review">
                              <FileText size={12} /> Similar
                            </Link>
                          )}
                          <span className="g-meta">{q.topic || 'No topic'}</span>
                        </span>
                      </td>
                      <td data-order={subject} data-filter={subject}>
                        {subject ? (
                          <span className="g-link" title={subject}>{subject}</span>
                        ) : (
                          <span className="g-mute">—</span>
                        )}
                      </td>
                      <td data-order={level} data-filter={level ? BLOOM_LABELS[q.bloom] : ''}>
                        {level ? (
                          <span className="g-bloom" data-level={level}>{BLOOM_LABELS[q.bloom]}</span>
                        ) : (
                          <span className="g-mute">—</span>
                        )}
                      </td>
                      <td className="g-text" data-filter={TYPE_LABELS[q.type] || q.type}>
                        {TYPE_LABELS[q.type] || q.type}
                      </td>
                      <td data-order={active ? 1 : 0} data-filter={active ? 'Active' : 'Draft'}>
                        <span className={`g-state ${active ? 'is-live' : 'is-draft'}`}>
                          {active ? 'Active' : 'Draft'}
                        </span>
                      </td>
                      <td className="g-mute" data-order={touched}>
                        {touched ? new Date(touched).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="col-actions">
                        {!active && isAI ? (
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              title="Approve"
                              onClick={() => handleApprove(q)}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              title="Reject"
                              onClick={() => handleReject(q)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="g-menu" onMouseLeave={() => setMenuOpen(null)}>
                            <button
                              type="button"
                              className="g-menu-trigger"
                              aria-label={`Actions for ${stem}`}
                              onClick={() => setMenuOpen(menuOpen === q.id ? null : q.id)}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {menuOpen === q.id && (
                              <div className="g-menu-panel">
                                <button type="button" className="g-menu-item" onClick={() => openEdit(q)}>
                                  <Pencil size={15} /> Edit
                                </button>
                                <div className="g-menu-sep" />
                                <button
                                  type="button"
                                  className="g-menu-item is-danger"
                                  onClick={() => handleDelete(q)}
                                >
                                  <Trash2 size={15} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="dataset-foot">
            <div className="ds-range">
              <b>{filteredQuestions.length}</b> question{filteredQuestions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </section>
      )}

      {/* Create/Edit modal — mirrors PHP form.php structure */}
      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Question' : 'New Question'}
        subtitle={editing?.id ? 'Update this item.' : 'Write the stem, options and answer, then tag it so you can find it later.'}
        onClose={() => setEditing(null)}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" form="question-form" type="submit" disabled={saving}>
              {saving && <span className="btn-spinner" />}
              {editing?.id ? 'Save Changes' : 'Create Question'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="question-form" onSubmit={handleSave} noValidate>
            {/* Classification section */}
            <div className="form-section">
              <div className="form-section-title">Classification</div>
              <div className="form-group">
                <label className="form-label" htmlFor="subject_id">Subject <span className="req">*</span></label>
                <select
                  id="subject_id"
                  className="form-control form-select"
                  value={editing.subject_id || ''}
                  onChange={(e) => setEditing({ ...editing, subject_id: e.target.value })}
                  required
                >
                  <option value="" disabled>Select a subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.code ? ` (${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="question-form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="type">Question Type <span className="req">*</span></label>
                  <select
                    id="type"
                    className="form-control form-select"
                    value={editing.type || 'mcq'}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                    required
                  >
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="bloom">Bloom Level</label>
                  <select
                    id="bloom"
                    className="form-control form-select"
                    value={editing.bloom || ''}
                    onChange={(e) => setEditing({ ...editing, bloom: e.target.value })}
                  >
                    <option value="">— Select —</option>
                    {BLOOM_ORDER.map((b) => <option key={b} value={b}>{BLOOM_LABELS[b]}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="topic">Topic</label>
                <input
                  id="topic"
                  type="text"
                  className="form-control"
                  maxLength={255}
                  value={editing.topic || ''}
                  placeholder="e.g. Quadratic Equations"
                  onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
                />
              </div>
            </div>

            {/* Content section */}
            <div className="form-section">
              <div className="form-section-title">Content</div>
              <div className="form-group">
                <label className="form-label" htmlFor="stem">Question Stem <span className="req">*</span></label>
                <textarea
                  id="stem"
                  className="form-control"
                  rows={3}
                  required
                  placeholder="Enter the question text…"
                  value={editing.stem || ''}
                  onChange={(e) => setEditing({ ...editing, stem: e.target.value })}
                />
              </div>

              {editing.type === 'mcq' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="options">
                    Answer Options <span className="form-hint-inline">(one per line)</span>
                  </label>
                  <textarea
                    id="options"
                    className="form-control"
                    rows={5}
                    placeholder={'Option A\nOption B\nOption C\nOption D'}
                    value={editing.optionsText || ''}
                    onChange={(e) => setEditing({ ...editing, optionsText: e.target.value })}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="answer">Answer</label>
                {editing.type === 'true_false' ? (
                  <select
                    id="answer"
                    className="form-control form-select"
                    value={editing.answer || ''}
                    onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                  >
                    <option value="">Select an answer…</option>
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select>
                ) : (
                  <input
                    id="answer"
                    type="text"
                    className="form-control"
                    maxLength={10000}
                    value={editing.answer || ''}
                    placeholder="Enter the expected answer"
                    onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                  />
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="explanation">Explanation</label>
                <textarea
                  id="explanation"
                  className="form-control"
                  rows={3}
                  maxLength={10000}
                  placeholder="Optional explanation shown after answering"
                  value={editing.explanation || ''}
                  onChange={(e) => setEditing({ ...editing, explanation: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="status">Status</label>
                <select
                  id="status"
                  className="form-control form-select"
                  value={editing.status || 'draft'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
