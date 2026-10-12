import '../styles/exams.css';
/**
 * ExamsPage — exam board grouped like a Monday board.
 *
 * Rows group by subject (default) or status, each group a collapsible band
 * with its own accent colour, a segmented status summary under the rows, and
 * an "add" row that opens the builder scoped to that subject. Toolbar holds
 * search, group-by and the primary action; sorting stays on the headers.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Info, Eye, Ellipsis, Search, FileCheck,
  Layers, Printer, MonitorSmartphone, Copy, FileText, PenLine, ListChecks,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import api, { ApiError } from '../lib/api.js';
import { vtNavigate } from '../lib/viewTransitions.js';
import DetailsModal from '../components/DetailsModal.jsx';
import AppShell from '../components/AppShell.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import { animateRows } from '../lib/animRows.js';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import {
  StatusPill, BoardGroupHead,
  BoardAddRow, GroupChip, groupColor, statusOf, statusMeta, STATUS_LABELS, STATUS_ORDER, StatCard,
} from '../components/Board.jsx';
import { useGridTable } from '../components/DataTable.jsx';

const FULL_SPAN = 7;
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

/** Roll a list of exams into { tone: count } for the summary strip. */
function statusCounts(list) {
  const counts = {};
  for (const e of list) {
    const tone = statusOf(e.status);
    counts[tone] = (counts[tone] || 0) + 1;
  }
  return counts;
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

  // KPI row — exam counts by status plus total questions assembled.
  const examStats = useMemo(() => (exams || []).reduce(
    (acc, e) => {
      const tone = statusOf(e.status);
      if (tone === 'live' || tone === 'published') acc.ready += 1;
      else if (tone === 'draft') acc.drafts += 1;
      acc.questions += Number(e.question_count) || 0;
      return acc;
    },
    { ready: 0, drafts: 0, questions: 0 },
  ), [exams]);

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
  const showSubject = groupBy !== 'subject';
  const colSpan = showSubject ? FULL_SPAN : FULL_SPAN - 1;

  function toggleGroup(key) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleDelete(exam) {
    if (!(await confirm(`Delete exam "${exam.title}"? Its sets, question links, and any scanned results are removed too — this cannot be undone.`, { title: 'Delete exam' }))) return;
    try { await api.del(`/exams/${exam.id}`); toast.success('Exam deleted.'); load(); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Delete failed.'); }
  }

  function examMenu(e, exam) {
    openMenu(e, [
      { label: 'View details', icon: Info, onClick: () => setViewing(exam) },
      { label: 'Open', icon: Eye, onClick: () => navigate(`/exams/${exam.id}`) },
      { label: 'Edit', icon: Pencil, onClick: () => navigate(`/exams/${exam.id}/edit`) },
      'sep',
      { label: 'Copy title', icon: Copy, onClick: () => copyText(exam.title, 'Title') },
      'sep',
      { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(exam) },
    ]);
  }

  // Render function (not a nested component) — a component type re-created
  // every render would force React to remount every row, re-triggering the
  // auto-animate on each state change (e.g. opening the context menu).
  function renderExamRow(e) {
    const count = e.question_count || 0;
    const print = e.format === 'print';
    const meta = [];
    if (e.duration_minutes) meta.push(`${e.duration_minutes} min`);
    meta.push(`${count} ${count === 1 ? 'item' : 'items'}`);
    return (
      <tr key={e.id} className="b-row" data-id={e.id} onContextMenu={(ev) => examMenu(ev, e)}>
        <td>
          <span className="g-primary">
            <Link
              to={`/exams/${e.id}`}
              className="g-title"
              onClick={(ev) => {
                // Let new-tab clicks (cmd/ctrl/middle) behave like a plain link.
                if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
                ev.preventDefault();
                vtNavigate(navigate, `/exams/${e.id}`, { sharedEl: ev.currentTarget });
              }}
            >
              {e.title}
            </Link>
            <span className="g-meta">
              {meta.join(' · ')}
              {e.title && e.title.length > 45 && (
                <>
                  {' · '}
                  <button type="button" className="g-more" onClick={() => setViewing(e)}>Read more</button>
                </>
              )}
            </span>
          </span>
        </td>
        {showSubject && (
          <td data-order={e.subject_name || ''}>
            {e.subject_name
              ? <GroupChip color={groupColor(e.subject_id || e.subject_name)}>{e.subject_name}</GroupChip>
              : <span className="g-mute">—</span>}
          </td>
        )}
        <td>
          <span className="g-inline">
            {print ? <Printer size={14} /> : <MonitorSmartphone size={14} />}
            {print ? 'Print' : 'Digital'}
          </span>
        </td>
        <td data-order={EXAM_STATUSES.indexOf(statusOf(e.status))}>
          <StatusPill status={e.status} />
        </td>
        <td className="is-num" data-order={count}>
          <span className={`g-count${count ? '' : ' is-zero'}`}>{count || '—'}</span>
        </td>
        <td className="g-mute" data-order={e.updated_at || e.created_at || ''}>
          {fmtDate(e.updated_at || e.created_at)}
        </td>
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

  return (
    <AppShell pageClass="exams" activeNav="exams" pageTitle="Exams" wide>

      {exams === null ? (
        <TableSkeleton />
      ) : exams.length === 0 ? (
        <div className="empty-state">
          <EmptyStateArt />
          <h4>No exams yet</h4>
          <p>Start from a blank paper, or generate one from a blueprint so the Bloom spread is decided for you.</p>
          <button className="btn btn-primary" data-tour="exams-new" onClick={() => navigate('/exams/new')}>
            <Plus size={16} /> New exam
          </button>
        </div>
      ) : (
        <>
        <div className="stats-grid">
          <StatCard icon={FileText} tint="blue" value={exams.length} label="Exams" />
          <StatCard icon={FileCheck} tint="green" value={examStats.ready} label="Live & published" />
          <StatCard icon={PenLine} tint="amber" value={examStats.drafts} label="Drafts" />
          <StatCard icon={ListChecks} tint="cyan" value={examStats.questions} label="Questions assembled" />
        </div>
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

          <div className="dataset-scroll" data-tour="exams-board">
            <table className="grid datatable" data-grid="exams" data-grid-label="exams">
              <caption className="sr-only">Exams in your workspace</caption>
              <thead>
                <tr>
                  <th className={`col-primary wp-31 ${sortClass('exam')}`} onClick={sortHandler('exam')} data-name="Exam" data-locked>Exam{renderSortArrow('exam')}</th>
                  {showSubject && <th className={`wp-16 ${sortClass('subject')}`} onClick={sortHandler('subject')} data-name="Subject">Subject{renderSortArrow('subject')}</th>}
                  <th className="wp-10" data-name="Format">Format</th>
                  <th className={`wp-12 ${sortClass('status')}`} onClick={sortHandler('status')} data-name="Status">Status{renderSortArrow('status')}</th>
                  <th className={`is-num wp-9 ${sortClass('items')}`} onClick={sortHandler('items')} data-name="Items">Items{renderSortArrow('items')}</th>
                  <th className={`wp-12 ${sortClass('updated')}`} onClick={sortHandler('updated')} data-name="Updated">Updated{renderSortArrow('updated')}</th>
                  <th className="col-actions wp-10">Actions</th>
                </tr>
              </thead>
              {groups.length === 0 ? (
                <tbody ref={animateRows}>
                  <tr>
                    <td className="ds-noresults" colSpan={colSpan}>
                      <span className="ds-noresults-title">No exams found</span>
                      <span className="ds-noresults-sub">
                        Try a different search or <button type="button" onClick={() => setQuery('')}>clear it</button>.
                      </span>
                    </td>
                  </tr>
                </tbody>
              ) : groups.map((g) => {
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
                    {grouped && groupBy === 'subject' && (
                      <BoardAddRow
                        colSpan={colSpan}
                        label="New exam"
                        href={g.rows[0]?.subject_id ? `/exams/new?subject_id=${encodeURIComponent(g.rows[0].subject_id)}` : '/exams/new'}
                        as={Link}
                      />
                    )}
                  </tbody>
                );
              })}
            </table>
          </div>
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
          { label: 'Format', value: viewing.format === 'print' ? 'Print' : 'Digital', kind: 'meta' },
          { label: 'Items', value: viewing.question_count || 0, kind: 'stat' },
          viewing.duration_minutes ? { label: 'Duration', value: `${viewing.duration_minutes} min`, kind: 'stat' } : null,
          { label: 'Updated', value: fmtDate(viewing.updated_at || viewing.created_at) },
        ].filter(Boolean) : []}
      />
      {menuEl}
    </AppShell>
  );
}
