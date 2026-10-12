import '../styles/subjects.css';
/**
 * SubjectsPage — grid of instructor subjects with create/edit/delete.
 *
 * Subject workspace using the shared data-grid system. CRUD via /api/subjects.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Search, CheckSquare, BookOpen,
  Eye, Check, Copy, Ellipsis, Info, CircleHelp, PanelsTopLeft, FileText,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useGridTable, DatasetFoot } from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import DetailsModal from '../components/DetailsModal.jsx';
import Tooltip from '../components/Tooltip.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import { animateRows } from '../lib/animRows.js';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import { groupColor, StatCard } from '../components/Board.jsx';

const PAGE_SIZE = 25;

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
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subjects, setSubjects] = useState(() => api.peek('/subjects')?.subjects ?? null);
  const [editing, setEditing] = useState(null); // null | {} (new) | subject (edit)
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Grid state — search + selection are local; sort/filter/pagination live in
  // the headless table instance (same DOM and classes as before).
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

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

  const columns = useMemo(() => [
    { id: 'select', enableSorting: false },
    { id: 'subject', accessorFn: (s) => String(s.name || '').toLowerCase() },
    { id: 'code', accessorFn: (s) => String(s.code || '').toLowerCase() },
    { id: 'questions', accessorKey: 'question_count' },
    { id: 'blueprints', accessorKey: 'tos_count' },
    { id: 'exams', accessorKey: 'exam_count' },
    { id: 'created', accessorKey: 'created_at' },
    { id: 'actions', enableSorting: false },
  ], []);

  const grid = useGridTable({
    data: subjects || [],
    columns,
    pageSize: PAGE_SIZE,
    storageKey: 'subjects',
    initialSorting: [{ id: 'created', desc: true }],
    globalFilter: query,
    globalFilterFn: (row, _col, value) =>
      `${row.original.name || ''} ${row.original.code || ''}`
        .toLowerCase()
        .includes(String(value).toLowerCase()),
  });
  const { pageRows, sortClass, sortHandler, renderSortArrow } = grid;

  // KPI row — totals across every subject, mirroring the dashboard metrics.
  const subjStats = useMemo(() => (subjects || []).reduce(
    (acc, s) => ({
      questions: acc.questions + (Number(s.question_count) || 0),
      blueprints: acc.blueprints + (Number(s.tos_count) || 0),
      exams: acc.exams + (Number(s.exam_count) || 0),
    }),
    { questions: 0, blueprints: 0, exams: 0 },
  ), [subjects]);

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
    // The cascade removes everything inside the subject — name the contents
    // so the confirm isn't a blind "are you sure?".
    const parts = [
      Number(subject.exam_count) && `${Number(subject.exam_count)} exam${Number(subject.exam_count) === 1 ? '' : 's'}`,
      Number(subject.tos_count) && `${Number(subject.tos_count)} blueprint${Number(subject.tos_count) === 1 ? '' : 's'}`,
      Number(subject.question_count) && `${Number(subject.question_count)} question${Number(subject.question_count) === 1 ? '' : 's'}`,
    ].filter(Boolean);
    const detail = parts.length
      ? ` Its ${parts.join(', ')} — including any scanned results — are permanently deleted.`
      : '';
    if (!(await confirm(`Delete "${subject.name}"?${detail} This cannot be undone.`, { title: 'Delete subject', confirmText: parts.length ? 'Delete everything' : 'Delete' }))) return;
    setDeleting(subject);
    try {
      await api.del(`/subjects/${subject.id}?cascade=1`);
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
    // Aggregate the selected subjects' contents so the confirm states the
    // real cost — the cascade wipes everything inside each subject.
    const chosen = (subjects || []).filter((s) => selected.has(s.id));
    const nE = chosen.reduce((a, s) => a + (Number(s.exam_count) || 0), 0);
    const nB = chosen.reduce((a, s) => a + (Number(s.tos_count) || 0), 0);
    const nQ = chosen.reduce((a, s) => a + (Number(s.question_count) || 0), 0);
    const detail = (nE || nB || nQ)
      ? ` They contain ${[
          nE && `${nE} exam${nE === 1 ? '' : 's'}`,
          nB && `${nB} blueprint${nB === 1 ? '' : 's'}`,
          nQ && `${nQ} question${nQ === 1 ? '' : 's'}`,
        ].filter(Boolean).join(', ')} — including any scanned results.`
      : '';
    if (!(await confirm(`Delete ${ids.length} subject${ids.length === 1 ? '' : 's'}?${detail} This cannot be undone.`, { title: 'Delete subjects', confirmText: 'Delete everything' }))) return;
    setDeleting({ bulk: true });
    try {
      const data = await api.post('/subjects/bulk-delete', { ids, cascade: true });
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

  function subjectMenu(e, s) {
    openMenu(e, [
      { label: 'View details', icon: Info, onClick: () => setViewing(s) },
      { label: 'Open in question bank', icon: Eye, onClick: () => navigate(`/questions?subject_id=${encodeURIComponent(s.id)}`) },
      { label: 'Edit', icon: Pencil, onClick: () => setEditing(s) },
      'sep',
      { label: 'Copy name', icon: Copy, onClick: () => copyText(s.name, 'Name') },
      ...(s.code ? [{ label: 'Copy code', icon: Copy, onClick: () => copyText(s.code, 'Code') }] : []),
      'sep',
      { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(s) },
    ]);
  }

  return (
    <AppShell pageClass="subjects" activeNav="subjects" pageTitle="Subjects" wide>

      {subjects === null ? (
        <TableSkeleton />
      ) : subjects.length === 0 ? (
        <div className="empty-state">
          <EmptyStateArt art="inbox" />
          <h4>No subjects yet</h4>
          <p>A subject is the container for everything else — create one and the question bank, blueprints and exams follow.</p>
          <button type="button" className="btn btn-primary" onClick={openNew} data-tour="subjects-new">
            <Plus size={16} /> New Subject
          </button>
        </div>
      ) : (
        <>
        <div className="stats-grid">
          <StatCard icon={BookOpen} tint="blue" value={subjects.length} label="Subjects" />
          <StatCard icon={CircleHelp} tint="green" value={subjStats.questions} label="Questions" />
          <StatCard icon={PanelsTopLeft} tint="purple" value={subjStats.blueprints} label="Blueprints" />
          <StatCard icon={FileText} tint="cyan" value={subjStats.exams} label="Exams" />
        </div>
        <section className="dataset" data-dataset data-select-mode="true" data-selecting={selectMode ? 'true' : 'false'}>

          {/* Toolbar */}
          <div className="dataset-bar" data-tour="subjects-toolbar">
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
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd aria-hidden="true">/</kbd>
              </label>
            </div>

            <div className="dataset-bar-trail">
              <button type="button" className="ds-btn" onClick={toggleSelectMode} aria-pressed={selectMode}>
                <CheckSquare size={15} /> Select
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={openNew} data-tour="subjects-new">
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
          <div className="dataset-scroll" data-tour="subjects-table">
            <table className="grid datatable" data-grid="subjects" data-grid-label="subjects">
              <caption className="sr-only">Subjects in your workspace</caption>
              <thead>
                <tr>
                  <th className="col-select">
                    {selectMode && (
                      <label className="ds-check">
                        <input type="checkbox" checked={allChecked} ref={(el) => { if (el) el.indeterminate = someChecked; }} onChange={toggleAll} />
                        <span aria-hidden="true" />
                        <span className="sr-only">Select all rows on this page</span>
                      </label>
                    )}
                  </th>
                  <th className={`col-primary ${sortClass('subject')}`} onClick={sortHandler('subject')} data-name="Subject" data-locked>
                    Subject{renderSortArrow('subject')}
                  </th>
                  <th className={`col-code ${sortClass('code')}`} onClick={sortHandler('code')} data-name="Code">Code{renderSortArrow('code')}</th>
                  <th className={`col-questions is-num ${sortClass('questions')}`} onClick={sortHandler('questions')} data-name="Questions">Questions{renderSortArrow('questions')}</th>
                  <th className={`col-blueprints is-num ${sortClass('blueprints')}`} onClick={sortHandler('blueprints')} data-name="Blueprints">Blueprints{renderSortArrow('blueprints')}</th>
                  <th className={`col-exams is-num ${sortClass('exams')}`} onClick={sortHandler('exams')} data-name="Exams">Exams{renderSortArrow('exams')}</th>
                  <th className={`col-created ${sortClass('created')}`} onClick={sortHandler('created')} data-name="Created">Created{renderSortArrow('created')}</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody ref={animateRows}>
                {pageRows.length === 0 ? (
                  <tr>
                    <td className="ds-noresults" colSpan={selectMode ? 8 : 7}>
                      <span className="ds-noresults-title">No subjects found</span>
                      <span className="ds-noresults-sub">
                        {query ? <>Try a different search or <button onClick={() => setQuery('')}>clear it</button>.</> : 'No subjects match.'}
                      </span>
                    </td>
                  </tr>
                ) : pageRows.map((s, i) => {
                  const q = s.question_count || 0;
                  const t = s.tos_count || 0;
                  const e = s.exam_count || 0;
                  const desc = s.description ? clip(s.description, 90) : 'No description';
                  const descTitle = s.description ? clip(s.description, 200) : '';
                  return (
                    <tr key={s.id} data-id={s.id} style={{ '--i': Math.min(i, 12), '--gc': groupColor(s.id) }} className={selected.has(s.id) ? 'is-selected' : ''} onContextMenu={(e) => subjectMenu(e, s)}>
                      <td className="col-select">
                        {selectMode && (
                          <label className="ds-check">
                            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleRow(s.id)} />
                            <span aria-hidden="true" />
                            <span className="sr-only">Select {s.name}</span>
                          </label>
                        )}
                      </td>
                      <td className="col-primary">
                        <span className="g-entity">
                          <span className="g-primary">
                            <Link to={`/questions?subject_id=${encodeURIComponent(s.id)}`} className="g-title" title={s.name}>{s.name}</Link>
                            <span className="g-meta" title={descTitle}>
                              {desc}
                              {s.description && s.description.trim().length > 90 && (
                                <>
                                  {' '}
                                  <button type="button" className="g-more" onClick={() => setViewing(s)}>Read more</button>
                                </>
                              )}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {s.code
                          ? <span className="g-code" title={s.code}>{s.code}</span>
                          : <span className="g-mute">—</span>}
                      </td>
                      <td className="is-num" data-order={q}>
                        {q ? (
                          <Link className="g-count" to={`/questions?subject_id=${encodeURIComponent(s.id)}`} title="Open this subject's questions">{q}</Link>
                        ) : (
                          <span className="g-count is-zero">—</span>
                        )}
                      </td>
                      <td className="is-num" data-order={t}>
                        <span className={`g-count${t ? '' : ' is-zero'}`}>{t || '—'}</span>
                      </td>
                      <td className="is-num" data-order={e}>
                        <span className={`g-count${e ? '' : ' is-zero'}`}>{e || '—'}</span>
                      </td>
                      <td className="g-mute" data-order={s.created_at}>{fmtDate(s.created_at)}</td>
                      <td className="col-actions">
                        <Tooltip label="Actions">
                          <button
                            type="button"
                            className="g-menu"
                            onClick={(e) => subjectMenu(e, s)}
                            aria-label={`Actions for ${s.name}`}
                          >
                            <Ellipsis size={15} />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer — range + pagination */}
          <DatasetFoot grid={grid} pageSizeOptions={[15, 25, 50, 100]} />
        </section>
        </>
      )}

      <DetailsModal
        open={!!viewing}
        title={viewing?.name || 'Subject'}
        subtitle="Subject details"
        icon={BookOpen}
        onClose={() => setViewing(null)}
        fields={viewing ? [
          { label: 'Code', value: viewing.code, kind: 'meta' },
          { label: 'Questions', value: viewing.question_count || 0, kind: 'stat' },
          { label: 'Blueprints', value: viewing.tos_count || 0, kind: 'stat' },
          { label: 'Exams', value: viewing.exam_count || 0, kind: 'stat' },
          { label: 'Description', value: viewing.description },
          { label: 'Created', value: fmtDate(viewing.created_at) },
        ] : []}
      />
      {menuEl}

      {/* Create/edit subject modal */}
      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Subject' : 'New Subject'}
        subtitle={editing?.id ? 'Update the course details.' : 'Add a course to group your questions, blueprints and exams.'}
        onClose={() => setEditing(null)}
        size="md"
      >
        {editing && (
          <form id="subject-form" onSubmit={handleSave} noValidate>
                  <div className="form-group">
                    <label className="form-label" htmlFor="name">Subject Name <span className="req">*</span></label>
                    <input id="name" name="name" className="form-control" required maxLength={255}
                      value={editing.name || ''} autoComplete="off"
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
        )}
      </Modal>
    </AppShell>
  );
}
