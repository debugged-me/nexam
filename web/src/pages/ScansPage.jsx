import '../styles/scans.css';
/**
 * ScansPage — scan records: every sheet scanned, plus the roster it builds.
 *
 * Two views of the same data under one roof:
 *   sheets   — the flat, searchable archive of every scanned answer sheet;
 *              rows open ScanReviewModal for per-item corrections.
 *   students — the roster scans auto-create (StudentsPanel): rename, fix
 *              IDs, merge duplicates so sheets stop double-counting.
 * Tab lives in the URL (?tab=) so either view is deep-linkable.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle, CheckCircle, ClipboardList, Copy, Ellipsis, GraduationCap,
  Layers, ScanLine, Search,
} from 'lucide-react';
import api from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useGridTable, DatasetFoot } from '../components/DataTable.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import AppShell from '../components/AppShell.jsx';
import ScanReviewModal from '../components/ScanReviewModal.jsx';
import StudentsPanel from '../components/StudentsPanel.jsx';
import Tooltip from '../components/Tooltip.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import { animateRows } from '../lib/animRows.js';
import { fmtScanned, timeAgo } from '../lib/time.js';

const COLUMNS = [
  { id: 'student', accessorFn: (r) => r.student_name || '' },
  { id: 'exam', accessorKey: 'exam_title' },
  { id: 'set', accessorKey: 'set_label' },
  { id: 'score', accessorKey: 'score' },
  { id: 'review', accessorKey: 'needs_review' },
  { id: 'scanned', accessorKey: 'scanned_at' },
  { id: 'act', enableSorting: false },
];

const FILTERS = [
  { id: 'all', label: 'All sheets', status: 'all' },
  { id: 'review', label: 'Needs review', status: 'review' },
  { id: 'done', label: 'Reviewed', status: 'done' },
];

/** Score-band histogram + headline stats, mirroring the Questions qmix. */
function ScanMix({ scans }) {
  const bands = [[0, '<60', 'var(--red-600)'], [0, '60–74', 'var(--amber-600)'], [0, '75–89', 'var(--green-600)'], [0, '90+', 'var(--blue-600)']];
  let sum = 0;
  const ids = new Set();
  scans.forEach((s) => {
    const v = Number(s.score) || 0;
    sum += v;
    if (s.student_id) ids.add(s.student_id);
    bands[v < 60 ? 0 : v < 75 ? 1 : v < 90 ? 2 : 3][0] += 1;
  });
  const max = Math.max(1, ...bands.map((b) => b[0]));
  const label = bands.map(([n, l]) => `${n} scoring ${l}`).join(', ');
  return (
    <div className="scmix" role="img" aria-label={`Score bands — ${label}`}>
      <div className="scmix-bands">
        {bands.map(([n, l, color]) => (
          <span key={l} className="scmix-band" title={`${l}: ${n} sheet${n === 1 ? '' : 's'}`}>
            <i style={{ height: `${Math.max(8, (n / max) * 100)}%`, background: color }} />
          </span>
        ))}
      </div>
      <div className="scmix-legend">
        <span className="scmix-item">Avg <strong>{scans.length ? (sum / scans.length).toFixed(0) : 0}%</strong></span>
        <span className="scmix-item">Students <strong>{ids.size}</strong></span>
        <span className="scmix-item">Sheets <strong>{scans.length}</strong></span>
      </div>
    </div>
  );
}

