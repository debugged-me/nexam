import '../styles/exams.css';
/**
 * ExamsPage — exam board grouped like a Monday board (adaptive list).
 *
 * Rows group by subject (default) or status. Each exam shows its blueprint,
 * items and optional OMR results (sheets scanned + class average).
 * ≥1200px the full table; 768–1199px
 * the secondary columns drop; <768px every exam is a card.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Info, Eye, Ellipsis, Search, FileCheck, Layers,
  Copy, ScanLine,
  ChartColumn, PanelsTopLeft,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import api, { ApiError } from '../lib/api.js';
import { vtNavigate } from '../lib/viewTransitions.js';
import { timeAgo } from '../lib/time.js';
import { useMediaQuery } from '../lib/useMediaQuery.js';
import { isPublished } from '../lib/examProgress.js';
import DetailsModal from '../components/DetailsModal.jsx';
import AppShell from '../components/AppShell.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import { animateRows } from '../lib/animRows.js';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import { Bubbles } from '../components/omr.jsx';
import {
  StatusPill, BoardGroupHead, CardGroup,
  GroupChip, groupColor, statusOf, statusMeta, STATUS_LABELS, STATUS_ORDER,
} from '../components/Board.jsx';
import { useGridTable } from '../components/DataTable.jsx';

const EXAM_STATUSES = STATUS_ORDER.exam;

// Sort accessors — id matches the column the header toggles.
const EXAM_COLUMNS = [
  { id: 'exam',    accessorFn: (e) => (e.title || '').toLowerCase() },
  { id: 'subject', accessorFn: (e) => (e.subject_name || '').toLowerCase() },
  { id: 'status',  accessorFn: (e) => EXAM_STATUSES.indexOf(statusOf(e.status)) },
  { id: 'items',   accessorFn: (e) => e.question_count || 0 },
  { id: 'updated', accessorFn: (e) => e.updated_at || e.created_at || '' },
];

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

/** Roll a list of exams into { tone: count } for the summary strip. */
function statusCounts(list) {
  const counts = {};
  for (const e of list) {
    const tone = statusOf(e.status);
    counts[tone] = (counts[tone] || 0) + 1;
  }
  return counts;
}

const SHEET_ROWS = 4;
const SHEET_COLS = 6;

/** Mini answer sheet shaded to the class average — the page's OMR mark.
 *  Marks scatter (i*7 permutation) so it reads like a real filled sheet. */
function ScoreSheet({ avg }) {
  const total = SHEET_ROWS * SHEET_COLS;
  const filled = avg == null ? 0 : Math.round((Math.min(Math.max(avg, 0), 100) / 100) * total);
  return (
    <span className="ex-sheet" aria-hidden="true">
      <span className="ex-sheet-head" />
      {Array.from({ length: SHEET_ROWS }, (_, r) => (
        <span className="ex-sheet-row" key={r}>
          <i className="ex-sheet-n">{r + 1}</i>
          {Array.from({ length: SHEET_COLS }, (_, c) => {
            const order = ((r * SHEET_COLS + c) * 7) % total;
            return <i key={c} className={`ex-sheet-b${order < filled ? ' is-marked' : ''}`} />;
          })}
        </span>
      ))}
    </span>
  );
}

