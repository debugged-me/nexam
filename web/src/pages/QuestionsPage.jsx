/**
 * QuestionsPage — question bank grid with filters, bulk review, create/edit,
 * GIFT/XML import and similarity review.
 *
 * Faithful React port of application/views/questions/index.php + form.php.
 * Uses the same class names as the PHP app for strict visual parity.
 *
 * Review economics: an AI run drops dozens of drafts into the bank at once, so
 * the grid is built around deciding on many rows at a time — row checkboxes
 * (with shift-click ranges), a selection bar that replaces the toolbar, and a
 * one-click approve/reject on every draft row regardless of how it got here.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Check, X, Info, Search, Upload, Sparkles,
  MoreVertical, FileText, ListChecks, RotateCcw, FilterX,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/questions.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const BLOOM_LEVELS = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };
// Display labels only. The keys are the wire values shared with the API, the
// OMR scoring service and the Flutter app — never rename a key.
const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / false', matching: 'Matching type', identification: 'Fill in the blank' };

// The status vocabulary is exactly draft | active | rejected. 'rejected' is a
// soft status — the row stays so AI-eval precision keeps counting instructor
// decisions — so it needs its own cell state, not a fallback to "Draft".
const STATUS_META = {
  active:   { label: 'Active',   cls: 'is-live',     order: 2 },
  draft:    { label: 'Draft',    cls: 'is-draft',    order: 1 },
  rejected: { label: 'Rejected', cls: 'is-rejected', order: 0 },
};

const IMPORT_FORMATS = { gift: 'GIFT (Moodle)', xml: 'Canvas / QTI XML' };

/** Read a picked file as text (File.text() where available, FileReader else). */
function readFileText(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}

/** Guess the import format from a filename; null when the extension says nothing. */
function formatFromName(name) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  if (ext === 'xml') return 'xml';
  if (ext === 'gift' || ext === 'txt') return 'gift';
  return null;
}