export default function ScansPage() {
  const toast = useToast();
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const searchRef = useRef(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'students' ? 'students' : 'sheets';

  const [scans, setScans] = useState(null);
  const [exams, setExams] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [examId, setExamId] = useState(params.get('exam') || '');
  const [setLabel, setSetLabel] = useState('');
  const [reviewScanId, setReviewScanId] = useState(null);

  const load = useCallback(() => {
    // Limit is deliberately generous — this page is the flat archive;
    // the server caps at 1000.
    api.get('/scans?limit=1000')
      .then((d) => setScans(d.scans || []))
      .catch((err) => toast.error(err.message || 'Could not load scans.'));
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/exams')
      .then((d) => setExams(d.exams || []))
      .catch(() => {});
  }, []);

  // Set options are whatever labels the loaded scans actually carry,
  // narrowed to the picked exam.
  const setOptions = useMemo(() => (
    [...new Set((scans || [])
      .filter((s) => !examId || s.exam_id === examId)
      .map((s) => s.set_label).filter(Boolean))].sort()
  ), [scans, examId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (scans || []).filter((s) =>
      (filter === 'review' ? !!s.needs_review : filter === 'done' ? !s.needs_review : true)
      && (!examId || s.exam_id === examId)
      && (!setLabel || s.set_label === setLabel)
      && (!q
        || (s.student_name || '').toLowerCase().includes(q)
        || (s.student_number || '').toLowerCase().includes(q)
        || (s.exam_title || '').toLowerCase().includes(q)));
  }, [scans, query, filter, examId, setLabel]);

  const grid = useGridTable({
    data: filtered, columns: COLUMNS, pageSize: 20,
    storageKey: 'scans-list', resetKey: `${query}|${filter}|${examId}|${setLabel}`,
  });
  const { pageRows, sortClass, sortHandler, renderSortArrow } = grid;

  const flagged = (scans || []).filter((s) => s.needs_review).length;

  useEffect(() => {
    if (tab !== 'sheets') return undefined;
    const onKey = (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  /** Corrections recount server-side — invalidate and reload. */
  const afterReview = () => {
    api.invalidate('/scans');
    api.invalidate('/analytics');
    load();
  };

  function setTab(next) {
    setParams(next === 'sheets' ? {} : { tab: next }, { replace: true });
  }

  function scanMenu(e, s) {
    openMenu(e, [
      { label: 'Open sheet', icon: ScanLine, onClick: () => setReviewScanId(s.id) },
      'sep',
      s.student_name && { label: 'Copy student name', icon: Copy, onClick: () => copyText(s.student_name, 'Name') },
      s.student_number && { label: 'Copy student ID', icon: Copy, onClick: () => copyText(s.student_number, 'Student ID') },
      { label: 'Copy score', icon: Copy, onClick: () => copyText(`${Number(s.score || 0).toFixed(1)}%`, 'Score') },
    ]);
  }

  // View tabs share the segmented-control idiom with the status tabs and
  // the question bank — rendered in the dataset bar's trailing slot in
  // both views so it never jumps position.
  const tabsEl = (
    <div className="sc-tabs" role="tablist" aria-label="Scan records view" data-tour="scans-views">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'sheets'}
        className="sc-tab"
        data-status={flagged > 0 ? 'review' : 'all'}
        onClick={() => setTab('sheets')}
      >
        <ScanLine size={14} aria-hidden="true" /> Answer sheets
        <span className="sc-tab-count">{flagged > 0 ? flagged : scans?.length || 0}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'students'}
        className="sc-tab"
        onClick={() => setTab('students')}
      >
        <GraduationCap size={14} aria-hidden="true" /> Students
      </button>
    </div>
  );

  return (
    <AppShell pageClass="scans" activeNav="scans" pageTitle="OMR scans" wide>
      {tab === 'students' ? <StudentsPanel tabs={tabsEl} /> : (
        <section className="dataset" data-dataset>
          <div className="dataset-bar">
            <div className="dataset-bar-lead">
              <label className="ds-search" htmlFor="scans-search">
                <Search size={15} />
                <span className="sr-only">Search scans</span>
                <input
                  id="scans-search"
                  ref={searchRef}
                  type="search"
                  autoComplete="off"
                  placeholder="Search student, ID, or exam…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd aria-hidden="true">/</kbd>
              </label>

              <span className="b-groupby" data-tour="scans-filters">
                <ClipboardList size={14} aria-hidden="true" />
                <select
                  aria-label="Filter by exam"
                  data-active={examId ? 'true' : undefined}
                  value={examId}
                  onChange={(e) => { setExamId(e.target.value); setSetLabel(''); }}
                >
                  <option value="">All exams</option>
                  {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                </select>
              </span>

              <span className="b-groupby">
                <Layers size={14} aria-hidden="true" />
                <select
                  aria-label="Filter by set"
                  data-active={setLabel ? 'true' : undefined}
                  value={setLabel}
                  onChange={(e) => setSetLabel(e.target.value)}
                >
                  <option value="">All sets</option>
                  {setOptions.map((l) => <option key={l} value={l}>Set {l}</option>)}
                </select>
              </span>
            </div>
            <div className="dataset-bar-trail">{tabsEl}</div>
          </div>

          {/* Status strip — same idiom as the question bank: segmented
              status tabs with tinted counts + a live distribution widget. */}
          <div className="sc-statusbar">
            <div className="sc-tabs" role="group" aria-label="Review status" data-tour="scans-status">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="sc-tab"
                  data-status={f.status}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className="sc-tab-count">
                    {f.id === 'review' ? flagged : f.id === 'done' ? (scans?.length || 0) - flagged : scans?.length || 0}
                  </span>
                </button>
              ))}
            </div>
            {filtered.length > 0 && <div data-tour="scans-mix"><ScanMix scans={filtered} /></div>}
          </div>

          {!scans ? <TableSkeleton /> : filtered.length === 0 ? (
            <div className="empty-state empty-state-md">
              <EmptyStateArt size={88} art="scan" />
              <p>{query || filter !== 'all'
                ? 'No sheets match this view.'
                : 'No scans yet — capture OMR sheets in the mobile app and they land here.'}</p>
            </div>
          ) : (
            <div className="dataset-scroll" data-tour="scans-grid">
              <table className="grid datatable">
                <caption className="sr-only">Scanned answer sheets</caption>
                <thead>
                  <tr>
                    <th className={`col-primary wp-26 ${sortClass('student')}`} onClick={sortHandler('student')} data-name="Student">Student{renderSortArrow('student')}</th>
                    <th className={`wp-24 ${sortClass('exam')}`} onClick={sortHandler('exam')} data-name="Exam">Exam{renderSortArrow('exam')}</th>
                    <th className={`wp-6 ${sortClass('set')}`} onClick={sortHandler('set')} data-name="Set">Set{renderSortArrow('set')}</th>
                    <th className={`wp-10 is-num ${sortClass('score')}`} onClick={sortHandler('score')} data-name="Score">Score{renderSortArrow('score')}</th>
                    <th className={`wp-13 ${sortClass('review')}`} onClick={sortHandler('review')} data-name="Status">Status{renderSortArrow('review')}</th>
                    <th className={`wp-13 ${sortClass('scanned')}`} onClick={sortHandler('scanned')} data-name="Scanned">Scanned{renderSortArrow('scanned')}</th>
                    <th className="col-actions wp-8"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody ref={animateRows}>
                  {pageRows.map((s) => {
                    const score = Number(s.score || 0);
                    return (
                      <tr
                        key={s.id}
                        className="sc-row"
                        title="Open scanned sheet"
                        onClick={() => setReviewScanId(s.id)}
                        onContextMenu={(e) => scanMenu(e, s)}
                      >
                        <td className="col-primary">
                          <span className="g-entity">
                            <span className="g-primary">
                              <span className="g-title">{s.student_name || 'Unknown'}</span>
                              <span className="g-meta">{s.student_number ? `#${s.student_number}` : 'No ID'}</span>
                            </span>
                          </span>
                        </td>
                        <td className="g-mute"><span className="sc-exam" title={s.exam_title}>{s.exam_title || '—'}</span></td>
                        <td><span className="badge badge-gray">{s.set_label || '—'}</span></td>
                        <td className="is-num">
                          <span className={`badge badge-${score >= 75 ? 'green' : 'amber'}`}>{score.toFixed(1)}%</span>
                        </td>
                        <td>
                          {s.needs_review ? (
                            <span className="g-state is-draft"><AlertCircle size={13} /> Needs review</span>
                          ) : (
                            <span className="g-state is-live"><CheckCircle size={13} /> Reviewed</span>
                          )}
                        </td>
                        <td className="g-mute" title={fmtScanned(s.scanned_at)}>{timeAgo(s.scanned_at) || fmtScanned(s.scanned_at)}</td>
                        <td className="col-actions">
                          <Tooltip label="Actions">
                            <button
                              type="button"
                              className="g-menu"
                              onClick={(e) => { e.stopPropagation(); scanMenu(e, s); }}
                              aria-label={`Actions for ${s.student_name || 'this scan'}`}
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
          )}
          {scans && filtered.length > 0 && <DatasetFoot grid={grid} pageSizeOptions={[20, 50, 100]} />}
        </section>
      )}

      {menuEl}

      <ScanReviewModal
        scanId={reviewScanId}
        onClose={() => setReviewScanId(null)}
        onSaved={afterReview}
      />
    </AppShell>
  );
}