export default function ExamsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const [exams, setExams] = useState(() => api.peek('/exams')?.exams ?? null);
  const [viewing, setViewing] = useState(null);
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState('subject'); // subject | status | none
  const [collapsed, setCollapsed] = useState(() => new Set());
  const searchRef = useRef(null);
  const asCards = useMediaQuery('(max-width: 767px)');

  const load = useCallback(() => {
    api.get('/exams')
      .then((data) => setExams(data.exams))
      .catch((err) => toast.error(err.message || 'Could not load exams.'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // "/" focuses the search field, matching the other boards.
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

  // Search + sort come from the shared grid machinery; grouping is layered
  // on top of the sorted rows below. No pagination — boards render fully.
  const grid = useGridTable({
    data: exams || [],
    columns: EXAM_COLUMNS,
    paginate: false,
    initialSorting: [{ id: 'updated', desc: true }],
    globalFilter: query,
    globalFilterFn: (row, _col, value) => {
      const e = row.original;
      return `${e.title || ''} ${e.subject_name || ''} ${e.subject_code || ''}`
        .toLowerCase()
        .includes(String(value).toLowerCase());
    },
  });
  const { pageRows: filtered, sortClass, sortHandler, renderSortArrow } = grid;

  // KPI row — exams, published, sheets scanned and the class average across
  // every scanned sheet (weighted by sheets, not by exam).
  const examStats = useMemo(() => (exams || []).reduce(
    (acc, e) => {
      if (isPublished(e)) acc.published += 1;
      if (statusOf(e.status) === 'draft') acc.drafts += 1;
      acc.sets += Number(e.set_count_generated) || 0;
      const scans = Number(e.scan_count) || 0;
      acc.scans += scans;
      if (scans && e.avg_score != null) { acc.scoreSum += Number(e.avg_score) * scans; acc.scored += scans; }
      return acc;
    },
    { published: 0, drafts: 0, sets: 0, scans: 0, scoreSum: 0, scored: 0 },
  ), [exams]);
  const overallAvg = examStats.scored ? Math.round(examStats.scoreSum / examStats.scored) : null;

  /** Ordered groups for the current group-by; 'none' collapses to one group. */
  const groups = useMemo(() => {
    if (groupBy === 'none') {
      return filtered.length ? [{ key: 'all', title: '', color: 'transparent', rows: filtered }] : [];
    }
    const map = new Map();
    for (const e of filtered) {
      let key, title, color;
      if (groupBy === 'status') {
        const tone = statusOf(e.status);
        key = `st-${tone}`;
        title = STATUS_LABELS[tone] || 'Other';
        color = `var(--st-${tone === 'live' ? 'green' : tone === 'published' ? 'blue' : tone === 'draft' ? 'orange' : tone === 'rejected' ? 'red' : 'gray'})`;
      } else {
        key = e.subject_id || 'none';
        title = e.subject_name || 'No subject';
        color = groupColor(e.subject_id || e.subject_name);
      }
      if (!map.has(key)) map.set(key, { key, title, color, rows: [], sortKey: title.toLowerCase() });
      map.get(key).rows.push(e);
    }
    const list = [...map.values()];
    if (groupBy === 'status') {
      list.sort((a, b) => EXAM_STATUSES.indexOf(a.key.slice(3)) - EXAM_STATUSES.indexOf(b.key.slice(3)));
    } else {
      list.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }
    return list;
  }, [filtered, groupBy]);

  const grouped = groupBy !== 'none';
  // Grouped by subject the Subject column only repeats the band title — drop
  // it and let every other column take the width (same trick as Questions).
  // A single-subject list reads the same value on every row, so it hides too.
  const singleSubject = useMemo(() => {
    if (!exams?.length) return false;
    return new Set(exams.map((e) => e.subject_id || 'none')).size === 1;
  }, [exams]);
  const showSubject = groupBy !== 'subject' && !singleSubject;
  const colSpan = showSubject ? 7 : 6;

  function toggleGroup(key) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleDelete(exam) {
    if (!(await confirm(`Delete exam "${exam.title}"? Its sets, question links, and any scanned results are removed too — this cannot be undone.`, { title: 'Delete exam' }))) return;
    try { await api.del(`/exams/${exam.id}?cascade=1`); toast.success('Exam deleted.'); load(); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Delete failed.'); }
  }

  function examMenu(e, exam) {
    openMenu(e, [
      { label: 'View details', icon: Info, onClick: () => setViewing(exam) },
      { label: 'Open', icon: Eye, onClick: () => navigate(`/exams/${exam.id}`) },
      { label: 'Edit', icon: Pencil, onClick: () => navigate(`/exams/${exam.id}/edit`) },
      Number(exam.scan_count) > 0 && { label: 'View results', icon: ChartColumn, onClick: () => navigate(`/analytics/exam/${exam.id}`) },
      exam.subject_id && { label: 'New exam in this subject', icon: Plus, onClick: () => navigate(`/exams/new?subject_id=${encodeURIComponent(exam.subject_id)}`) },
      'sep',
      { label: 'Copy title', icon: Copy, onClick: () => copyText(exam.title, 'Title') },
      'sep',
      { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(exam) },
    ]);
  }

  // Title link animates into the exam page; new-tab clicks stay plain links.
  function openExam(ev, id) {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
    ev.preventDefault();
    vtNavigate(navigate, `/exams/${id}`, { sharedEl: ev.currentTarget });
  }

  /** Items · duration · blueprint — shared by rows and cards. */
  function examFacts(e, { withItems = false } = {}) {
    const count = e.question_count || 0;
    return (
      <>
        {withItems && <span>{count} {count === 1 ? 'item' : 'items'}</span>}
        {!withItems && <span className="ex-meta-items">{count} {count === 1 ? 'item' : 'items'}</span>}
        {/* Generated set letters as mini cover-stamps — matches the
            print-pack badge language on the exam detail page. */}
        {Number(e.set_count_generated) > 0 && (
          <span className="ex-sets" title={`${e.set_count_generated} sets generated`}>
            {Array.from({ length: Math.min(Number(e.set_count_generated), 6) }, (_, i) => (
              <i key={i}>{String.fromCharCode(65 + i)}</i>
            ))}
          </span>
        )}
        {e.duration_minutes ? <span>{e.duration_minutes} min</span> : null}
        {Number(e.scan_count) > 0 && (
          <span
            className="ex-scan-chip"
            title={`${e.scan_count} OMR sheet${Number(e.scan_count) === 1 ? '' : 's'} scanned${e.avg_score != null ? ` · class average ${Math.round(Number(e.avg_score))}%` : ''}`}
          >
            <ScanLine size={12} aria-hidden="true" />
            {e.scan_count}
            {e.avg_score != null && <em>{Math.round(Number(e.avg_score))}%</em>}
          </span>
        )}
        {e.tos_id && e.tos_title && (
          <Link to={`/tos/${e.tos_id}`} className="row-meta-icon ex-meta-tos" title={`Blueprint: ${e.tos_title}`}>
            <PanelsTopLeft size={13} aria-hidden="true" /><span>{e.tos_title}</span>
          </Link>
        )}
      </>
    );
  }

  // Render function (not a nested component) — a component type re-created
  // every render would force React to remount every row, re-triggering the
  // auto-animate on each state change (e.g. opening the context menu).
  function renderExamRow(e) {
    const count = e.question_count || 0;
    const touched = e.updated_at || e.created_at;
    return (
      <tr key={e.id} className="b-row" data-id={e.id} onContextMenu={(ev) => examMenu(ev, e)}>
        <td className="col-primary">
          <span className="g-primary">
            <Link to={`/exams/${e.id}`} className="g-title" title={e.title} onClick={(ev) => openExam(ev, e.id)}>
              {e.title}
            </Link>
            <span className="row-meta">
              <span className="row-meta-status"><StatusPill status={e.status} small /></span>
              {examFacts(e)}
            </span>
          </span>
        </td>
        {showSubject && (
          <td className="col-opt" data-order={e.subject_name || ''}>
            {e.subject_name
              ? <GroupChip color={groupColor(e.subject_id || e.subject_name)}>{e.subject_name}</GroupChip>
              : <span className="g-mute">—</span>}
          </td>
        )}
        <td className="col-opt" data-order={EXAM_STATUSES.indexOf(statusOf(e.status))}>
          <StatusPill status={e.status} />
        </td>
        <td className="is-num col-opt" data-order={count}>
          <span className={`g-count${count ? '' : ' is-zero'}`}>{count || '—'}</span>
        </td>
        <td className="g-mute" title={fmtDate(touched)}>{touchedText(touched)}</td>
        <td className="col-actions">
          {/* Same floating menu as right-click — uniform with Subjects/Questions. */}
          <button
            type="button"
            className="g-menu"
            onClick={(ev) => examMenu(ev, e)}
            title="Actions"
            aria-label={`Actions for ${e.title}`}
          >
            <Ellipsis size={15} />
          </button>
        </td>
      </tr>
    );
  }

  function renderExamCard(e) {
    return (
      <li key={e.id} className="row-card" style={{ '--gc': groupColor(e.subject_id || e.subject_name) }} onContextMenu={(ev) => examMenu(ev, e)}>
        <div className="row-card-top">
          <StatusPill status={e.status} small />
          <span className="row-card-when">{touchedText(e.updated_at || e.created_at)}</span>
          <button type="button" className="g-menu" onClick={(ev) => examMenu(ev, e)} aria-label={`Actions for ${e.title}`}>
            <Ellipsis size={16} />
          </button>
        </div>
        <Link to={`/exams/${e.id}`} className="row-card-title" onClick={(ev) => openExam(ev, e.id)}>{e.title}</Link>
        <span className="row-meta">
          {showSubject && e.subject_name && <GroupChip color={groupColor(e.subject_id || e.subject_name)}>{e.subject_name}</GroupChip>}
          {examFacts(e, { withItems: true })}
        </span>

      </li>
    );
  }

  const noMatch = (
    <div className="row-nomatch">
      <p>No exams match “{query.trim()}”.</p>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setQuery('')}>Clear search</button>
    </div>
  );

  return (
    <AppShell pageClass="exams" activeNav="exams" pageTitle="Exams" wide>

      {exams === null ? (
        <TableSkeleton />
      ) : exams.length === 0 ? (
        <div className="empty-state">
          <EmptyStateArt art="paper" tone={3} />
          <h4>No exams yet</h4>
          <p>Start from a blank paper, or generate one from a blueprint so the Bloom spread is decided for you.</p>
          <Bubbles className="ex-empty-bubbles" count={8} marked={3} />
          <button className="btn btn-primary" data-tour="exams-new" onClick={() => navigate('/exams/new')}>
            <Plus size={16} /> New exam
          </button>
        </div>
      ) : (
        <>
        <p className="ex-delivery-note">Print exam papers or export to an LMS. For optional OMR grading, scan completed answer sheets with the Nexam mobile app.</p>
        <section className="ex-scanband" data-tour="exams-scanband" aria-label="Exams and OMR scoring summary">
          <div className="ex-scanband-lead">
            <ScoreSheet avg={overallAvg} />
            <div className="ex-scanband-score">
              <strong>{overallAvg != null ? `${overallAvg}%` : '—'}</strong>
              <span className="ex-scanband-cap">class average</span>
              <span className="ex-scanband-sub">
                {examStats.scans
                  ? `${examStats.scans} OMR sheet${examStats.scans === 1 ? '' : 's'} scanned`
                  : 'No sheets scanned yet'}
              </span>
            </div>
          </div>
          <ul className="ex-scanband-facts">
            <li><strong>{exams.length}</strong><span>exam{exams.length === 1 ? '' : 's'}</span></li>
            <li><strong>{examStats.published}</strong><span>published</span></li>
            <li><strong>{examStats.drafts}</strong><span>draft{examStats.drafts === 1 ? '' : 's'}</span></li>
            <li><strong>{examStats.sets}</strong><span>sets generated</span></li>
          </ul>
        </section>
        <section className="dataset" data-density="comfortable">
          <div className="dataset-bar" data-tour="exams-toolbar">
            <div className="dataset-bar-lead">
              <label className="ds-search" htmlFor="exams-search">
                <Search size={15} />
                <span className="sr-only">Search exams</span>
                <input
                  id="exams-search"
                  ref={searchRef}
                  type="search"
                  autoComplete="off"
                  placeholder="Search exams or subjects…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd aria-hidden="true">/</kbd>
              </label>
              <span className="b-groupby">
                <Layers size={14} aria-hidden="true" />
                <select
                  aria-label="Group exams by"
                  data-active={grouped}
                  value={groupBy}
                  onChange={(e) => { setGroupBy(e.target.value); setCollapsed(new Set()); }}
                >
                  <option value="subject">Group: Subject</option>
                  <option value="status">Group: Status</option>
                  <option value="none">Group: None</option>
                </select>
              </span>
            </div>
            <div className="dataset-bar-trail">
              <button className="btn btn-primary btn-sm" data-tour="exams-new" onClick={() => navigate('/exams/new')}>
                <Plus size={14} /> New exam
              </button>
            </div>
          </div>

          {groups.length === 0 ? noMatch : asCards ? (
            <div className="row-cards" data-tour="exams-board">
              {grouped ? groups.map((g) => (
                <CardGroup key={g.key} title={g.title} color={g.color} count={g.rows.length} collapsed={collapsed.has(g.key)} onToggle={() => toggleGroup(g.key)}>
                  <ul className="row-card-list" ref={animateRows}>{g.rows.map(renderExamCard)}</ul>
                </CardGroup>
              )) : (
                <ul className="row-card-list" ref={animateRows}>{groups[0].rows.map(renderExamCard)}</ul>
              )}
            </div>
          ) : (
          <div className="dataset-scroll" data-tour="exams-board">
            <table className="grid datatable ex-table is-adaptive" data-grid="exams" data-grid-label="exams">
              <caption className="sr-only">Exams in your workspace</caption>
              <thead>
                <tr>
                  <th className={`col-primary ex-c-title ${showSubject ? 'wp-45' : 'wp-55'} ${sortClass('exam')}`} onClick={sortHandler('exam')} data-name="Exam" data-locked>Exam{renderSortArrow('exam')}</th>
                  {showSubject && <th className={`wp-14 col-opt ${sortClass('subject')}`} onClick={sortHandler('subject')} data-name="Subject">Subject{renderSortArrow('subject')}</th>}
                  <th className={`${showSubject ? 'wp-12' : 'wp-14'} col-opt ${sortClass('status')}`} onClick={sortHandler('status')} data-name="Status">Status{renderSortArrow('status')}</th>
                  <th className={`is-num ${showSubject ? 'wp-8' : 'wp-9'} col-opt ${sortClass('items')}`} onClick={sortHandler('items')} data-name="Items">Items{renderSortArrow('items')}</th>
                  <th className={`${showSubject ? 'wp-16' : 'wp-17'} ex-c-upd ${sortClass('updated')}`} onClick={sortHandler('updated')} data-name="Updated">Updated{renderSortArrow('updated')}</th>
                  <th className="col-actions wp-5 ex-c-act"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              {groups.map((g) => {
                const isCollapsed = collapsed.has(g.key);
                const counts = statusCounts(g.rows);
                const itemTotal = g.rows.reduce((n, e) => n + (e.question_count || 0), 0);
                return (
                  <tbody key={g.key} ref={animateRows} className={`b-group${isCollapsed ? ' is-collapsed' : ''}`} style={{ '--gc': g.color }}>
                    {grouped && (
                      <BoardGroupHead
                        color={g.color}
                        title={g.title}
                        count={g.rows.length}
                        meta={[
                          groupBy !== 'status' ? statusMeta(counts, EXAM_STATUSES) : '',
                          itemTotal ? `${itemTotal} item${itemTotal === 1 ? '' : 's'}` : '',
                        ].filter(Boolean).join(' · ') || undefined}
                        colSpan={colSpan}
                        collapsed={isCollapsed}
                        onToggle={() => toggleGroup(g.key)}
                      />
                    )}
                    {g.rows.map(renderExamRow)}
                  </tbody>
                );
              })}
            </table>
          </div>
          )}
        </section>
        </>
      )}
      <DetailsModal
        open={!!viewing}
        title={viewing?.title || 'Exam'}
        subtitle="Exam details"
        icon={FileCheck}
        accent={viewing ? groupColor(viewing.subject_id || viewing.subject_name) : undefined}
        onClose={() => setViewing(null)}
        fields={viewing ? [
          { label: 'Status', value: <StatusPill status={viewing.status} small inline />, kind: 'meta' },
          { label: 'Subject', value: viewing.subject_name, kind: 'meta' },
          { label: 'Preferred format', value: viewing.format === 'print' ? 'Print' : 'LMS export', kind: 'meta' },
          { label: 'Items', value: viewing.question_count || 0, kind: 'stat' },
          viewing.duration_minutes ? { label: 'Duration', value: `${viewing.duration_minutes} min`, kind: 'stat' } : null,
          viewing.tos_title ? { label: 'Blueprint', value: viewing.tos_title } : null,
          { label: 'OMR sheets scanned', value: Number(viewing.scan_count) || 0 },
          viewing.avg_score != null ? { label: 'OMR class average', value: `${Math.round(Number(viewing.avg_score))}%` } : null,
          { label: 'Updated', value: fmtDate(viewing.updated_at || viewing.created_at) },
        ].filter(Boolean) : []}
      />
      {menuEl}
    </AppShell>
  );
}
