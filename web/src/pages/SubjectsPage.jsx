/**
 * SubjectsPage — grid of instructor subjects with create/edit/delete.
 *
 * A faithful React port of the PHP subjects/index.php view. Uses the same
 * shared grid system (`.dataset`, `table.grid.datatable`, `.g-*` cells) and
 * shared list-page chrome (`.list-head`, `.empty-state`) so the ported
 * grid.css + app.css styles apply directly. CRUD via /api/subjects.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Info, Search, CheckSquare,
  Settings2, Ellipsis, Eye, CircleHelp, Check,
  ChevronUp, ChevronDown, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/subjects.css';

const PAGE_SIZE = 25;
const SORT_DIRS = { asc: 'asc', desc: 'desc' };

/** Trim + collapse internal whitespace, then clip to `len` with an ellipsis. */
function clip(str, len = 90) {
  if (!str) return '';
  const clean = String(str).trim().replace(/\s+/g, ' ');
  if (clean.length <= len) return clean;
  return clean.slice(0, len - 1) + '…';
}

/** Format an ISO date string as "M j, Y". */
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SubjectsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subjects, setSubjects] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} (new) | subject (edit)
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Grid state — search, sort, selection, pagination (client-side, like the
  // PHP DataTables config but in React).
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ col: 'created', dir: SORT_DIRS.desc });
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);
  const searchRef = useRef(null);

  const load = useCallback(() => {
    api.get('/subjects')
      .then((data) => setSubjects(data.subjects))
      .catch((err) => toast.error(err.message || 'Could not load subjects.'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setEditing({ name: '', code: '', description: '' });
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const filtered = useMemo(() => {
    if (!subjects) return [];
    const q = query.trim().toLowerCase();
    let rows = subjects;
    if (q) {
      rows = rows.filter((s) =>
        String(s.name || '').toLowerCase().includes(q) ||
        String(s.code || '').toLowerCase().includes(q));
    }
    const { col, dir } = sort;
    const mul = dir === SORT_DIRS.desc ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      let av, bv;
      switch (col) {
        case 'subject': av = String(a.name || '').toLowerCase(); bv = String(b.name || '').toLowerCase(); break;
        case 'code': av = String(a.code || '').toLowerCase(); bv = String(b.code || '').toLowerCase(); break;
        case 'questions': av = a.question_count || 0; bv = b.question_count || 0; break;
        case 'blueprints': av = a.tos_count || 0; bv = b.tos_count || 0; break;
        case 'exams': av = a.exam_count || 0; bv = b.exam_count || 0; break;
        case 'created': av = a.created_at || ''; bv = b.created_at || ''; break;
        default: av = ''; bv = '';
      }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return rows;
  }, [subjects, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const start = filtered.length ? safePage * PAGE_SIZE + 1 : 0;
  const end = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  function toggleSort(col) {
    setSort((prev) => {
      if (prev.col === col) {
        return { col, dir: prev.dir === SORT_DIRS.asc ? SORT_DIRS.desc : SORT_DIRS.asc };
      }
      return { col, dir: SORT_DIRS.asc };
    });
    setPage(0);
  }

  function sortClass(col) {
    if (sort.col !== col) return 'sorting';
    return sort.dir === SORT_DIRS.asc ? 'sorting_asc' : 'sorting_desc';
  }

  function toggleSelectMode() {
    setSelectMode((v) => {
      if (!v) setSelected(new Set());
      return !v;
    });
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (pageRows.every((s) => selected.has(s.id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        pageRows.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        pageRows.forEach((s) => next.add(s.id));
        return next;
      });
    }
  }

  const allChecked = pageRows.length > 0 && pageRows.every((s) => selected.has(s.id));
  const someChecked = pageRows.some((s) => selected.has(s.id)) && !allChecked;

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
      setSelected((prev) => { const n = new Set(prev); n.delete(subject.id); return n; });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    setDeleting({ bulk: true });
    try {
      const data = await api.post('/subjects/bulk-delete', { ids });
      toast.success(`${data.deleted || ids.length} subject${(data.deleted || ids.length) === 1 ? '' : 's'} deleted.`);
      setSelected(new Set());
      setSelectMode(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  const openNew = () => setEditing({ name: '', code: '', description: '' });

  const renderSortArrow = (col) => {
    if (sort.col !== col) return null;
    return sort.dir === SORT_DIRS.asc
      ? <span className="ds-sort"><ChevronUp size={13} /></span>
      : <span className="ds-sort"><ChevronDown size={13} /></span>;
  };

  return (
    <AppShell activeNav="subjects" pageTitle="Subjects" wide>
      <header className="list-head">
        <div className="list-head-main">
          <h1 className="list-head-title">
            Subjects
            {subjects && subjects.length > 0 && (
              <span className="list-head-count">{subjects.length}</span>
            )}
          </h1>
          <details className="list-head-info">
            <summary aria-label="What are subjects?"><Info size={16} /></summary>
            <p>Courses you teach. Each subject owns its own question bank, blueprints and exams.</p>
          </details>
        </div>
      </header>

      {subjects === null ? (
        <p className="placeholder">Loading…</p>
      ) : subjects.length === 0 ? (
        <div className="empty-state">
          <h4>No subjects yet</h4>
          <p>A subject is the container for everything else — create one and the question bank, blueprints and exams follow.</p>
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> New Subject
          </button>
        </div>
      ) : (
        <section className="dataset" data-dataset data-density="comfortable" data-selecting={selectMode ? 'true' : 'false'}>

          {/* Toolbar */}
          <div className="dataset-bar">
            <div className="dataset-bar-lead">
              <label className="ds-search" htmlFor="subjects-search">
                <Search size={15} />
                <span className="sr-only">Search subjects</span>
                <input
                  id="subjects-search"
                  ref={searchRef}
                  type="search"
                  autoComplete="off"
                  placeholder="Search by name or code…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                />
                <kbd aria-hidden="true">/</kbd>
              </label>
            </div>

            <div className="dataset-bar-trail">
              <button type="button" className="ds-btn" onClick={toggleSelectMode} aria-pressed={selectMode}>
                <CheckSquare size={15} /> Select
              </button>
              <div className="ds-menu">
                <button type="button" className="ds-btn" aria-expanded={viewOpen} aria-haspopup="true" onClick={() => setViewOpen((v) => !v)}>
                  <Settings2 size={15} /> Options
                </button>
                {viewOpen && (
                  <div className="ds-menu-panel" role="group" aria-label="Table options">
                    <div className="ds-menu-label">Density</div>
                    <div className="ds-seg">
                      <button aria-pressed={false} onClick={() => setViewOpen(false)}>Comfortable</button>
                      <button aria-pressed={false} onClick={() => setViewOpen(false)}>Compact</button>
                    </div>
                  </div>
                )}
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>
                <Plus size={14} /> New Subject
              </button>
            </div>
          </div>

          {/* Selection bar — replaces the toolbar while rows are checked */}
          {selectMode && (
            <div className="dataset-select-bar">
              <span className="ds-select-count" aria-live="polite">{selected.size} selected</span>
              <button type="button" className="ds-btn is-danger" onClick={handleBulkDelete} disabled={!selected.size || !!deleting?.bulk}>
                <Trash2 size={15} /> Delete
              </button>
              <button type="button" className="ds-btn" onClick={() => { setSelected(new Set()); setSelectMode(false); }}>Clear</button>
            </div>
          )}

          {/* Scroll container + grid */}
          <div className="dataset-scroll">
            <table className="grid datatable" data-grid="subjects" data-grid-label="subjects">
              <caption className="sr-only">Subjects in your workspace</caption>
              <thead>
                <tr>
                  <th className="col-select wp-4">
                    {selectMode && (
                      <label className="ds-check">
                        <input type="checkbox" checked={allChecked} ref={(el) => { if (el) el.indeterminate = someChecked; }} onChange={toggleAll} />
                        <span aria-hidden="true" />
                        <span className="sr-only">Select all rows on this page</span>
                      </label>
                    )}
                  </th>
                  <th className={`col-primary wp-33 ${sortClass('subject')}`} onClick={() => toggleSort('subject')} data-name="Subject" data-locked>
                    Subject{renderSortArrow('subject')}
                  </th>
                  <th className={`wp-12 ${sortClass('code')}`} onClick={() => toggleSort('code')} data-name="Code">Code{renderSortArrow('code')}</th>
                  <th className={`is-num wp-12 ${sortClass('questions')}`} onClick={() => toggleSort('questions')} data-name="Questions">Questions{renderSortArrow('questions')}</th>
                  <th className={`is-num wp-12 ${sortClass('blueprints')}`} onClick={() => toggleSort('blueprints')} data-name="Blueprints">Blueprints{renderSortArrow('blueprints')}</th>
                  <th className={`is-num wp-10 ${sortClass('exams')}`} onClick={() => toggleSort('exams')} data-name="Exams">Exams{renderSortArrow('exams')}</th>
                  <th className={`wp-12 ${sortClass('created')}`} onClick={() => toggleSort('created')} data-name="Created">Created{renderSortArrow('created')}</th>
                  <th className="col-actions wp-5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td className="ds-noresults" colSpan={8}>
                      <span className="ds-noresults-title">No subjects found</span>
                      <span className="ds-noresults-sub">
                        {query ? <>Try a different search or <button onClick={() => setQuery('')}>clear it</button>.</> : 'No subjects match.'}
                      </span>
                    </td>
                  </tr>
                ) : pageRows.map((s) => {
                  const q = s.question_count || 0;
                  const t = s.tos_count || 0;
                  const e = s.exam_count || 0;
                  const desc = s.description ? clip(s.description, 90) : 'No description';
                  const descTitle = s.description ? clip(s.description, 200) : '';
                  return (
                    <tr key={s.id} data-id={s.id} className={selected.has(s.id) ? 'is-selected' : ''}>
                      <td className="col-select">
                        {selectMode && (
                          <label className="ds-check">
                            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleRow(s.id)} />
                            <span aria-hidden="true" />
                            <span className="sr-only">Select {s.name}</span>
                          </label>
                        )}
                      </td>
                      <td>
                        <span className="g-primary">
                          <Link to={`/subjects/${encodeURIComponent(s.id)}`} className="g-title">{s.name}</Link>
                          <span className="g-meta" title={descTitle}>{desc}</span>
                        </span>
                      </td>
                      <td>
                        {s.code
                          ? <span className="g-code">{s.code}</span>
                          : <span className="g-mute">—</span>}
                      </td>
                      <td className="is-num" data-order={q}>
                        <span className={`g-count${q ? '' : ' is-zero'}`}>{q || '—'}</span>
                      </td>
                      <td className="is-num" data-order={t}>
                        <span className={`g-count${t ? '' : ' is-zero'}`}>{t || '—'}</span>
                      </td>
                      <td className="is-num" data-order={e}>
                        <span className={`g-count${e ? '' : ' is-zero'}`}>{e || '—'}</span>
                      </td>
                      <td className="g-mute" data-order={s.created_at}>{fmtDate(s.created_at)}</td>
                      <td className="col-actions">
                        <details className="g-menu">
                          <summary className="g-menu-trigger" aria-label={`Actions for ${s.name}`}><Ellipsis size={16} /></summary>
                          <div className="g-menu-panel">
                            <Link to={`/subjects/${encodeURIComponent(s.id)}`} className="g-menu-item"><Eye size={15} /> Open</Link>
                            <button type="button" className="g-menu-item" onClick={() => setEditing(s)}><Pencil size={15} /> Edit</button>
                            <Link to={`/questions?subject_id=${encodeURIComponent(s.id)}`} className="g-menu-item"><CircleHelp size={15} /> Questions</Link>
                            <div className="g-menu-sep" />
                            <button type="button" className="g-menu-item is-danger" onClick={() => handleDelete(s)} disabled={deleting?.id === s.id}>
                              <Trash2 size={15} /> Delete
                            </button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer — range + pagination */}
          <div className="dataset-foot">
            <div className="ds-range">
              <b>{start}</b>–<b>{end}</b> of <b>{filtered.length}</b>
            </div>
            <div className="ds-pager">
              <button type="button" className="ds-page" onClick={() => setPage(0)} disabled={safePage === 0} aria-label="First page">
                <ChevronFirst size={15} />
              </button>
              <button type="button" className="ds-page" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} aria-label="Previous page">
                <ChevronLeft size={15} />
              </button>
              <span className="ds-page" aria-current="page">{safePage + 1}</span>
              <span className="ds-gap">/</span>
              <span className="ds-page">{pageCount}</span>
              <button type="button" className="ds-page" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} aria-label="Next page">
                <ChevronRight size={15} />
              </button>
              <button type="button" className="ds-page" onClick={() => setPage(pageCount - 1)} disabled={safePage >= pageCount - 1} aria-label="Last page">
                <ChevronLast size={15} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Create/Edit modal — styled to match subjects/form.php */}
      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Subject' : 'New Subject'}
        subtitle={editing?.id ? 'Update the course details.' : 'Add a course to group your questions, blueprints and exams.'}
        onClose={() => setEditing(null)}
        size="md"
      >
        {editing && (
          <div className="form-container">
            <div className="card">
              <div className="card-body">
                <form id="subject-form" onSubmit={handleSave} noValidate>
                  <div className="form-group">
                    <label className="form-label" htmlFor="name">Subject Name <span className="req">*</span></label>
                    <input id="name" name="name" className="form-control" required maxLength={255}
                      value={editing.name || ''} autoComplete="off" autoFocus
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="code">Subject Code</label>
                    <input id="code" name="code" className="form-control" maxLength={50}
                      placeholder="e.g. CS-101"
                      value={editing.code || ''}
                      onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="description">Description</label>
                    <textarea id="description" name="description" className="form-control" rows={3} maxLength={5000}
                      placeholder="Optional description"
                      value={editing.description || ''}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  </div>
                  <div className="form-actions form-actions--sticky">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? <span className="btn-spinner" /> : <Check size={16} />} {editing.id ? 'Save Changes' : 'Create Subject'}
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
