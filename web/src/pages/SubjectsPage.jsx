import '../styles/subjects.css';
/**
 * SubjectsPage — the instructor's subjects as workflow cards or a table,
 * with create/edit/delete.
 *
 * Every subject shows where it sits in materials → blueprint → questions →
 * exam (lib/subjectProgress.js) and the one next step that moves it on.
 * Cards (the default) suit the handful of subjects an instructor teaches;
 * the table keeps dense sorting, paging and bulk selection. Both views share
 * one TanStack sort state, and the chosen view is remembered per browser.
 * CRUD via /api/subjects.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Search, CheckSquare, BookOpen, Eye, Check, Copy, Ellipsis, Info,
  FileText, LayoutGrid, Rows3, ArrowUpDown, ArrowRight, Upload, Loader2, AlertTriangle,
  PanelsTopLeft, Lock, ClipboardCheck, Sparkles, Send, CircleCheck,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useGridTable, DatasetFoot } from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import DetailsModal from '../components/DetailsModal.jsx';
import Tooltip from '../components/Tooltip.jsx';
import HoverCard from '../components/HoverCard.jsx';
import Select from '../components/Select.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import { animateRows } from '../lib/animRows.js';
import { timeAgo } from '../lib/time.js';
import { subjectStages, nextStep, attentionScore } from '../lib/subjectProgress.js';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import { groupColor, StatCard } from '../components/Board.jsx';

const PAGE_SIZE = 25;
const VIEW_KEY = 'nexam:subjects:view';

/** Card-view sort choices — each maps onto the shared table sort state. */
const SORTS = [
  { value: 'attention', label: 'Needs attention', sorting: [{ id: 'attention', desc: true }] },
  { value: 'activity', label: 'Recently active', sorting: [{ id: 'activity', desc: true }] },
  { value: 'name', label: 'Name (A–Z)', sorting: [{ id: 'subject', desc: false }] },
  { value: 'created', label: 'Newest first', sorting: [{ id: 'created', desc: true }] },
];

const NEXT_ICONS = {
  upload: Upload, processing: Loader2, 'fix-materials': AlertTriangle, blueprint: PanelsTopLeft,
  finalize: Lock, review: ClipboardCheck, generate: Sparkles, exam: FileText, publish: Send, exams: CircleCheck,
};
const STATE_TEXT = { done: 'Done', partial: 'In progress', todo: 'Not started' };

/** Remembered view (per browser). Storage may be unavailable — default cards. */
function readView() {
  try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'; } catch { return 'cards'; }
}

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
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "2 days ago" for the last week, the calendar date after that. */
function activityText(iso) {
  return timeAgo(iso) || fmtDate(iso);
}