export default function QuestionsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [tosList, setTosList] = useState([]);
  const [filters, setFilters] = useState({ subject_id: '', bloom: '', type: '', status: '', tos_id: '', topic: '' });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(null); // null | 'approve' | 'reject' | 'delete'
  const [importState, setImportState] = useState(null);
  const [importing, setImporting] = useState(false);
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const lastPickedRef = useRef(null); // anchor row index for shift-click ranges

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.subject_id) params.set('subject_id', filters.subject_id);
    if (filters.bloom) params.set('bloom', filters.bloom);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (filters.tos_id) params.set('tos_id', filters.tos_id);
    api.get(`/questions?${params}`)
      .then((data) => setQuestions(data.questions))
      .catch((err) => toast.error(err.message || 'Could not load questions.'));
  }, [filters, toast]);

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects)).catch(() => {});
    api.get('/tos').then((data) => setTosList(data.tos || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const requestedStatus = searchParams.get('status');
    const requestedSubject = searchParams.get('subject_id');
    if (requestedSubject && subjects.some((subject) => String(subject.id) === requestedSubject)) {
      setFilters((current) => current.subject_id === requestedSubject ? current : { ...current, subject_id: requestedSubject, tos_id: '' });
    }
    if (['draft', 'active', 'rejected'].includes(requestedStatus)) {
      setFilters((current) => current.status === requestedStatus ? current : { ...current, status: requestedStatus });
    }
    if (searchParams.get('new') === '1') {
      setEditing({ type: 'mcq', status: 'draft', subject_id: subjects[0]?.id || '' });
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, subjects]);

  useEffect(() => { load(); }, [load]);

  // "/" focuses the search field, mirroring the kbd hint in the toolbar.
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close the open row menu on any outside press — mouse-leave alone strands
  // the panel open on touch.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e) {
      if (!menuRef.current || !menuRef.current.contains(e.target)) setMenuOpen(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // Topic options come from what is actually loaded — no extra endpoint. The
  // current topic stays in the list even when nothing matches it any more, so
  // the filter can always be cleared from the control itself.
  const topicOptions = useMemo(() => {
    const seen = new Set();
    (questions || []).forEach((q) => { if (q.topic) seen.add(q.topic); });
    if (filters.topic) seen.add(filters.topic);
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [questions, filters.topic]);

  // Client-side search + topic filter (mirrors DataTables search)
  const filteredQuestions = useMemo(() => {
    if (!questions) return null;
    let rows = questions;
    if (filters.topic) rows = rows.filter((item) => (item.topic || '') === filters.topic);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((item) =>
        (item.stem || '').toLowerCase().includes(q) ||
        (item.topic || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [questions, search, filters.topic]);

  const activeFilterCount = [filters.subject_id, filters.bloom, filters.type, filters.status, filters.tos_id, filters.topic].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setFilters({ subject_id: '', bloom: '', type: '', status: '', tos_id: '', topic: '' });
    setSearch('');
  }, []);

  // Blueprints are scoped to the chosen subject when there is one, so the
  // TOS select never offers a blueprint that can't match a visible row.
  const tosOptions = useMemo(
    () => tosList.filter((t) => !filters.subject_id || t.subject_id === filters.subject_id),
    [tosList, filters.subject_id]
  );

  const draftCount = useMemo(
    () => (questions || []).filter((q) => q.status === 'draft').length,
    [questions]
  );

  const rows = useMemo(() => filteredQuestions || [], [filteredQuestions]);

  // Selection is always read back through the visible rows, so a row the user
  // cannot see can never be swept into a bulk action by a filter or a search.
  const selectedRows = useMemo(() => rows.filter((q) => selected.has(q.id)), [rows, selected]);
  const selectionCount = selectedRows.length;
  const approvableCount = selectedRows.filter((q) => q.status === 'draft').length;
  const rejectableCount = selectedRows.filter((q) => q.status !== 'rejected').length;
  const allChecked = rows.length > 0 && selectionCount === rows.length;
  const someChecked = selectionCount > 0 && !allChecked;

  /** Toggle one row; shift-click applies the new state across the range. */
  function toggleRow(index, shiftKey) {
    const row = rows[index];
    if (!row) return;
    const turningOn = !selected.has(row.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const anchor = lastPickedRef.current;
      const from = shiftKey && anchor !== null && anchor < rows.length ? Math.min(anchor, index) : index;
      const to = shiftKey && anchor !== null && anchor < rows.length ? Math.max(anchor, index) : index;
      for (let i = from; i <= to; i += 1) {
        const id = rows[i]?.id;
        if (!id) continue;
        if (turningOn) next.add(id); else next.delete(id);
      }
      return next;
    });
    lastPickedRef.current = index;
  }

  /** Select-all covers the filtered rows only — never rows off-screen. */
  function toggleAll() {
    lastPickedRef.current = null;
    const turningOn = selectionCount !== rows.length;
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((q) => { if (turningOn) next.add(q.id); else next.delete(q.id); });
      return next;
    });
  }

  function clearSelection() {
    lastPickedRef.current = null;
    setSelected(new Set());
  }

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
    setMenuOpen(null);
    try { await api.post(`/questions/${q.id}/approve`); toast.success('Question approved.'); load(); }
    catch (err) { toast.error(err.message || 'Approve failed.'); }
  }
  async function handleReject(q) {
    setMenuOpen(null);
    try { await api.post(`/questions/${q.id}/reject`); toast.success('Question rejected.'); load(); }
    catch (err) { toast.error(err.message || 'Reject failed.'); }
  }
  async function handleDelete(q) {
    setMenuOpen(null);
    if (!confirm('Delete this question? This cannot be undone.')) return;
    try { await api.del(`/questions/${q.id}`); toast.success('Question deleted.'); load(); }
    catch (err) { toast.error(err.message || 'Delete failed.'); }
  }

  /**
   * Report what the server actually did, not what was asked. bulk-approve only
   * moves drafts, so a 20-row selection with 8 active rows comes back with
   * approved:12 — the toast has to say 12.
   */
  function reportBulk(done, asked, verb, noun) {
    if (!done) {
      toast.warning(`No questions were ${verb} — ${noun}`);
      return;
    }
    if (done < asked) {
      toast.warning(`${done} of ${asked} selected question${asked === 1 ? '' : 's'} ${verb} — ${noun}`);
      return;
    }
    toast.success(`${done} question${done === 1 ? '' : 's'} ${verb}.`);
  }

  async function handleBulkApprove() {
    const ids = selectedRows.map((q) => q.id);
    if (!ids.length) return;
    setBulkBusy('approve');
    try {
      const data = await api.post('/questions/bulk-approve', { ids });
      reportBulk(data?.approved || 0, ids.length, 'approved', 'approving only affects drafts.');
      clearSelection();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Approve failed.');
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleBulkReject() {
    const ids = selectedRows.map((q) => q.id);
    if (!ids.length) return;
    setBulkBusy('reject');
    try {
      const data = await api.post('/questions/bulk-reject', { ids });
      reportBulk(data?.rejected || 0, ids.length, 'rejected', 'the rest were already rejected.');
      clearSelection();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Reject failed.');
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleBulkDelete() {
    const ids = selectedRows.map((q) => q.id);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} question${ids.length === 1 ? '' : 's'}? This cannot be undone — reject instead if you want to keep the record.`)) return;
    setBulkBusy('delete');
    try {
      const data = await api.post('/questions/bulk-delete', { ids });
      reportBulk(data?.deleted || 0, ids.length, 'deleted', 'they may already be gone.');
      clearSelection();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.');
    } finally {
      setBulkBusy(null);
    }
  }

  function openEdit(q) {
    setMenuOpen(null);
    setEditing({ ...q, optionsText: Array.isArray(q.options) ? q.options.join('\n') : '' });
  }

  function openImport() {
    setMenuOpen(null);
    setImportState({
      format: 'gift',
      content: '',
      fileName: '',
      subjectId: filters.subject_id || subjects[0]?.id || '',
      bloom: '',
      topic: '',
    });
  }

  async function handleImportFile(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const guessed = formatFromName(file.name);
    try {
      const text = await readFileText(file);
      setImportState((prev) => (prev ? { ...prev, content: text, fileName: file.name, format: guessed || prev.format } : prev));
    } catch (err) {
      toast.error(err?.message || 'Could not read that file.');
    } finally {
      input.value = ''; // let the same file be picked again after an edit
    }
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importState) return;
    const content = (importState.content || '').trim();
    if (!importState.subjectId) { toast.error('Choose the subject these questions belong to.'); return; }
    if (content.length < 10) { toast.error('Choose a file or paste the question text first.'); return; }
    setImporting(true);
    try {
      const data = await api.post('/questions/import', {
        format: importState.format,
        content,
        subjectId: importState.subjectId,
        bloom: importState.bloom || undefined,
        topic: importState.topic?.trim() || undefined,
      });
      const n = data?.imported || 0;
      toast.success(`${n} question${n === 1 ? '' : 's'} imported as draft${n === 1 ? '' : 's'}.`);
      setImportState(null);
      load();
    } catch (err) {
      // The parser's messages name the offending line — pass them through.
      toast.error(err instanceof ApiError ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  const selecting = selectionCount > 0;

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
        {draftCount > 0 && (
          <div className="list-head-actions">
            <Link to="/questions/review" className="btn btn-primary btn-sm q-review-cta">
              <ListChecks size={15} /> Review {draftCount} draft{draftCount === 1 ? '' : 's'}
            </Link>
          </div>
        )}
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
            <button type="button" className="btn btn-outline" onClick={openImport}>
              <Upload size={16} /> Import
            </button>
            <Link to="/tos" className="btn btn-outline">
              <Sparkles size={16} /> Auto-generate from Blueprint
            </Link>
          </div>
        </div>
      ) : (
        <section
          className="dataset q-dataset"
          data-density="comfortable"
          data-select-mode="true"
          data-selecting={selecting ? 'true' : 'false'}
        >
          {/* Toolbar */}
          <div className="dataset-bar">
            <div className="dataset-bar-lead">
              <label className="ds-search" htmlFor="questions-search">
                <Search size={15} />
                <span className="sr-only">Search questions</span>
                <input
                  id="questions-search"
                  ref={searchRef}
                  type="search"
                  autoComplete="off"
                  placeholder="Search stems and topics…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd aria-hidden="true">/</kbd>
              </label>

              <div className="q-filters">
                <select
                  className="q-filter-select"
                  aria-label="Filter by subject"
                  data-active={!!filters.subject_id}
                  value={filters.subject_id}
                  onChange={(e) => setFilters({ ...filters, subject_id: e.target.value, tos_id: '' })}
                >
                  <option value="">All subjects</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name} — {s.name}</option>)}
                </select>
                <select
                  className="q-filter-select"
                  aria-label="Filter by blueprint"
                  data-active={!!filters.tos_id}
                  value={filters.tos_id}
                  onChange={(e) => setFilters({ ...filters, tos_id: e.target.value })}
                >
                  <option value="">All blueprints</option>
                  {tosOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <select
                  className="q-filter-select"
                  aria-label="Filter by topic"
                  data-active={!!filters.topic}
                  value={filters.topic}
                  onChange={(e) => setFilters({ ...filters, topic: e.target.value })}
                >
                  <option value="">All topics</option>
                  {topicOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                  className="q-filter-select"
                  aria-label="Filter by status"
                  data-active={!!filters.status}
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select
                  className="q-filter-select"
                  aria-label="Filter by Bloom level"
                  data-active={!!filters.bloom}
                  value={filters.bloom}
                  onChange={(e) => setFilters({ ...filters, bloom: e.target.value })}
                >
                  <option value="">All Bloom</option>
                  {BLOOM_ORDER.map((b) => <option key={b} value={b}>{BLOOM_LABELS[b]}</option>)}
                </select>
                <select
                  className="q-filter-select"
                  aria-label="Filter by question type"
                  data-active={!!filters.type}
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                >
                  <option value="">All types</option>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {(activeFilterCount > 0 || search) && (
                  <button type="button" className="ds-filter-clear" onClick={clearFilters}>
                    <FilterX size={12} /> Clear
                  </button>
                )}
              </div>
            </div>

            <div className="dataset-bar-trail">
              <button type="button" className="btn btn-outline btn-sm" onClick={openImport}>
                <Upload size={16} /> Import
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ type: 'mcq', status: 'draft', subject_id: filters.subject_id || (subjects[0]?.id || '') })}>
                <Plus size={16} /> New Question
              </button>
            </div>
          </div>

          {/* Selection bar — replaces the toolbar while rows are checked */}
          {selecting && (
            <div className="dataset-select-bar">
              <span className="ds-select-count" aria-live="polite">{selectionCount} selected</span>
              <button
                type="button"
                className="ds-btn"
                onClick={handleBulkApprove}
                disabled={!!bulkBusy || !approvableCount}
                title={approvableCount ? `Approve ${approvableCount} draft${approvableCount === 1 ? '' : 's'}` : 'Nothing in this selection is a draft'}
              >
                <Check size={15} /> Approve {approvableCount}
              </button>
              <button
                type="button"
                className="ds-btn"
                onClick={handleBulkReject}
                disabled={!!bulkBusy || !rejectableCount}
                title={rejectableCount ? `Reject ${rejectableCount} question${rejectableCount === 1 ? '' : 's'}` : 'Everything selected is already rejected'}
              >
                <X size={15} /> Reject {rejectableCount}
              </button>
              <button type="button" className="ds-btn is-danger" onClick={handleBulkDelete} disabled={!!bulkBusy}>
                <Trash2 size={15} /> Delete {selectionCount}
              </button>
              <button type="button" className="ds-btn" onClick={clearSelection} disabled={!!bulkBusy}>Clear</button>
            </div>
          )}

          {/* Grid */}
          <div className="dataset-scroll">
            <table className="grid datatable" data-grid="questions" data-grid-label="questions">
              <caption className="sr-only">Questions in your question bank</caption>
              <thead>
                <tr>
                  <th className="col-select wp-4">
                    <label className="ds-check">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        disabled={rows.length === 0}
                        ref={(el) => { if (el) el.indeterminate = someChecked; }}
                        onChange={toggleAll}
                      />
                      <span aria-hidden="true" />
                      <span className="sr-only">Select all matching rows</span>
                    </label>
                  </th>
                  <th className="col-primary wp-31" data-name="Question" data-locked>Question</th>
                  <th className="wp-14" data-name="Subject">Subject</th>
                  <th className="wp-10" data-name="Bloom">Bloom</th>
                  <th className="wp-12" data-name="Type">Type</th>
                  <th className="wp-10" data-name="Status">Status</th>
                  <th className="wp-8" data-name="Updated">Updated</th>
                  <th className="col-actions wp-11"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="ds-noresults">
                      <span className="ds-noresults-title">No questions found</span>
                      <span className="ds-noresults-sub">
                        <button type="button" onClick={clearFilters}>
                          Clear filters
                        </button>
                      </span>
                    </td>
                  </tr>
                ) : rows.map((q, index) => {
                  const stem = (q.stem || '').replace(/\s+/g, ' ').trim();
                  const status = STATUS_META[q.status] || STATUS_META.draft;
                  const isDraft = q.status === 'draft';
                  const isRejected = q.status === 'rejected';
                  const level = q.bloom ? BLOOM_LEVELS[q.bloom] || 0 : 0;
                  const subject = q.subject_name || '';
                  const touched = q.updated_at || q.created_at || '';
                  const isChecked = selected.has(q.id);
                  return (
                    <tr key={q.id} data-id={q.id} className={isChecked ? 'is-selected' : ''}>
                      <td className="col-select">
                        <label className="ds-check">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleRow(index, e.nativeEvent?.shiftKey === true)}
                          />
                          <span aria-hidden="true" />
                          <span className="sr-only">Select “{stem.slice(0, 60)}”</span>
                        </label>
                      </td>
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
                      <td data-order={status.order} data-filter={status.label}>
                        <span className={`g-state ${status.cls}`}>{status.label}</span>
                      </td>
                      <td className="g-mute" data-order={touched}>
                        {touched ? new Date(touched).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="col-actions">
                        <div className="row-actions">
                          {/* Every draft gets the one-click decision, however it
                              was written — AI, manual or imported. A rejected
                              row gets a one-click way back. */}
                          {isDraft && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                title="Approve"
                                aria-label={`Approve “${stem.slice(0, 60)}”`}
                                onClick={() => handleApprove(q)}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                title="Reject"
                                aria-label={`Reject “${stem.slice(0, 60)}”`}
                                onClick={() => handleReject(q)}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          {isRejected && (
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              title="Restore — make this question active again"
                              aria-label={`Restore “${stem.slice(0, 60)}”`}
                              onClick={() => handleApprove(q)}
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                          <div className="g-menu" ref={menuOpen === q.id ? menuRef : null}>
                            <button
                              type="button"
                              className="g-menu-trigger"
                              aria-label={`Actions for ${stem}`}
                              aria-expanded={menuOpen === q.id}
                              onClick={() => setMenuOpen(menuOpen === q.id ? null : q.id)}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {menuOpen === q.id && (
                              <div className="g-menu-panel">
                                <button type="button" className="g-menu-item" onClick={() => openEdit(q)}>
                                  <Pencil size={15} /> Edit
                                </button>
                                {/* Drafts and rejected rows already carry their
                                    decision inline, so the menu only adds it
                                    for an active question. */}
                                {!isDraft && !isRejected && (
                                  <button type="button" className="g-menu-item" onClick={() => handleReject(q)}>
                                    <X size={15} /> Reject
                                  </button>
                                )}
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
                        </div>
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
              <b>{rows.length}</b> question{rows.length !== 1 ? 's' : ''}
              {selecting && <span className="q-foot-note"> · {selectionCount} selected</span>}
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
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Import modal — GIFT / Canvas XML into drafts */}
      <Modal
        open={!!importState}
        title="Import Questions"
        subtitle="Paste or upload a GIFT or Canvas XML bank. Everything lands as a draft for review."
        onClose={() => setImportState(null)}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setImportState(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              form="question-import-form"
              type="submit"
              disabled={importing || !importState?.subjectId || (importState?.content || '').trim().length < 10}
            >
              {importing && <span className="btn-spinner" />}
              Import Questions
            </button>
          </>
        }
      >
        {importState && (
          <form id="question-import-form" onSubmit={handleImport} noValidate>
            <div className="form-section">
              <div className="form-section-title">Destination</div>
              <div className="form-group">
                <label className="form-label" htmlFor="import-subject">Subject <span className="req">*</span></label>
                <select
                  id="import-subject"
                  className="form-control form-select"
                  value={importState.subjectId}
                  onChange={(e) => setImportState({ ...importState, subjectId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select a subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                  ))}
                </select>
                {subjects.length === 0 && (
                  <p className="form-hint">
                    You have no subjects yet — <Link to="/subjects">create one first</Link>.
                  </p>
                )}
              </div>

              <div className="question-form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="import-bloom">Default Bloom Level</label>
                  <select
                    id="import-bloom"
                    className="form-control form-select"
                    value={importState.bloom}
                    onChange={(e) => setImportState({ ...importState, bloom: e.target.value })}
                  >
                    <option value="">Remember (default)</option>
                    {BLOOM_ORDER.map((b) => <option key={b} value={b}>{BLOOM_LABELS[b]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="import-topic">Default Topic</label>
                  <input
                    id="import-topic"
                    type="text"
                    className="form-control"
                    maxLength={255}
                    placeholder="Applied when the file has none"
                    value={importState.topic}
                    onChange={(e) => setImportState({ ...importState, topic: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Source</div>

              <div className="q-import-source">
                <label className="btn btn-outline q-import-pick" htmlFor="import-file">
                  <Upload size={16} /> Choose file
                  <input
                    id="import-file"
                    type="file"
                    accept=".txt,.gift,.xml,text/plain,text/xml,application/xml"
                    onChange={handleImportFile}
                  />
                </label>
                <span className="q-import-filename">
                  {importState.fileName || 'No file chosen — you can paste below instead.'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="import-format">Format <span className="req">*</span></label>
                <select
                  id="import-format"
                  className="form-control form-select"
                  value={importState.format}
                  onChange={(e) => setImportState({ ...importState, format: e.target.value })}
                  required
                >
                  {Object.entries(IMPORT_FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <p className="form-hint">Guessed from the file extension — override it if the guess is wrong.</p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="import-content">
                  Content <span className="form-hint-inline">(paste or loaded from the file)</span>
                </label>
                <textarea
                  id="import-content"
                  className="form-control q-import-textarea"
                  rows={9}
                  spellCheck="false"
                  placeholder={'::Q1:: What is the capital of France? {=Paris ~Lyon ~Nice ~Brest}'}
                  value={importState.content}
                  onChange={(e) => setImportState({ ...importState, content: e.target.value, fileName: '' })}
                />
              </div>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
