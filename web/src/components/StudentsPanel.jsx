/**
 * StudentsPanel — the roster that OMR scanning builds up.
 *
 * Every scanned sheet creates or reuses a student record (matched by
 * student number, then exact name). Because scans create students
 * implicitly, typos and spelling variants accumulate — this panel is the
 * cleanup surface: search the roster, rename a record (scan snapshots are
 * refreshed so reports follow), and merge a duplicate into the real record
 * so their sheets stop counting twice. Rendered as the Students tab inside
 * ScansPage — the shell and page-header live there.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy, Ellipsis, Merge, Pencil, Search,
  AlertCircle, CheckCircle,
} from 'lucide-react';
import api, { ApiError } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import { useConfirm } from './ConfirmDialog.jsx';
import { useContextMenu, useCopyText } from './ContextMenu.jsx';
import { useGridTable, DatasetFoot } from './DataTable.jsx';
import EmptyStateArt from './EmptyStateArt.jsx';
import Modal from './Modal.jsx';
import Tooltip from './Tooltip.jsx';
import { TableSkeleton } from './Loaders.jsx';
import { animateRows } from '../lib/animRows.js';
import { fmtScanned, timeAgo } from '../lib/time.js';

const COLUMNS = [
  { id: 'name', accessorKey: 'full_name' },
  { id: 'number', accessorKey: 'student_number' },
  { id: 'subject', accessorKey: 'subject_code' },
  { id: 'scans', accessorKey: 'scan_count' },
  { id: 'review', accessorKey: 'needs_review' },
  { id: 'last', accessorKey: 'last_scanned_at' },
  { id: 'act', enableSorting: false },
];

export default function StudentsPanel({ tabs }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const searchRef = useRef(null);

  const [students, setStudents] = useState(null);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState(null);       // student row
  const [merging, setMerging] = useState(null);         // source student row
  const [mergeTarget, setMergeTarget] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/students')
      .then((d) => setStudents(d.students || []))
      .catch((err) => toast.error(err.message || 'Could not load students.'));
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  // Search is client-side substring over the decrypted roster — the API
  // already returns every row scoped to this instructor.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students || [];
    return (students || []).filter((s) =>
      (s.full_name || '').toLowerCase().includes(q)
      || (s.student_number || '').toLowerCase().includes(q));
  }, [students, query]);

  const grid = useGridTable({
    data: filtered, columns: COLUMNS, pageSize: 15,
    storageKey: 'students-roster', resetKey: query,
    initialSorting: [{ id: 'name', desc: false }],
  });
  const { pageRows, sortClass, sortHandler, renderSortArrow } = grid;

  const pendingReview = (students || []).reduce((n, s) => n + (s.needs_review ? 1 : 0), 0);

  // '/' focuses search, matching the other dataset pages.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function saveRename(e) {
    e.preventDefault();
    if (!renaming || busy) return;
    const fd = new FormData(e.currentTarget);
    const fullName = String(fd.get('fullName') || '').trim();
    const studentNumber = String(fd.get('studentNumber') || '').trim();
    if (!fullName) { toast.error('A name is required.'); return; }
    setBusy(true);
    try {
      await api.patch(`/students/${renaming.id}`, { fullName, studentNumber });
      toast.success(`Renamed to ${fullName}.`);
      setRenaming(null);
      api.invalidate('/students');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Rename failed.');
    } finally {
      setBusy(false);
    }
  }

  async function doMerge() {
    if (!merging || !mergeTarget || busy) return;
    const target = (students || []).find((s) => s.id === mergeTarget);
    if (!target) return;
    const ok = await confirm(
      `Merge "${merging.full_name}" into "${target.full_name}"? All ${merging.scan_count} scanned sheet${merging.scan_count === 1 ? '' : 's'} move to ${target.full_name} and the duplicate record is removed — this cannot be undone.`,
      { title: 'Merge student records' }
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.post('/students/merge', { sourceId: merging.id, targetId: target.id });
      toast.success(`Merged — ${res.moved} scan${res.moved === 1 ? '' : 's'} moved to ${target.full_name}.`);
      setMerging(null); setMergeTarget('');
      api.invalidate('/students');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Merge failed.');
    } finally {
      setBusy(false);
    }
  }

  function studentMenu(e, s) {
    openMenu(e, [
      { label: 'Rename / fix ID', icon: Pencil, onClick: () => setRenaming(s) },
      (students || []).length > 1 && { label: 'Merge into…', icon: Merge, onClick: () => { setMerging(s); setMergeTarget(''); } },
      'sep',
      s.student_number && { label: 'Copy student ID', icon: Copy, onClick: () => copyText(s.student_number, 'Student ID') },
      { label: 'Copy name', icon: Copy, onClick: () => copyText(s.full_name, 'Name') },
    ]);
  }

  return (
    <>
      <section className="dataset" data-dataset>
        <div className="dataset-bar">
          <div className="dataset-bar-lead">
            <label className="ds-search" htmlFor="students-search">
              <Search size={15} />
              <span className="sr-only">Search students</span>
              <input
                id="students-search"
                ref={searchRef}
                type="search"
                autoComplete="off"
                placeholder="Search by name or student ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd aria-hidden="true">/</kbd>
            </label>
          </div>
          <div className="dataset-bar-trail">
            {pendingReview > 0 && (
              <span className="st-flag"><AlertCircle size={13} /> {pendingReview} with sheets to review</span>
            )}
            {tabs}
          </div>
        </div>

        {!students ? <TableSkeleton /> : filtered.length === 0 ? (
          <div className="empty-state empty-state-md">
            <EmptyStateArt size={88} art="scan" />
            <p>{query
              ? `No students match "${query}".`
              : 'No students yet — scan an OMR sheet in the mobile app and the roster builds itself.'}</p>
          </div>
        ) : (
          <div className="dataset-scroll">
            <table className="grid datatable">
              <caption className="sr-only">Students built from OMR scans</caption>
              <thead>
                <tr>
                  <th className={`col-primary wp-30 ${sortClass('name')}`} onClick={sortHandler('name')} data-name="Student">Student{renderSortArrow('name')}</th>
                  <th className={`wp-15 ${sortClass('number')}`} onClick={sortHandler('number')} data-name="Student ID">Student ID{renderSortArrow('number')}</th>
                  <th className={`wp-17 ${sortClass('subject')}`} onClick={sortHandler('subject')} data-name="Subject">Subject{renderSortArrow('subject')}</th>
                  <th className={`wp-10 is-num ${sortClass('scans')}`} onClick={sortHandler('scans')} data-name="Scans">Scans{renderSortArrow('scans')}</th>
                  <th className={`wp-13 ${sortClass('review')}`} onClick={sortHandler('review')} data-name="Review">Review{renderSortArrow('review')}</th>
                  <th className={`wp-11 ${sortClass('last')}`} onClick={sortHandler('last')} data-name="Last scanned">Last scanned{renderSortArrow('last')}</th>
                  <th className="col-actions wp-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody ref={animateRows}>
                {pageRows.map((s) => (
                  <tr key={s.id} onContextMenu={(e) => studentMenu(e, s)}>
                    <td className="col-primary">
                      <span className="g-entity">
                        <span className="g-primary">
                          <span className="g-title">{s.full_name}</span>
                        </span>
                      </span>
                    </td>
                    <td>{s.student_number
                      ? <span className="g-code">{s.student_number}</span>
                      : <span className="g-mute">—</span>}</td>
                    <td className="g-mute">{s.subject_code || '—'}</td>
                    <td className="is-num">
                      <span className={`g-count${s.scan_count ? '' : ' is-zero'}`}>{s.scan_count || '—'}</span>
                    </td>
                    <td>
                      {s.needs_review
                        ? <span className="g-state is-draft"><AlertCircle size={13} /> {s.needs_review} to review</span>
                        : s.scan_count > 0
                          ? <span className="g-state is-live"><CheckCircle size={13} /> Clear</span>
                          : <span className="g-mute">—</span>}
                    </td>
                    <td className="g-mute" title={fmtScanned(s.last_scanned_at)}>
                      {s.last_scanned_at ? (timeAgo(s.last_scanned_at) || fmtScanned(s.last_scanned_at)) : '—'}
                    </td>
                    <td className="col-actions">
                      <Tooltip label="Actions">
                        <button
                          type="button"
                          className="g-menu"
                          onClick={(e) => studentMenu(e, s)}
                          aria-label={`Actions for ${s.full_name}`}
                        >
                          <Ellipsis size={15} />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {students && filtered.length > 0 && <DatasetFoot grid={grid} pageSizeOptions={[15, 30, 60]} />}
      </section>

      {menuEl}

      {/* Rename / fix ID */}
      <Modal
        open={!!renaming}
        title="Rename student"
        subtitle="The stored name, ID, and every scan snapshot are updated"
        icon={Pencil}
        onClose={() => !busy && setRenaming(null)}
        footer={(
          <>
            <button type="button" className="btn" onClick={() => setRenaming(null)} disabled={busy}>Cancel</button>
            <button type="submit" form="student-rename" className="btn btn-primary" disabled={busy}>
              {busy && <span className="btn-spinner" />} Save
            </button>
          </>
        )}
      >
        {renaming && (
          <form id="student-rename" className="st-form" onSubmit={saveRename}>
            <label className="form-label">
              Full name
              <input className="input" name="fullName" defaultValue={renaming.full_name} maxLength={200} required autoFocus />
            </label>
            <label className="form-label">
              Student ID <span className="text-muted">(leave blank to clear)</span>
              <input className="input" name="studentNumber" defaultValue={renaming.student_number || ''} maxLength={50} />
            </label>
            <p className="meta-sm text-muted">
              Scans match students by ID first, then exact name — keeping both accurate prevents duplicate records.
            </p>
          </form>
        )}
      </Modal>

      {/* Merge into */}
      <Modal
        open={!!merging}
        title="Merge into another student"
        subtitle={merging ? `"${merging.full_name}" will be folded into the record you pick` : ''}
        icon={Merge}
        onClose={() => !busy && setMerging(null)}
        footer={(
          <>
            <button type="button" className="btn" onClick={() => setMerging(null)} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={doMerge} disabled={busy || !mergeTarget}>
              {busy && <span className="btn-spinner" />} Merge
            </button>
          </>
        )}
      >
        {merging && (
          <div className="st-form">
            <div className="st-pick" role="radiogroup" aria-label="Merge into">
              {(students || []).filter((s) => s.id !== merging.id).map((s) => (
                <button
                  type="button"
                  key={s.id}
                  role="radio"
                  aria-checked={mergeTarget === s.id}
                  className={`st-pick-row${mergeTarget === s.id ? ' is-on' : ''}`}
                  onClick={() => setMergeTarget(s.id)}
                >
                  <span className="st-pick-name">{s.full_name}</span>
                  <span className="st-pick-meta">
                    {s.student_number ? `#${s.student_number} · ` : ''}{s.scan_count} scan{s.scan_count === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
            <p className="meta-sm text-muted">
              Every scanned sheet on <strong>{merging.full_name}</strong> moves to the picked record and the duplicate is removed.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