/** Four-stage progress: labelled strip on cards, a compact list in hover cards. */
function StageStrip({ stages, variant = 'strip' }) {
  return (
    <ol className={`sj-stages sj-stages--${variant}`} aria-label="Workflow progress">
      {stages.map((st) => (
        <li key={st.key} className="sj-stage" data-state={st.state}>
          <span className="sj-stage-bar" aria-hidden="true" />
          <span className="sj-stage-label">{st.label}</span>
          <span className="sj-stage-detail">
            <span className="sr-only">{STATE_TEXT[st.state]}: </span>{st.detail}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Table cell: four tiny bars; hovering or focusing shows the full breakdown. */
function MiniStages({ stages }) {
  const summary = stages.map((st) => `${st.label}: ${st.detail}`).join('; ');
  return (
    <HoverCard
      trigger={(
        <span className="sj-mini" tabIndex={0} role="img" aria-label={summary}>
          {stages.map((st) => <i key={st.key} data-state={st.state} />)}
        </span>
      )}
    >
      <span className="sj-hover-title">Workflow progress</span>
      <StageStrip stages={stages} variant="list" />
    </HoverCard>
  );
}

function NextStepLink({ step, compact = false }) {
  const Icon = NEXT_ICONS[step.key] || ArrowRight;
  return (
    <Link
      to={step.to}
      className={`sj-next${step.done ? ' is-done' : ''}${compact ? ' is-compact' : ''}`}
      data-step={step.key}
    >
      <Icon size={14} aria-hidden="true" className={step.key === 'processing' ? 'is-spinning' : undefined} />
      <span>{step.label}</span>
      {!compact && <ArrowRight size={14} aria-hidden="true" className="sj-next-arrow" />}
    </Link>
  );
}

function SelectBox({ checked, onChange, label, indeterminate = false }) {
  return (
    <label className="ds-check">
      <input type="checkbox" checked={checked} ref={(el) => { if (el) el.indeterminate = indeterminate; }} onChange={onChange} />
      <span aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </label>
  );
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
  const [view, setView] = useState(readView);

  // Search + selection are local; sort/filter/pagination live in the
  // headless table instance shared by both views.
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

  function changeView(next) {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* storage unavailable */ }
  }

  const columns = useMemo(() => [
    { id: 'select', enableSorting: false },
    { id: 'subject', accessorFn: (s) => String(s.name || '').toLowerCase() },
    { id: 'code', accessorFn: (s) => String(s.code || '').toLowerCase() },
    { id: 'progress', accessorFn: (s) => subjectStages(s).filter((st) => st.state === 'done').length },
    { id: 'questions', accessorFn: (s) => Number(s.approved_count) || 0 },
    { id: 'activity', accessorFn: (s) => new Date(s.last_activity || s.created_at).getTime() || 0 },
    { id: 'attention', accessorFn: attentionScore },
    { id: 'created', accessorFn: (s) => new Date(s.created_at).getTime() || 0 },
    { id: 'next', enableSorting: false },
    { id: 'actions', enableSorting: false },
  ], []);

  const grid = useGridTable({
    data: subjects || [],
    columns,
    pageSize: PAGE_SIZE,
    storageKey: 'subjects',
    initialSorting: SORTS[0].sorting,
    globalFilter: query,
    globalFilterFn: (row, _col, value) =>
      `${row.original.name || ''} ${row.original.code || ''}`
        .toLowerCase()
        .includes(String(value).toLowerCase()),
    // Cards show every subject; only the table pages.
    paginate: view === 'table',
  });
  const { pageRows, sortClass, sortHandler, renderSortArrow } = grid;

  // The card sort picker reads the shared sort state; a table-only sort
  // (say, by code) shows as "Custom" rather than a wrong label.
  const sortState = grid.table.getState().sorting[0];
  const sortValue = SORTS.find((o) => o.sorting[0].id === sortState?.id && o.sorting[0].desc === !!sortState?.desc)?.value || 'custom';
  const sortOptions = sortValue === 'custom' ? [...SORTS, { value: 'custom', label: 'Custom (from table)' }] : SORTS;
  const changeSort = (value) => {
    const choice = SORTS.find((o) => o.value === value);
    if (choice) grid.table.setSorting(choice.sorting);
  };

  // KPI row — the numbers that ask for action, not just totals.
  const totals = useMemo(() => (subjects || []).reduce(
    (acc, s) => ({
      drafts: acc.drafts + (Number(s.draft_count) || 0),
      approved: acc.approved + (Number(s.approved_count) || 0),
      exams: acc.exams + (Number(s.exam_count) || 0),
    }),
    { drafts: 0, approved: 0, exams: 0 },
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
    const step = nextStep(s);
    openMenu(e, [
      { label: step.label, icon: NEXT_ICONS[step.key] || ArrowRight, onClick: () => navigate(step.to) },
      'sep',
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

  const noResults = (
    <>
      <span className="ds-noresults-title">No subjects found</span>
      <span className="ds-noresults-sub">
        {query ? <>Try a different search or <button type="button" onClick={() => setQuery('')}>clear it</button>.</> : 'No subjects match.'}
      </span>
    </>
  );

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
          <StatCard icon={ClipboardCheck} tint="amber" value={totals.drafts} label="Drafts to review" />
          <StatCard icon={CircleCheck} tint="green" value={totals.approved} label="Approved questions" />
          <StatCard icon={FileText} tint="cyan" value={totals.exams} label="Exams" />
        </div>
        <section
          className="dataset"
          data-dataset
          data-view={view}
          data-select-mode="true"
          data-selecting={selectMode ? 'true' : 'false'}
        >

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
              {view === 'cards' && (
                <Select value={sortValue} onChange={changeSort} options={sortOptions} label="Sort subjects" icon={ArrowUpDown} />
              )}
              <div className="sj-view" role="group" aria-label="Layout">
                <Tooltip label="Cards">
                  <button type="button" aria-pressed={view === 'cards'} onClick={() => changeView('cards')} aria-label="Card view">
                    <LayoutGrid size={15} />
                  </button>
                </Tooltip>
                <Tooltip label="Table">
                  <button type="button" aria-pressed={view === 'table'} onClick={() => changeView('table')} aria-label="Table view">
                    <Rows3 size={15} />
                  </button>
                </Tooltip>
              </div>
              <button type="button" className="ds-btn" onClick={toggleSelectMode} aria-pressed={selectMode}>
                <CheckSquare size={15} /> Select
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={openNew} data-tour="subjects-new">
                <Plus size={14} /> New Subject
              </button>
            </div>
          </div>

          {/* Selection bar — replaces the toolbar while selecting */}
          {selectMode && (
            <div className="dataset-select-bar">
              {view === 'cards' && (
                <SelectBox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} label="Select all subjects" />
              )}
              <span className="ds-select-count" aria-live="polite">{selected.size} selected</span>
              <button type="button" className="ds-btn is-danger" onClick={handleBulkDelete} disabled={!selected.size || !!deleting?.bulk}>
                <Trash2 size={15} /> Delete
              </button>
              <button type="button" className="ds-btn" onClick={() => { setSelected(new Set()); setSelectMode(false); }}>Clear</button>
            </div>
          )}

          {view === 'cards' ? (
            pageRows.length === 0 ? (
              <div className="ds-noresults sj-noresults">{noResults}</div>
            ) : (
              <ul className="sj-cards" ref={animateRows} data-tour="subjects-table">
                {pageRows.map((s) => {
                  const long = s.description && s.description.trim().length > 140;
                  const isSelected = selected.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className={`sj-card${isSelected ? ' is-selected' : ''}`}
                      style={{ '--gc': groupColor(s.id) }}
                      onContextMenu={(e) => subjectMenu(e, s)}
                    >
                      <div className="sj-card-top">
                        {selectMode && <SelectBox checked={isSelected} onChange={() => toggleRow(s.id)} label={`Select ${s.name}`} />}
                        {s.code && <span className="g-code" title={s.code}>{s.code}</span>}
                        <span className="sj-activity" title={`Last activity ${fmtDate(s.last_activity)}`}>
                          {activityText(s.last_activity)}
                        </span>
                        <Tooltip label="Actions">
                          <button type="button" className="g-menu" onClick={(e) => subjectMenu(e, s)} aria-label={`Actions for ${s.name}`}>
                            <Ellipsis size={15} />
                          </button>
                        </Tooltip>
                      </div>
                      <h3 className="sj-card-title">
                        <Link to={`/questions?subject_id=${encodeURIComponent(s.id)}`} title={s.name}>{s.name}</Link>
                      </h3>
                      <p className={`sj-card-desc${s.description ? '' : ' is-empty'}`}>
                        {s.description ? clip(s.description, 140) : 'No description'}
                        {long && <> <button type="button" className="g-more" onClick={() => setViewing(s)}>Read more</button></>}
                      </p>
                      <StageStrip stages={subjectStages(s)} />
                      <div className="sj-card-foot">
                        <NextStepLink step={nextStep(s)} />
                      </div>
                    </li>
                  );
                })}
                {!selectMode && !query && (
                  <li className="sj-card sj-card--add">
                    <button type="button" onClick={openNew}>
                      <span className="sj-add-icon" aria-hidden="true"><Plus size={18} /></span>
                      <strong>New subject</strong>
                      <span>Add a course to group its materials, blueprints, questions and exams.</span>
                    </button>
                  </li>
                )}
              </ul>
            )
          ) : (
            <>
              <div className="dataset-scroll" data-tour="subjects-table">
                <table className="grid datatable" data-grid="subjects" data-grid-label="subjects">
                  <caption className="sr-only">Subjects in your workspace</caption>
                  <thead>
                    <tr>
                      <th className="col-select wp-4">
                        {selectMode && (
                          <SelectBox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} label="Select all rows on this page" />
                        )}
                      </th>
                      <th className={`col-primary wp-27 ${sortClass('subject')}`} onClick={sortHandler('subject')} data-name="Subject" data-locked>
                        Subject{renderSortArrow('subject')}
                      </th>
                      <th className={`wp-9 ${sortClass('code')}`} onClick={sortHandler('code')} data-name="Code">Code{renderSortArrow('code')}</th>
                      <th className={`wp-16 ${sortClass('progress')}`} onClick={sortHandler('progress')} data-name="Progress">Progress{renderSortArrow('progress')}</th>
                      <th className={`wp-12 is-num ${sortClass('questions')}`} onClick={sortHandler('questions')} data-name="Approved">Approved{renderSortArrow('questions')}</th>
                      <th className={`wp-13 ${sortClass('activity')}`} onClick={sortHandler('activity')} data-name="Last activity">Activity{renderSortArrow('activity')}</th>
                      <th className="wp-14" data-name="Next step">Next step</th>
                      <th className="col-actions wp-5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody ref={animateRows}>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td className="ds-noresults" colSpan={8}>{noResults}</td>
                      </tr>
                    ) : pageRows.map((s, i) => {
                      const stages = subjectStages(s);
                      const approved = Number(s.approved_count) || 0;
                      const drafts = Number(s.draft_count) || 0;
                      return (
                        <tr
                          key={s.id}
                          data-id={s.id}
                          style={{ '--i': Math.min(i, 12), '--gc': groupColor(s.id) }}
                          className={selected.has(s.id) ? 'is-selected' : ''}
                          onContextMenu={(e) => subjectMenu(e, s)}
                        >
                          <td className="col-select">
                            {selectMode && <SelectBox checked={selected.has(s.id)} onChange={() => toggleRow(s.id)} label={`Select ${s.name}`} />}
                          </td>
                          <td className="col-primary">
                            <span className="g-entity">
                              <span className="g-primary">
                                <Link to={`/questions?subject_id=${encodeURIComponent(s.id)}`} className="g-title" title={s.name}>{s.name}</Link>
                                <span className="g-meta" title={s.description ? clip(s.description, 200) : ''}>
                                  {s.description ? clip(s.description, 90) : 'No description'}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td>
                            {s.code
                              ? <span className="g-code" title={s.code}>{s.code}</span>
                              : <span className="g-mute">—</span>}
                          </td>
                          <td><MiniStages stages={stages} /></td>
                          <td className="is-num">
                            <span className={`g-count${approved ? '' : ' is-zero'}`}>{approved || '—'}</span>
                            {drafts > 0 && <span className="sj-review-tag">{drafts} to review</span>}
                          </td>
                          <td className="g-mute" title={fmtDate(s.last_activity)}>{activityText(s.last_activity)}</td>
                          <td><NextStepLink step={nextStep(s)} compact /></td>
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
            </>
          )}
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
          { label: 'Materials ready', value: viewing.material_ready || 0, kind: 'stat' },
          { label: 'Approved questions', value: viewing.approved_count || 0, kind: 'stat' },
          { label: 'Drafts to review', value: viewing.draft_count || 0, kind: 'stat' },
          { label: 'Blueprints', value: viewing.tos_count || 0, kind: 'stat' },
          { label: 'Exams', value: viewing.exam_count || 0, kind: 'stat' },
          { label: 'Description', value: viewing.description },
          { label: 'Last activity', value: fmtDate(viewing.last_activity) },
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
