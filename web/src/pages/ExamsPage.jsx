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
  Plus, Pencil, Trash2, Info, Eye, Ellipsis, Search,
  Layers, ChevronUp, ChevronDown, Printer, MonitorSmartphone,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { PageLoader } from '../components/Loaders.jsx';
import {
  StatusPill, StatusSummary, BoardGroupHead, BoardGroupFoot,
  BoardAddRow, GroupChip, groupColor, statusOf, STATUS_LABELS, STATUS_ORDER,
} from '../components/Board.jsx';
import '../styles/exams.css';

const COL_SPAN = 7;
const EXAM_STATUSES = STATUS_ORDER.exam;

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
  const navigate = useNavigate();
  const [exams, setExams] = useState(() => api.peek('/exams')?.exams ?? null);
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState('subject'); // subject | status | none
  const [sort, setSort] = useState({ col: 'updated', dir: 'desc' });
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

  const filtered = useMemo(() => {
    if (!exams) return [];
    const q = query.trim().toLowerCase();
    let rows = q
      ? exams.filter((e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.subject_name || '').toLowerCase().includes(q) ||
          (e.subject_code || '').toLowerCase().includes(q))
      : [...exams];
    const mul = sort.dir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      let av, bv;
      switch (sort.col) {
        case 'exam':    av = (a.title || '').toLowerCase(); bv = (b.title || '').toLowerCase(); break;
        case 'subject': av = (a.subject_name || '').toLowerCase(); bv = (b.subject_name || '').toLowerCase(); break;
        case 'status':  av = EXAM_STATUSES.indexOf(statusOf(a.status)); bv = EXAM_STATUSES.indexOf(statusOf(b.status)); break;
        case 'items':   av = a.question_count || 0; bv = b.question_count || 0; break;
        default:        av = a.updated_at || a.created_at || ''; bv = b.updated_at || b.created_at || '';
      }
      return av < bv ? -mul : av > bv ? mul : 0;
    });
    return rows;
  }, [exams, query, sort]);

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

  function toggleSort(col) {
    setSort((prev) => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' });
  }
  function sortClass(col) {
    if (sort.col !== col) return 'sorting';
    return sort.dir === 'asc' ? 'sorting_asc' : 'sorting_desc';
  }
  const sortArrow = (col) => sort.col !== col ? null : (
    <span className="ds-sort">{sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
  );

  function toggleGroup(key) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleDelete(exam) {
    if (!confirm(`Delete exam "${exam.title}"? This cannot be undone.`)) return;
    try { await api.del(`/exams/${exam.id}`); toast.success('Exam deleted.'); load(); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Delete failed.'); }
  }

  function ExamRow({ e }) {
    const count = e.question_count || 0;
    const print = e.format === 'print';
    const meta = [];
    if (e.duration_minutes) meta.push(`${e.duration_minutes} min`);
    meta.push(`${count} ${count === 1 ? 'item' : 'items'}`);
    return (
      <tr className="b-row" data-id={e.id}>
        <td>
          <span className="g-primary">
            <Link to={`/exams/${e.id}`} className="g-title">{e.title}</Link>
            <span className="g-meta">{meta.join(' · ')}</span>
          </span>
        </td>
        <td data-order={e.subject_name || ''}>
          {e.subject_name
            ? <GroupChip color={groupColor(e.subject_id || e.subject_name)}>{e.subject_name}</GroupChip>
            : <span className="g-mute">—</span>}
        </td>
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
          <details className="g-menu">
            <summary className="g-menu-trigger" aria-label={`Actions for ${e.title}`}>
              <Ellipsis size={16} />
            </summary>
            <div className="g-menu-panel">
              <Link to={`/exams/${e.id}`} className="g-menu-item"><Eye size={15} /> Open</Link>
              <Link to={`/exams/${e.id}/edit`} className="g-menu-item"><Pencil size={15} /> Edit</Link>
              <div className="g-menu-sep" />
              <button type="button" className="g-menu-item is-danger" onClick={() => handleDelete(e)}>
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </details>
        </td>
      </tr>
    );
  }

  return (
    <AppShell activeNav="exams" pageTitle="Exams" wide>
      <header className="list-head">
        <div className="list-head-main">
          <h1 className="list-head-title">
            Exams
            {exams && exams.length > 0 && <span className="list-head-count">{exams.length}</span>}
          </h1>
          <details className="list-head-info">
            <summary aria-label="About exams"><Info size={16} /></summary>
            <p>Draft and published papers assembled from your question bank.</p>
          </details>
        </div>
        <div className="list-head-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/exams/new')}>
            <Plus size={16} /> New exam
          </button>
        </div>
      </header>

      {exams === null ? (
        <PageLoader label="Loading exams…" />
      ) : exams.length === 0 ? (
        <div className="empty-state">
          <h4>No exams yet</h4>
          <p>Start from a blank paper, or generate one from a blueprint so the Bloom spread is decided for you.</p>
          <button className="btn btn-primary" onClick={() => navigate('/exams/new')}>
            <Plus size={16} /> New exam
          </button>
        </div>
      ) : (
        <section className="dataset" data-density="comfortable">
          <div className="dataset-bar">
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
              <StatusSummary counts={statusCounts(filtered)} order={EXAM_STATUSES} legend={false} totalLabel={`${filtered.length} exam${filtered.length === 1 ? '' : 's'}`} />
            </div>
          </div>

          <div className="dataset-scroll">
            <table className="grid datatable" data-grid="exams" data-grid-label="exams">
              <caption className="sr-only">Exams in your workspace</caption>
              <thead>
                <tr>
                  <th className={`col-primary wp-33 ${sortClass('exam')}`} onClick={() => toggleSort('exam')} data-name="Exam" data-locked>Exam{sortArrow('exam')}</th>
                  <th className={`wp-17 ${sortClass('subject')}`} onClick={() => toggleSort('subject')} data-name="Subject">Subject{sortArrow('subject')}</th>
                  <th className="wp-10" data-name="Format">Format</th>
                  <th className={`wp-12 ${sortClass('status')}`} onClick={() => toggleSort('status')} data-name="Status">Status{sortArrow('status')}</th>
                  <th className={`is-num wp-9 ${sortClass('items')}`} onClick={() => toggleSort('items')} data-name="Items">Items{sortArrow('items')}</th>
                  <th className={`wp-14 ${sortClass('updated')}`} onClick={() => toggleSort('updated')} data-name="Updated">Updated{sortArrow('updated')}</th>
                  <th className="col-actions wp-5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              {groups.length === 0 ? (
                <tbody>
                  <tr>
                    <td className="ds-noresults" colSpan={COL_SPAN}>
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
                  <tbody key={g.key} className={`b-group${isCollapsed ? ' is-collapsed' : ''}`} style={{ '--gc': g.color }}>
                    {grouped && (
                      <BoardGroupHead
                        color={g.color}
                        title={g.title}
                        count={g.rows.length}
                        meta={groupBy === 'subject' && itemTotal ? `${itemTotal} items` : undefined}
                        colSpan={COL_SPAN}
                        collapsed={isCollapsed}
                        onToggle={() => toggleGroup(g.key)}
                      />
                    )}
                    {g.rows.map((e) => <ExamRow key={e.id} e={e} />)}
                    {grouped && (
                      <BoardGroupFoot colSpan={COL_SPAN}>
                        <StatusSummary counts={counts} order={EXAM_STATUSES} totalLabel={`${g.rows.length} exam${g.rows.length === 1 ? '' : 's'}`} />
                      </BoardGroupFoot>
                    )}
                    {grouped && groupBy === 'subject' && (
                      <BoardAddRow
                        colSpan={COL_SPAN}
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
      )}
    </AppShell>
  );
}
