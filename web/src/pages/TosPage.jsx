import '../styles/tos.css';
/**
 * TosPage — list of TOS blueprints with create/edit/delete.
 *
 * Each row shows how much of the plan is banked (per topic × Bloom cell, the
 * same count the blueprint page generates from), the Bloom mix, exams built
 * from it, and the one next step that moves it on (lib/blueprintProgress.js).
 * Desktop is a grouped table; under 1200px the secondary columns drop; under
 * 768px every blueprint becomes a card so nothing scrolls sideways.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Info, Eye, Ellipsis, FilePlus2, Upload, Check, Layers, Copy, PanelsTopLeft,
  FileCheck, Database, Search, Filter, ListPlus, Lock, Sparkles, ClipboardCheck,
  CircleCheck,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useGridTable } from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import DetailsModal from '../components/DetailsModal.jsx';
import HoverCard from '../components/HoverCard.jsx';
import Select from '../components/Select.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import { animateRows } from '../lib/animRows.js';
import { subjectLabel } from '../lib/subjectProgress.js';
import { timeAgo } from '../lib/time.js';
import { useMediaQuery } from '../lib/useMediaQuery.js';
import {
  BLOOM_ORDER, BLOOM_LABELS, blueprintCoverage, blueprintNextStep, bloomMix, coverageCaption,
} from '../lib/blueprintProgress.js';
import {
  StatusPill, BoardGroupHead, NextStepLink, CardGroup,
  GroupChip, groupColor, statusOf, statusMeta, STATUS_ORDER, StatCard,
} from '../components/Board.jsx';

const DEFAULT_BLOOM = { remember: 15, understand: 20, apply: 20, analyze: 20, evaluate: 15, create: 10 };
const FINDER_FROM = 6; // search + filter join the toolbar once the list is this long

const NEXT_ICONS = {
  topics: ListPlus, finalize: Lock, generate: Sparkles, review: ClipboardCheck, exam: FilePlus2, exams: CircleCheck,
};
const FILTERS = [
  { value: 'all', label: 'All blueprints' },
  { value: 'attention', label: 'Needs work' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'draft', label: 'Drafts' },
];

const parseDate = (iso) => Date.parse(String(iso || '').replace(' ', 'T')) || 0;

// Sortable columns for useGridTable — cells are rendered by hand below.
const COLUMNS = [
  { id: 'title', accessorFn: (t) => String(t.title || '').toLowerCase() },
  { id: 'subject', accessorFn: (t) => String(t.subject_name || '').toLowerCase() },
  { id: 'status', accessorFn: (t) => (statusOf(t.status) === 'finalized' ? 1 : 0) },
  { id: 'coverage', accessorFn: (t) => { const c = blueprintCoverage(t); return c.total ? c.covered / c.total : -1; } },
  { id: 'exams', accessorFn: (t) => Number(t.exam_count) || 0 },
  { id: 'updated', accessorFn: (t) => parseDate(t.updated_at || t.created_at) },
];

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "3 hr ago" this week, then "Oct 5" (the year only when it differs). */
function touchedText(iso) {
  const d = new Date(String(iso || '').replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '—';
  const opts = d.getFullYear() === new Date().getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return timeAgo(d.toISOString()) || d.toLocaleDateString('en-US', opts);
}

/** Six-segment Bloom bar; on desktop a hover card lists the percentages. */
function BloomMix({ weights, interactive = true }) {
  const mix = bloomMix(weights);
  const summary = mix.map((m) => `${m.label} ${m.pct}%`).join(', ');
  const bar = (
    <span className="bp-bloom" tabIndex={interactive ? 0 : undefined} role="img" aria-label={`Bloom mix: ${summary}`}>
      {mix.map((m) => m.pct > 0 && <i key={m.key} data-level={m.level} style={{ flexGrow: m.pct }} />)}
    </span>
  );
  if (!interactive) return bar;
  return (
    <HoverCard trigger={bar}>
      <span className="bp-hover-title">Bloom mix</span>
      <ul className="bp-bloom-list">
        {mix.map((m) => (
          <li key={m.key} data-empty={!m.pct || undefined}>
            <i data-level={m.level} aria-hidden="true" />
            <span>{m.label}</span>
            <strong>{m.pct}%</strong>
          </li>
        ))}
      </ul>
    </HoverCard>
  );
}

/** Banked / planned with a two-tone bar: approved, then awaiting approval. */
function Coverage({ t }) {
  const cov = blueprintCoverage(t);
  // The title meta already says "no topics yet".
  if (cov.state === 'none') return <span className="bp-cov-none" aria-label="Nothing planned yet">—</span>;
  const pct = (n) => `${(n / cov.total) * 100}%`;
  return (
    <span className="bp-cov" data-state={cov.state}>
      <span className="bp-cov-head">
        <strong>{cov.covered}<span>/{cov.total}</span></strong>
        <span className="bp-cov-cap">{coverageCaption(cov)}</span>
      </span>
      <span
        className="bp-cov-bar"
        role="img"
        aria-label={`${cov.ready} approved, ${cov.pending} awaiting approval, ${cov.missing} still to generate, of ${cov.total} planned`}
      >
        <i className="is-ready" style={{ width: pct(cov.ready) }} />
        <i className="is-pending" style={{ width: pct(cov.pending) }} />
      </span>
    </span>
  );
}

/** Next step for a row, with this page's icon for it. */
const stepFor = (t) => { const step = blueprintNextStep(t); return { ...step, icon: NEXT_ICONS[step.key] }; };

export default function TosPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tosList, setTosList] = useState(() => api.peek('/tos')?.tos ?? null);
  const [subjects, setSubjects] = useState(() => api.peek('/subjects')?.subjects ?? []);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [groupBy, setGroupBy] = useState('subject'); // subject | none
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const asCards = useMediaQuery('(max-width: 767px)');

  // Page-owned filter first; the grid then applies search + sort.
  const filtered = useMemo(() => (tosList || []).filter((t) => {
    if (filter === 'finalized') return statusOf(t.status) === 'finalized';
    if (filter === 'draft') return statusOf(t.status) !== 'finalized';
    // Anything whose next step is still preparation (not building exams).
    if (filter === 'attention') return !['exam', 'exams'].includes(blueprintNextStep(t).key);
    return true;
  }), [tosList, filter]);

  const grid = useGridTable({
    data: filtered,
    columns: COLUMNS,
    initialSorting: [{ id: 'updated', desc: true }],
    globalFilter: query,
    globalFilterFn: (row, _col, value) =>
      `${row.original.title || ''} ${row.original.subject_name || ''}`
        .toLowerCase()
        .includes(String(value).trim().toLowerCase()),
    resetKey: filter,
    paginate: false, // grouped board — every row renders
  });
  const rows = grid.pageRows;
  const { sortClass, sortHandler, renderSortArrow } = grid;

  const tosGroups = useMemo(() => {
    if (!rows.length || groupBy === 'none') return null;
    const map = new Map();
    for (const t of rows) {
      const key = t.subject_id || t.subject_name || 'none';
      if (!map.has(key)) {
        map.set(key, { key, title: t.subject_name || 'No subject', color: groupColor(key), rows: [] });
      }
      map.get(key).rows.push(t);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [rows, groupBy]);

  // Grouped by subject the Subject column only repeats the band title — drop
  // it and let every other column take the width (same trick as Questions).
  // A single-subject list reads the same value on every row, so it hides too.
  const singleSubject = useMemo(() => {
    if (!tosList?.length) return false;
    return new Set(tosList.map((t) => t.subject_id || 'none')).size === 1;
  }, [tosList]);
  const showSubject = groupBy !== 'subject' && !singleSubject;
  const colCount = showSubject ? 8 : 7;
  const showFinder = (tosList?.length || 0) >= FINDER_FROM || !!query || filter !== 'all';

  // KPI row — counts plus banked coverage across the whole list.
  const tosStats = useMemo(() => (tosList || []).reduce(
    (acc, t) => {
      const cov = blueprintCoverage(t);
      if (statusOf(t.status) === 'finalized') {
        acc.finalized += 1;
        if (cov.state === 'ready') acc.ready += 1;
      }
      acc.banked += cov.covered;
      acc.items += cov.total;
      return acc;
    },
    { finalized: 0, ready: 0, banked: 0, items: 0 },
  ), [tosList]);

  function toggleGroup(key) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const load = useCallback(() => {
    api.get('/tos')
      .then((data) => setTosList(data.tos))
      .catch((err) => toast.error(err.message || 'Could not load TOS.'));
  }, [toast]);

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const wantsNew = searchParams.get('new') === '1';
    const editId = searchParams.get('edit');
    if (!wantsNew && !editId) return;
    if (wantsNew) {
      setEditing({
        title: '',
        subject_id: searchParams.get('subject') || subjects[0]?.id || '',
        total_items: 50,
        bloom_weights: { ...DEFAULT_BLOOM },
      });
    } else {
      // Wait for the list before consuming ?edit — otherwise the param is
      // dropped before we can find the blueprint.
      if (!tosList) return;
      const t = tosList.find((x) => String(x.id) === String(editId));
      if (t) setEditing({ ...t, bloom_weights: t.bloom_weights || { ...DEFAULT_BLOOM } });
    }
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    next.delete('edit');
    next.delete('subject');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, subjects, tosList]);

  async function handleSave(e) {
    e.preventDefault();
    const total = BLOOM_ORDER.reduce((s, k) => s + (Number(editing.bloom_weights?.[k]) || 0), 0);
    if (total !== 100) { toast.error(`Bloom weights must total 100% (currently ${total}%).`); return; }

    // Multiple blueprints per subject are the normal workflow (PRELIM,
    // MIDTERM, FINAL…) — only warn on a true duplicate: same title.
    if (!editing.id && tosList) {
      const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const exact = tosList.find((t) =>
        String(t.subject_id) === String(editing.subject_id) && norm(t.title) === norm(editing.title));
      if (exact) {
        const proceed = await confirm(
          `A blueprint titled "${exact.title}" already exists for this subject. Create a duplicate anyway?`,
          { title: 'Duplicate blueprint', confirmText: 'Create anyway', danger: false }
        );
        if (!proceed) return;
      }
    }

    setSaving(true);
    try {
      const body = {
        title: editing.title,
        subject_id: editing.subject_id,
        total_items: Number(editing.total_items),
        bloom_weights: editing.bloom_weights,
      };
      if (editing.id) {
        await api.put(`/tos/${editing.id}`, body);
        toast.success('TOS updated.');
      } else {
        await api.post('/tos', body);
        toast.success('TOS created.');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tos) {
    if (!(await confirm(`Delete "${tos.title}"? This cannot be undone.`, { title: 'Delete blueprint' }))) return;
    try { await api.del(`/tos/${tos.id}`); toast.success('TOS deleted.'); load(); }
    catch (err) { toast.error(err.message || 'Delete failed.'); }
  }

  const bloomTotal = editing
    ? BLOOM_ORDER.reduce((s, k) => s + (Number(editing.bloom_weights?.[k]) || 0), 0)
    : 0;

  function tosMenu(e, t) {
    openMenu(e, [
      { label: 'View details', icon: Info, onClick: () => setViewing(t) },
      { label: 'Open', icon: Eye, onClick: () => navigate(`/tos/${t.id}`) },
      { label: 'Edit', icon: Pencil, onClick: () => setEditing({ ...t, bloom_weights: t.bloom_weights || { ...DEFAULT_BLOOM } }) },
      { label: 'Build exam', icon: FilePlus2, onClick: () => navigate(`/exams/new?tos=${t.id}`) },
      'sep',
      { label: 'Copy title', icon: Copy, onClick: () => copyText(t.title, 'Title') },
      'sep',
      { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(t) },
    ]);
  }

  function renderTosRow(t) {
    const topics = Number(t.topic_count) || 0;
    const items = Number(t.total_items) || 0;
    const touched = t.updated_at || t.created_at;
    const exams = Number(t.exam_count) || 0;
    const published = Number(t.published_count) || 0;
    return (
      <tr key={t.id} data-id={t.id} className="b-row" onContextMenu={(e) => tosMenu(e, t)}>
        <td className="col-primary">
          <span className="g-primary">
            <Link to={`/tos/${t.id}`} className="g-title" title={t.title}>{t.title}</Link>
            <span className="row-meta">
              <span className="row-meta-status"><StatusPill status={t.status} small /></span>
              {showSubject && t.subject_name && <span className="bp-meta-subject">{t.subject_name}</span>}
              <span>{topics ? `${topics} topic${topics === 1 ? '' : 's'} · ${items} items` : `${items} items · no topics yet`}</span>
              <BloomMix weights={t.bloom_weights} />
            </span>
          </span>
        </td>
        {showSubject && (
          <td className="col-opt">
            {t.subject_name ? (
              <GroupChip color={groupColor(t.subject_id || t.subject_name)}>{t.subject_name}</GroupChip>
            ) : (
              <span className="g-mute">—</span>
            )}
          </td>
        )}
        <td className="col-opt" data-order={statusOf(t.status)}><StatusPill status={t.status} /></td>
        <td><Coverage t={t} /></td>
        <td className="is-num col-opt">
          {exams ? (
            <span className="bp-exams">
              <span className="g-count">{exams}</span>
              {published > 0 && <span className="bp-exams-sub" title={`${published} published`}>{published} live</span>}
            </span>
          ) : <span className="g-mute">—</span>}
        </td>
        <td className="g-mute col-opt" title={fmtDate(touched)}>{touchedText(touched)}</td>
        <td><NextStepLink step={stepFor(t)} /></td>
        <td className="col-actions">
          {/* Same floating menu as right-click — uniform with Subjects/Questions. */}
          <button
            type="button"
            className="g-menu"
            onClick={(e) => tosMenu(e, t)}
            title="Actions"
            aria-label={`Actions for ${t.title}`}
          >
            <Ellipsis size={15} />
          </button>
        </td>
      </tr>
    );
  }

  function renderTosCard(t) {
    const topics = Number(t.topic_count) || 0;
    const items = Number(t.total_items) || 0;
    const exams = Number(t.exam_count) || 0;
    const touched = t.updated_at || t.created_at;
    return (
      <li key={t.id} className="row-card" style={{ '--gc': groupColor(t.subject_id || t.subject_name) }} onContextMenu={(e) => tosMenu(e, t)}>
        <div className="row-card-top">
          <StatusPill status={t.status} small />
          <span className="row-card-when">{touchedText(touched)}</span>
          <button type="button" className="g-menu" onClick={(e) => tosMenu(e, t)} aria-label={`Actions for ${t.title}`}>
            <Ellipsis size={16} />
          </button>
        </div>
        <Link to={`/tos/${t.id}`} className="row-card-title">{t.title}</Link>
        <span className="row-meta">
          {showSubject && t.subject_name && <GroupChip color={groupColor(t.subject_id || t.subject_name)}>{t.subject_name}</GroupChip>}
          <span>
            {topics ? `${topics} topic${topics === 1 ? '' : 's'} · ${items} items` : `${items} items · no topics yet`}
            {exams > 0 && ` · ${exams} exam${exams === 1 ? '' : 's'}`}
          </span>
        </span>
        <BloomMix weights={t.bloom_weights} interactive={false} />
        {topics > 0 && <Coverage t={t} />}
        <NextStepLink step={stepFor(t)} block />
      </li>
    );
  }

  const openNew = () => setEditing({ title: '', subject_id: subjects[0]?.id || '', total_items: 50, bloom_weights: { ...DEFAULT_BLOOM } });
  const clearFinder = () => { setQuery(''); setFilter('all'); };
  const noMatch = (
    <div className="row-nomatch">
      <p>No blueprints match{query ? ` “${query.trim()}”` : ''}.</p>
      <button type="button" className="btn btn-outline btn-sm" onClick={clearFinder}>Clear search and filter</button>
    </div>
  );

  return (
    <AppShell pageClass="tos" activeNav="tos" pageTitle="Blueprints (TOS)" wide>

      {tosList === null ? (
        <TableSkeleton />
      ) : tosList.length === 0 ? (
        <div className="empty-state">
          <EmptyStateArt art="grid" tone={7} />
          <h4>No blueprints yet</h4>
          <p>Upload a syllabus and click "Auto-generate Blueprint" to create one automatically, or create one manually and set the item count and Bloom weights yourself.</p>
          <div className="empty-state-actions">
            <Link to="/materials?upload=1" className="btn btn-outline">
              <Upload size={16} /> Upload Syllabus
            </Link>
            <button className="btn btn-primary" data-tour="tos-new" onClick={openNew}>
              <Plus size={16} /> New Blueprint
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="stats-grid stats-4">
          <StatCard icon={PanelsTopLeft} tint="blue" value={tosList.length} label="Blueprints" />
          <StatCard icon={FileCheck} tint="green" value={tosStats.finalized} label="Finalized" />
          <StatCard icon={FilePlus2} tint="purple" value={tosStats.ready} label="Exam-ready" />
          <StatCard icon={Database} tint="cyan" value={tosStats.items ? `${tosStats.banked} / ${tosStats.items}` : '—'} label="Items banked" />
        </div>
        <div className="dataset" data-view={asCards ? 'cards' : 'table'}>
          <div className="dataset-bar">
            <div className="dataset-bar-lead">
              {showFinder && (
                <>
                  <label className="ds-search" htmlFor="tos-search">
                    <Search size={15} />
                    <span className="sr-only">Search blueprints</span>
                    <input
                      id="tos-search"
                      type="search"
                      autoComplete="off"
                      placeholder="Search by title or subject…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <Select value={filter} onChange={setFilter} options={FILTERS} label="Filter blueprints" icon={Filter} />
                </>
              )}
              <span className="b-groupby">
                <Layers size={14} aria-hidden="true" />
                <select
                  aria-label="Group blueprints by"
                  data-active={groupBy !== 'none'}
                  value={groupBy}
                  onChange={(e) => { setGroupBy(e.target.value); setCollapsed(new Set()); }}
                >
                  <option value="subject">Group: Subject</option>
                  <option value="none">Group: None</option>
                </select>
              </span>
            </div>
            <div className="dataset-bar-trail">
              <button className="btn btn-primary btn-sm" data-tour="tos-new" onClick={openNew}>
                <Plus size={14} /> New Blueprint
              </button>
            </div>
          </div>

          {rows.length === 0 ? noMatch : asCards ? (
            <div className="row-cards" data-tour="tos-table">
              {tosGroups ? tosGroups.map((g) => (
                <CardGroup key={g.key} title={g.title} color={g.color} count={g.rows.length} collapsed={collapsed.has(g.key)} onToggle={() => toggleGroup(g.key)}>
                  <ul className="row-card-list" ref={animateRows}>{g.rows.map(renderTosCard)}</ul>
                </CardGroup>
              )) : (
                <ul className="row-card-list" ref={animateRows}>{rows.map(renderTosCard)}</ul>
              )}
            </div>
          ) : (
          <div className="dataset-scroll" data-tour="tos-table">
        <table className="grid datatable bp-table is-adaptive" data-subject={showSubject || undefined}>
          <caption className="sr-only">Table of Specification blueprints in your workspace</caption>
          <thead>
            <tr>
              <th className={`col-primary bp-c-title ${showSubject ? 'wp-22' : 'wp-32'} ${sortClass('title')}`} onClick={sortHandler('title')}>
                Blueprint{renderSortArrow('title')}
              </th>
              {showSubject && <th className={`wp-12 col-opt ${sortClass('subject')}`} onClick={sortHandler('subject')}>Subject{renderSortArrow('subject')}</th>}
              <th className={`wp-10 col-opt ${sortClass('status')}`} onClick={sortHandler('status')}>Status{renderSortArrow('status')}</th>
              <th className={`${showSubject ? 'wp-16' : 'wp-17'} bp-c-cov ${sortClass('coverage')}`} onClick={sortHandler('coverage')}>Banked{renderSortArrow('coverage')}</th>
              <th className={`is-num wp-8 col-opt ${sortClass('exams')}`} onClick={sortHandler('exams')}>Exams{renderSortArrow('exams')}</th>
              <th className={`${showSubject ? 'wp-10' : 'wp-11'} col-opt ${sortClass('updated')}`} onClick={sortHandler('updated')}>Updated{renderSortArrow('updated')}</th>
              <th className="wp-17 bp-c-next">Next step</th>
              <th className="col-actions wp-5 bp-c-act"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          {tosGroups ? tosGroups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            const counts = {};
            for (const t of g.rows) { const k = statusOf(t.status); counts[k] = (counts[k] || 0) + 1; }
            return (
              <tbody key={g.key} ref={animateRows} className={`b-group${isCollapsed ? ' is-collapsed' : ''}`} style={{ '--gc': g.color }}>
                <BoardGroupHead color={g.color} title={g.title} count={g.rows.length} meta={statusMeta(counts, STATUS_ORDER.tos) || undefined} colSpan={colCount} collapsed={isCollapsed} onToggle={() => toggleGroup(g.key)} />
                {g.rows.map(renderTosRow)}
              </tbody>
            );
          }) : (
            <tbody ref={animateRows}>
              {rows.map(renderTosRow)}
            </tbody>
          )}
        </table>
          </div>
          )}
        </div>
        </>
      )}

      <Modal open={!!editing} title={editing?.id ? 'Edit TOS Blueprint' : 'New TOS Blueprint'}
        subtitle={editing?.id ? 'Update this blueprint.' : 'Set the total items and how they spread across Bloom levels.'}
        onClose={() => setEditing(null)} size="lg"
        footer={<>
          <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" form="tos-form" type="submit" disabled={saving}>
            {saving && <span className="btn-spinner" />}{editing?.id ? 'Save Changes' : 'Create Blueprint'}
          </button>
        </>}>
        {editing && (
          <form id="tos-form" onSubmit={handleSave} noValidate>
            <div className="form-section">
              <div className="form-section-title">Details</div>
              <div className="form-group">
                <label className="form-label" htmlFor="title">Title <span className="req">*</span></label>
                <input type="text" id="title" className="form-control" required maxLength={255}
                  placeholder="e.g. Midterm Exam Blueprint" autoFocus
                  value={editing.title || ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="subject_id">Subject <span className="req">*</span></label>
                <select id="subject_id" className="form-control form-select" required
                  value={editing.subject_id || ''}
                  onChange={(e) => setEditing({ ...editing, subject_id: e.target.value })}>
                  <option value="">Select a subject…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{subjectLabel(s)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="total_items">Total Items <span className="req">*</span></label>
                <input type="number" id="total_items" className="form-control" required min={1} max={500}
                  value={editing.total_items || 50}
                  onChange={(e) => setEditing({ ...editing, total_items: e.target.value })} />
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Bloom's Taxonomy Weights</div>
              <p className="form-hint mb-2">
                Distribute percentages across the six cognitive levels. Should total 100%.
              </p>
              <div className="bloom-grid">
                {BLOOM_ORDER.map((k) => (
                  <div key={k} className="bloom-cell">
                    <label className="form-label" htmlFor={`bloom_${k}`}>{BLOOM_LABELS[k]}</label>
                    <div className="bloom-input-wrap">
                      <input type="number" id={`bloom_${k}`} className="form-control bloom-input" min={0} max={100} step={1}
                        value={editing.bloom_weights?.[k] || 0}
                        onChange={(e) => setEditing({ ...editing, bloom_weights: { ...editing.bloom_weights, [k]: Number(e.target.value) } })} />
                      <span className="bloom-pct">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bloom-total" role="status" aria-live="polite">
                Total: <span>{bloomTotal}</span>%
                <span className={`bloom-total-badge ${bloomTotal === 100 ? 'ok' : 'warn'}`}>
                  {bloomTotal === 100 ? <><Check size={12} /> OK</> : `${bloomTotal}%`}
                </span>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <DetailsModal
        open={!!viewing}
        title={viewing?.title || 'Blueprint'}
        subtitle="Blueprint details"
        icon={Layers}
        accent={viewing ? groupColor(viewing.subject_id || viewing.subject_name) : undefined}
        onClose={() => setViewing(null)}
        fields={viewing ? [
          { label: 'Status', value: <StatusPill status={viewing.status} small inline />, kind: 'meta' },
          { label: 'Subject', value: viewing.subject_name, kind: 'meta' },
          { label: 'Topics', value: viewing.topic_count != null ? Number(viewing.topic_count) : null, kind: 'stat' },
          { label: 'Items', value: viewing.total_items != null ? Number(viewing.total_items) : null, kind: 'stat' },
          { label: 'Banked', value: `${blueprintCoverage(viewing).covered} of ${blueprintCoverage(viewing).total}` },
          { label: 'Exams built', value: Number(viewing.exam_count) || 0 },
          { label: 'Bloom mix', value: viewing.bloom_weights, kind: 'bloom' },
          { label: 'Created', value: fmtDate(viewing.created_at) },
          { label: 'Updated', value: fmtDate(viewing.updated_at) },
        ] : []}
      />
      {menuEl}
    </AppShell>
  );
}
