import '../styles/questions.css';
/**
 * QuestionsPage — question bank grid with filters, bulk review, create/edit,
 * GIFT/XML import and similarity review.
 *
 * React question-bank workspace.
 *
 * Review economics: an AI run drops dozens of drafts into the bank at once, so
 * the grid is built around deciding on many rows at a time — row checkboxes
 * (with shift-click ranges), a selection bar that replaces the toolbar, and a
 * one-click approve/reject on every draft row regardless of how it got here.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Check, X, Search, Upload, Sparkles, HelpCircle,
  Ellipsis, FileText, ListChecks, RotateCcw, FilterX, Layers, Copy, Eye, ListFilter,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import QuestionPreview from '../components/QuestionPreview.jsx';
import EvidenceViewer from '../components/EvidenceViewer.jsx';
import RichText from '../components/RichText.jsx';
import api, { ApiError } from '../lib/api.js';
import { isKnowledgeQuestion, needsKnowledgeConfirm, confirmKnowledge } from '../lib/knowledge.js';
import useJobs, { isActiveJob } from '../lib/useJobs.js';
import AppShell from '../components/AppShell.jsx';
import { TableSkeleton } from '../components/Loaders.jsx';
import { animateRows } from '../lib/animRows.js';
import { subjectLabel } from '../lib/subjectProgress.js';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import { JobsActivityPanel } from '../components/JobsList.jsx';
import {
  StatusPill, BoardGroupHead,
  BoardAddRow, GroupChip, groupColor, statusOf, statusMeta, STATUS_ORDER,
} from '../components/Board.jsx';
import { useGridTable, DsPager, DsPageSize } from '../components/DataTable.jsx';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const BLOOM_LEVELS = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };
// Display labels only. The keys are the wire values shared with the API, the
// OMR scoring service and the Flutter app — never rename a key.
const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / false', matching: 'Matching type', identification: 'Fill in the blank' };
// Status tabs over the table. '' is the default view — the working bank,
// approved questions plus drafts. Rejected items are kept (soft status) but
// sit behind their own tab instead of filling the first page.
const STATUS_TABS = [
  { value: '', label: 'Current', title: 'Approved questions and drafts — everything except rejected' },
  { value: 'active', label: 'Approved' },
  { value: 'draft', label: 'Drafts' },
  { value: 'rejected', label: 'Rejected' },
];
const SOURCE_LABELS = { ai: 'AI-generated', import: 'Imported', manual: 'Written or reused' };

/** Mix strip beside the status tabs — Bloom coverage columns and type
 *  counts for the rows the current tab and filters show. */
function BankMix({ questions }) {
  const byBloom = {}, byType = {};
  questions.forEach((q) => {
    if (q.bloom) byBloom[q.bloom] = (byBloom[q.bloom] || 0) + 1;
    if (q.type) byType[q.type] = (byType[q.type] || 0) + 1;
  });
  const bloomMax = Math.max(1, ...BLOOM_ORDER.map((b) => byBloom[b] || 0));
  const bloomLabel = BLOOM_ORDER.map((b) => `${byBloom[b] || 0} ${BLOOM_LABELS[b].toLowerCase()}`).join(', ');
  return (
    <div className="qmix" role="img" aria-label={`Bloom mix — ${bloomLabel}`}>
      <div className="qmix-bloom">
        {BLOOM_ORDER.map((b, i) => (
          <span key={b} className="qmix-bloom-col" title={`${BLOOM_LABELS[b]}: ${byBloom[b] || 0}`}>
            <i style={{ height: `${Math.max(4, ((byBloom[b] || 0) / bloomMax) * 100)}%`, background: `var(--bloom-${i + 1})` }} />
          </span>
        ))}
      </div>
      <div className="qmix-types">
        {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
          <span key={t} className="qmix-type">{TYPE_LABELS[t] || t} <strong>{n}</strong></span>
        ))}
      </div>
    </div>
  );
}

// The status vocabulary is exactly draft | active | rejected. 'rejected' is a
// soft status — the row stays so AI-eval precision keeps counting instructor
// decisions — so it needs its own cell state, not a fallback to "Draft".
/** Format an ISO date string as "M j, Y". */
function fmtDateQ(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Relative-first date for the Updated column — Today / Yesterday / weekday,
    then "Mon j" within the year, full date beyond it. */
function relDate(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((day(now) - day(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_META = {
  active:   { label: 'Active',   cls: 'is-live',     order: 2 },
  draft:    { label: 'Draft',    cls: 'is-draft',    order: 1 },
  rejected: { label: 'Rejected', cls: 'is-rejected', order: 0 },
};

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

const DEFAULT_FILTERS = { subject_id: '', bloom: '', type: '', status: '', tos_id: '', topic: '' };
const PAGE_SIZE = 25;
// Rows arrive pre-ordered by the page's own pipeline — the table only needs
// a stub column so TanStack can slice the current page.
const PAGER_COLUMNS = [{ id: 'row', enableSorting: false }];

/** API path for a filter set — also the cache key api.peek() looks up. */
function questionsPath(filters) {
  const params = new URLSearchParams();
  if (filters.subject_id) params.set('subject_id', filters.subject_id);
  if (filters.bloom) params.set('bloom', filters.bloom);
  if (filters.type) params.set('type', filters.type);
  // Status is filtered client-side so every tab can show its count.
  if (filters.tos_id) params.set('tos_id', filters.tos_id);
  return `/questions?${params}`;
}

/** Valid, non-removed items in an import preview — the count the commit button uses. */
function importReadyCount(state) {
  const items = state?.preview || [];
  const excluded = new Set(state?.excluded || []);
  return items.reduce((n, it, i) => (it.ok && !excluded.has(i) ? n + 1 : n), 0);
}

/** Resolve an MCQ answer (option text, A–E letter, or 1-based index) to an option index. */
function resolveOptionIndex(options, answer) {
  const t = String(answer || '').trim();
  const byText = options.findIndex((o) => o === t);
  if (byText >= 0) return byText;
  if (/^[A-Z]$/i.test(t)) {
    const i = t.toUpperCase().charCodeAt(0) - 65;
    if (i < options.length) return i;
  }
  if (/^\d+$/.test(t)) {
    const i = parseInt(t, 10) - 1;
    if (i < options.length) return i;
  }
  return -1;
}

/** One parsed item in the import preview — rendered like the real question. */
function ImportPreviewItem({ index, item, excluded, onToggleExclude }) {
  if (!item.ok) {
    return (
      <li className="q-import-item is-skipped">
        <div className="q-import-item-head">
          <span className="q-import-item-title">Q{index + 1} · Skipped</span>
        </div>
        <p className="q-import-skip-reason">{item.reason}</p>
      </li>
    );
  }
  const q = item.data;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const correctIdx = q.type === 'mcq' ? resolveOptionIndex(q.options, q.answer) : -1;
  const matchingPairs = q.type === 'matching'
    ? String(q.answer || '').split(',').map((p) => p.trim().match(/^(\d+)-([A-Z])$/i)).filter(Boolean)
    : [];

  return (
    <li className={`q-import-item${excluded ? ' is-excluded' : ''}`}>
      <div className="q-import-item-head">
        <span className="q-import-item-title">
          Q{index + 1} · {TYPE_LABELS[q.type] || q.type}
          {q.bloom && <span className="q-import-bloom">{BLOOM_LABELS[q.bloom] || q.bloom}</span>}
          <span className="q-import-preview-tag">Imported preview</span>
        </span>
        <button type="button" className={`btn btn-outline btn-xs${excluded ? '' : ' q-import-remove'}`} onClick={onToggleExclude}>
          {excluded ? 'Restore' : 'Remove'}
        </button>
      </div>
      <p className="q-import-stem">{q.stem}</p>
      {q.type === 'mcq' && (
        <ul className="q-import-options">
          {q.options.map((opt, oi) => (
            <li key={oi} className={oi === correctIdx ? 'is-correct' : ''}>
              <span className="q-import-opt-letter">{letters[oi]}</span>
              <span>{opt}</span>
              {oi === correctIdx && <Check size={14} className="q-import-correct-mark" />}
            </li>
          ))}
        </ul>
      )}
      {q.type === 'true_false' && (
        <div className="q-import-tf">
          {['True', 'False'].map((v) => (
            <span key={v} className={`q-import-tf-chip${q.answer === v ? ' is-correct' : ''}`}>
              {v}{q.answer === v && <Check size={13} />}
            </span>
          ))}
        </div>
      )}
      {q.type === 'matching' && (
        <div className="q-import-matching">
          {matchingPairs.map(([, n, letter]) => {
            const poolIdx = letter.toUpperCase().charCodeAt(0) - 65;
            return (
              <span key={n} className="q-import-match-chip">
                {n} → {letter}. {q.options[poolIdx]}
              </span>
            );
          })}
        </div>
      )}
      {q.type === 'identification' && (
        <p className="q-import-answer"><strong>Answer:</strong> {q.answer}</p>
      )}
      {item.explanation && <p className="q-import-expl"><em>Feedback:</em> {item.explanation}</p>}
    </li>
  );
}

export default function QuestionsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState(() => api.peek(questionsPath(DEFAULT_FILTERS))?.questions ?? null);
  const [subjects, setSubjects] = useState(() => api.peek('/subjects')?.subjects ?? []);
  const [tosList, setTosList] = useState(() => api.peek('/tos')?.tos ?? []);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(null); // null | 'approve' | 'reject' | 'delete'
  const [importState, setImportState] = useState(null);
  const [importing, setImporting] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [groupBy, setGroupBy] = useState('none'); // none | subject | status | bloom
  const [collapsed, setCollapsed] = useState(() => new Set());
  const searchRef = useRef(null);
  const lastPickedRef = useRef(null); // anchor row index for shift-click ranges

  /** Any change to what the grid shows restarts paging at the first page. */
  function updateFilters(next) {
    setFilters(next);
  }

  const load = useCallback(() => {
    api.get(questionsPath(filters))
      .then((data) => setQuestions(data.questions))
      .catch((err) => toast.error(err.message || 'Could not load questions.'));
  }, [filters, toast]);

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects)).catch(() => {});
    api.get('/tos').then((data) => setTosList(data.tos || [])).catch(() => {});
  }, []);

  const openImport = useCallback((subjectOverride) => {
    setImportState({
      content: '',
      fileName: '',
      detectedFormat: '',
      // Deep links pass a string (?subject_id=…); onClick passes its event —
      // the typeof guard keeps the event from becoming the subject id.
      subjectId: (typeof subjectOverride === 'string' && subjectOverride)
        || filters.subject_id || subjects[0]?.id || '',
      topic: '',
      preview: null,
      previewing: false,
      previewError: '',
      excluded: [],
      dragging: false,
    });
  }, [filters.subject_id, subjects]);

  useEffect(() => {
    const requestedStatus = searchParams.get('status');
    const requestedSubject = searchParams.get('subject_id');
    const validSubject = requestedSubject && subjects.some((subject) => String(subject.id) === requestedSubject)
      ? requestedSubject : null;
    if (validSubject) {
      setFilters((current) => current.subject_id === validSubject ? current : { ...current, subject_id: validSubject, tos_id: '' });
    }
    if (['draft', 'active', 'rejected'].includes(requestedStatus)) {
      setFilters((current) => current.status === requestedStatus ? current : { ...current, status: requestedStatus });
    }
    if (searchParams.get('new') === '1') {
      setEditing({ picker: true, subject_id: subjects[0]?.id || '' });
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
    // Deep links from the command palette: ?focus=<id> opens the question's
    // detail modal once the list has loaded; ?import=1 opens the importer.
    const requestedFocus = searchParams.get('focus');
    if (requestedFocus && questions) {
      const target = questions.find((q) => q.id === requestedFocus);
      if (target) {
        setViewing(target);
        const next = new URLSearchParams(searchParams);
        next.delete('focus');
        setSearchParams(next, { replace: true });
      }
    }
    if (searchParams.get('import') === '1') {
      // The subject filter from the same URL hasn't applied to state yet —
      // pass it through so the importer preselects the right subject.
      openImport(validSubject || undefined);
      const next = new URLSearchParams(searchParams);
      next.delete('import');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, subjects, questions, openImport]);

  useEffect(() => { load(); }, [load]);

  // Live worker feed — while generation or duplicate checks run, the empty
  // bank becomes a live activity panel instead of a dead end, and the list
  // refetches itself each time a watched job finishes.
  const { jobs, activeCount, refresh: refreshJobs } = useJobs();
  const prevJobIds = useRef(null);
  useEffect(() => {
    const now = new Set(jobs.filter(isActiveJob).map((j) => j.id));
    const prev = prevJobIds.current;
    prevJobIds.current = now;
    if (!prev || prev.size === 0) return;
    for (const id of prev) {
      if (!now.has(id)) { load(); break; }
    }
  }, [jobs, load]);

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

  // Topic options come from what is actually loaded — no extra endpoint. The
  // current topic stays in the list even when nothing matches it any more, so
  // the filter can always be cleared from the control itself.
  const topicOptions = useMemo(() => {
    const seen = new Set();
    (questions || []).forEach((q) => { if (q.topic) seen.add(q.topic); });
    if (filters.topic) seen.add(filters.topic);
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [questions, filters.topic]);

  // Client-side search + topic filter (mirrors DataTables search). Status is
  // applied after, so the tab counts reflect every other active filter.
  const baseQuestions = useMemo(() => {
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

  const statusCounts = useMemo(() => {
    const counts = { '': 0, active: 0, draft: 0, rejected: 0 };
    (baseQuestions || []).forEach((q) => {
      counts[q.status] = (counts[q.status] || 0) + 1;
      if (q.status !== 'rejected') counts[''] += 1;
    });
    return counts;
  }, [baseQuestions]);

  const filteredQuestions = useMemo(() => {
    if (!baseQuestions) return null;
    return filters.status
      ? baseQuestions.filter((q) => q.status === filters.status)
      : baseQuestions.filter((q) => q.status !== 'rejected');
  }, [baseQuestions, filters.status]);

  // The status tabs show their own state, so they don't count as a filter.
  const activeFilterCount = [filters.subject_id, filters.bloom, filters.type, filters.tos_id, filters.topic].filter(Boolean).length;

  // When the list is filtered to one subject — or grouped by subject, where
  // the band already says it — the column only repeats that subject; drop it
  // and let every other column take the width. Same when the whole bank only
  // holds one subject: the column would read the same value on every row.
  const singleSubject = useMemo(() => {
    if (!questions?.length) return false;
    return new Set(questions.map((q) => q.subject_id || 'none')).size === 1;
  }, [questions]);
  const showSubject = !filters.subject_id && groupBy !== 'subject' && !singleSubject;
  const COLS = showSubject ? 7 : 6;

  // Clearing filters keeps the status tab — it is a view, not a filter.
  const clearFilters = useCallback(() => {
    setFilters((current) => ({ ...DEFAULT_FILTERS, status: current.status }));
    setSearch('');
  }, []);

  // Blueprints are scoped to the chosen subject when there is one, so the
  // TOS select never offers a blueprint that can't match a visible row.
  const tosOptions = useMemo(
    () => tosList.filter((t) => !filters.subject_id || t.subject_id === filters.subject_id),
    [tosList, filters.subject_id]
  );

  // Deep-link straight to the blueprint when exactly one matches the current
  // subject filter; otherwise land on the blueprint list to choose.
  const generateHref = useMemo(() => {
    const cands = tosList.filter((t) => !filters.subject_id || String(t.subject_id) === String(filters.subject_id));
    return cands.length === 1 ? `/tos/${cands[0].id}` : '/tos';
  }, [tosList, filters.subject_id]);

  const draftCount = useMemo(
    () => (questions || []).filter((q) => q.status === 'draft').length,
    [questions]
  );

  const rows = useMemo(() => filteredQuestions || [], [filteredQuestions]);

  // Pagination slices the filtered rows; every row still carries its global
  // `rows` index so selection and shift-click ranges never notice the split.
  // resetKey returns to page 1 whenever any filter/grouping input changes,
  // which is what the old setPage(0) calls did by hand.
  const grid = useGridTable({
    data: rows, columns: PAGER_COLUMNS, pageSize: PAGE_SIZE,
    storageKey: 'questions',
    resetKey: JSON.stringify([filters, search, groupBy]),
  });
  const { pageRows, safePage } = grid;

  // Board grouping — visual only, computed over the current page's rows.
  const qGroups = useMemo(() => {
    if (groupBy === 'none' || !pageRows.length) return null;
    const map = new Map();
    pageRows.forEach((q, i) => {
      const index = safePage * grid.pageSize + i;
      let key, title, color, orderKey;
      if (groupBy === 'subject') {
        key = q.subject_id || q.subject_name || 'none';
        title = q.subject_name || 'No subject';
        color = groupColor(key);
        orderKey = title.toLowerCase();
      } else if (groupBy === 'status') {
        const tone = statusOf(q.status);
        key = `st-${tone}`;
        title = (STATUS_META[q.status] || STATUS_META.draft).label;
        color = `var(--st-${tone === 'active' ? 'green' : tone === 'rejected' ? 'red' : 'orange'})`;
        orderKey = String(99 - (STATUS_META[q.status]?.order ?? 0));
      } else { // bloom
        const level = BLOOM_LEVELS[q.bloom] || 0;
        key = `bl-${level}`;
        title = level ? BLOOM_LABELS[q.bloom] : 'No Bloom level';
        color = level ? `var(--bloom-${level})` : 'var(--line-strong)';
        orderKey = String(9 - level);
      }
      if (!map.has(key)) map.set(key, { key, title, color, orderKey, rows: [], subjectId: q.subject_id });
      map.get(key).rows.push({ q, index });
    });
    return [...map.values()].sort((a, b) => a.orderKey.localeCompare(b.orderKey));
  }, [pageRows, groupBy, safePage, grid.pageSize]);

  function toggleGroup(key) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

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

  async function handleApprove(q, bypass = false, knowledge = false) {
    try {
      const body = { ...(bypass ? { allowSimilarityFailure: true } : {}), ...(knowledge ? { confirmKnowledge: true } : {}) };
      await api.post(`/questions/${q.id}/approve`, Object.keys(body).length ? body : undefined);
      toast.success(bypass ? 'Question approved without duplicate check.' : 'Question approved.');
      load();
    } catch (err) {
      // AI-knowledge answers need the instructor's explicit confirmation.
      if (!knowledge && needsKnowledgeConfirm(err)) {
        if (await confirmKnowledge(confirm)) return handleApprove(q, bypass, true);
        return;
      }
      // A failed duplicate check is the only overridable block — offer the
      // explicit bypass instead of leaving the draft stuck during an outage.
      if (!bypass && q.similarity_error && /similarity check failed/i.test(err?.message || '')) {
        const ok = await confirm(
          `Duplicate checking failed (${q.similarity_error}). Approve anyway? The question joins your bank ` +
          'unverified and stays out of the shared institution bank until a successful check — the bypass is audit-logged.',
          { title: 'Approve without duplicate check?' }
        );
        if (ok) return handleApprove(q, true);
      }
      toast.error(err.message || 'Approve failed.');
    }
  }
  async function handleReject(q) {
    try { await api.post(`/questions/${q.id}/reject`); toast.success('Question rejected.'); load(); }
    catch (err) { toast.error(err.message || 'Reject failed.'); }
  }
  async function handleDelete(q) {
    if (!(await confirm('Delete this question? This cannot be undone.', { title: 'Delete question' }))) return;
    try { await api.del(`/questions/${q.id}`); toast.success('Question deleted.'); load(); }
    catch (err) { toast.error(err.message || 'Delete failed.'); }
  }

  /**
   * Report what the server actually did, not what was asked. bulk-approve only
   * moves drafts, so a 20-row selection with 8 active rows comes back with
   * approved:12 — the toast has to say 12.
   */
  /** Turn the API's per-reason tally into one readable clause. */
  function blockSummary(reasons) {
    if (!reasons) return '';
    if (reasons.firstMessage) return reasons.firstMessage;
    const parts = [];
    if (reasons.similarity_pending) parts.push(`${reasons.similarity_pending} still in similarity check`);
    if (reasons.similarity_flagged) parts.push(`${reasons.similarity_flagged} need similarity review`);
    if (reasons.similarity_error) parts.push(`${reasons.similarity_error} failed the similarity check`);
    if (reasons.not_draft) parts.push(`${reasons.not_draft} were not drafts`);
    if (reasons.unsupported_type) parts.push(`${reasons.unsupported_type} have an unsupported type`);
    if (reasons.other) parts.push(`${reasons.other} blocked by grounding review`);
    if (reasons.knowledge_unconfirmed) parts.push(`${reasons.knowledge_unconfirmed} written from AI knowledge still need your answer confirmation`);
    return parts.join(', ') || 'they could not be approved';
  }

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
      let data = await api.post('/questions/bulk-approve', { ids });
      // AI-knowledge drafts are held back until the instructor confirms their
      // answers — ask once for the whole set.
      if (data?.knowledgeIds?.length && await confirmKnowledge(confirm, data.knowledgeIds.length)) {
        const retry = await api.post('/questions/bulk-approve', { ids: data.knowledgeIds, confirmKnowledge: true });
        const { knowledge_unconfirmed: _held, ...held } = data.reasons || {};
        const reasons = { ...held };
        for (const [k, v] of Object.entries(retry?.reasons || {})) reasons[k] = typeof v === 'number' ? (reasons[k] || 0) + v : reasons[k] || v;
        data = {
          ...data,
          approved: (data.approved || 0) + (retry?.approved || 0),
          approvedIds: [...(data.approvedIds || []), ...(retry?.approvedIds || [])],
          reasons: Object.keys(reasons).length ? reasons : undefined,
        };
      }
      // Every remaining blocker is a failed duplicate check (provider outage)
      // — offer the explicit bypass for just those ids rather than leaving
      // the selection stuck.
      const onlyFailures = (data?.reasons?.similarity_error || 0) > 0
        && Object.entries(data.reasons).every(([k, v]) => ['firstMessage', 'similarity_error'].includes(k) || !v);
      if ((data?.approved || 0) < ids.length && onlyFailures) {
        const approvedSet = new Set(data.approvedIds || []);
        const remaining = ids.filter((id) => !approvedSet.has(id));
        const ok = await confirm(
          `${remaining.length} question${remaining.length === 1 ? '' : 's'} couldn't be checked for duplicates ` +
          '(the similarity service is unreachable). Approve anyway? They join your bank unverified and stay out ' +
          'of the shared institution bank until a successful check — the bypass is audit-logged.',
          { title: 'Approve without duplicate check?' }
        );
        if (ok) {
          const retry = await api.post('/questions/bulk-approve', { ids: remaining, allowSimilarityFailure: true });
          data = {
            ...retry,
            approved: (data.approved || 0) + (retry?.approved || 0),
            approvedIds: [...(data.approvedIds || []), ...(retry?.approvedIds || [])],
          };
        }
      }
      reportBulk(data?.approved || 0, ids.length, 'approved', blockSummary(data?.reasons) || 'approving only affects drafts.');
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
    if (!(await confirm(`Delete ${ids.length} question${ids.length === 1 ? '' : 's'}? This cannot be undone — reject instead if you want to keep the record.`, { title: 'Delete questions' }))) return;
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
    setEditing({ ...q, optionsText: Array.isArray(q.options) ? q.options.join('\n') : '' });
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const text = await readFileText(file);
      setImportState((prev) => (prev ? { ...prev, content: text, fileName: file.name, detectedFormat: '', preview: null, previewError: '', excluded: [] } : prev));
      runPreview(text);
    } catch (err) {
      toast.error(err?.message || 'Could not read that file.');
    }
  }

  async function handleImportFile(e) {
    const input = e.target;
    await importFile(input.files?.[0]);
    input.value = ''; // let the same file be picked again after an edit
  }

  function handleImportDrop(e) {
    e.preventDefault();
    setImportState((prev) => (prev ? { ...prev, dragging: false } : prev));
    importFile(e.dataTransfer?.files?.[0]);
  }

  async function runPreview(content) {
    const text = (content || '').trim();
    if (text.length < 10) { toast.error('Choose a question file first.'); return; }
    setImportState((prev) => (prev ? { ...prev, previewing: true, previewError: '' } : prev));
    try {
      const data = await api.post('/questions/import/preview', { content: text });
      setImportState((prev) => (prev ? { ...prev, preview: data?.items || [], detectedFormat: data?.format || '', previewing: false, excluded: [] } : prev));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not parse that file.';
      setImportState((prev) => (prev ? { ...prev, preview: null, previewing: false, previewError: msg } : prev));
    }
  }

  function toggleExclude(i) {
    setImportState((prev) => {
      if (!prev) return prev;
      const ex = new Set(prev.excluded || []);
      if (ex.has(i)) ex.delete(i); else ex.add(i);
      return { ...prev, excluded: [...ex] };
    });
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
        content,
        subjectId: importState.subjectId,
        topic: importState.topic?.trim() || undefined,
        exclude: importState.excluded?.length ? importState.excluded : undefined,
      });
      const n = data?.imported || 0;
      const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
      toast.success(`${n} question${n === 1 ? '' : 's'} imported as draft${n === 1 ? '' : 's'}.`);
      if (skipped.length) {
        toast.warning(`${skipped.length} item${skipped.length === 1 ? '' : 's'} skipped: ${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? '…' : ''}`);
      }
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

  function questionMenu(e, q, stem) {
    const isDraft = q.status === 'draft';
    const isRejected = q.status === 'rejected';
    openMenu(e, [
      { label: 'View details', icon: Eye, onClick: () => setViewing(q) },
      { label: 'Edit', icon: Pencil, onClick: () => openEdit(q) },
      ...(isDraft ? [{ label: 'Approve', icon: Check, onClick: () => handleApprove(q) }] : []),
      ...(isRejected ? [{ label: 'Restore', icon: RotateCcw, onClick: () => handleApprove(q) }] : []),
      ...(!isRejected ? [{ label: 'Reject', icon: X, onClick: () => handleReject(q) }] : []),
      'sep',
      { label: 'Copy question text', icon: Copy, onClick: () => copyText(stem, 'Question text') },
      'sep',
      { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDelete(q) },
    ]);
  }

  /** One grid row — index is the row's position in `rows` (selection anchor). */
  function renderQuestionRow(q, index) {
    const stem = (q.stem || '').replace(/\s+/g, ' ').trim();
    const status = STATUS_META[q.status] || STATUS_META.draft;
    const level = q.bloom ? BLOOM_LEVELS[q.bloom] || 0 : 0;
    const subject = q.subject_name || '';
    const touched = q.updated_at || q.created_at || '';
    const isChecked = selected.has(q.id);
    return (
      <tr key={q.id} data-id={q.id} className={`b-row${isChecked ? ' is-selected' : ''}`} onContextMenu={(e) => questionMenu(e, q, stem)}>
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
        <td className="col-primary">
          <span className="g-primary">
            <button
              type="button"
              className="g-title q-stem"
              title={stem}
              onClick={() => setViewing(q)}
            >
              <RichText text={stem} />
            </button>
            <span className="g-meta q-meta">
              <span>{TYPE_LABELS[q.type] || q.type}</span>
              {q.topic && <span title={q.topic}>{q.topic}</span>}
              {q.similarity_flag === 'flagged' && (
                <Link to={`/questions/${q.id}/similarity`} className="sim-flag" title="Possible duplicate — click to review">
                  <FileText size={12} /> Similar
                </Link>
              )}
            </span>
          </span>
        </td>
        {showSubject && (
          <td data-order={subject} data-filter={subject}>
            {subject ? (
              <GroupChip color={groupColor(q.subject_id || subject)} title={subject}>{subject}</GroupChip>
            ) : (
              <span className="g-mute">—</span>
            )}
          </td>
        )}
        <td data-order={level} data-filter={level ? BLOOM_LABELS[q.bloom] : ''}>
          {level ? (
            <span className="g-bloom" data-level={level}>{BLOOM_LABELS[q.bloom]}</span>
          ) : (
            <span className="g-mute">—</span>
          )}
        </td>
        <td data-order={status.order} data-filter={status.label}>
          <StatusPill status={q.status} />
        </td>
        <td className="g-mute" data-order={touched} title={fmtDateQ(touched) || undefined}>
          {relDate(touched)}
        </td>
        <td className="col-actions">
          {/* One ⋯ trigger opens the same floating menu as right-click —
              uniform with Subjects and every other list page. */}
          <button
            type="button"
            className="g-menu"
            onClick={(e) => questionMenu(e, q, stem)}
            title="Actions"
            aria-label={`Actions for “${stem.slice(0, 60)}”`}
          >
            <Ellipsis size={15} />
          </button>
        </td>
      </tr>
    );
  }

  /** Flat tbody when ungrouped; one collapsible tbody per group otherwise. */
  function renderQuestionRows() {
    if (rows.length === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={COLS} className="ds-noresults">
              {activeFilterCount || search ? (
                <>
                  <span className="ds-noresults-title">No questions found</span>
                  <span className="ds-noresults-sub">
                    <button type="button" onClick={clearFilters}>Clear filters</button>
                  </span>
                </>
              ) : (
                <>
                  <span className="ds-noresults-title">
                    {filters.status === 'draft' ? 'No drafts waiting' : filters.status === 'rejected' ? 'Nothing rejected' : filters.status === 'active' ? 'No approved questions yet' : 'Every question here is rejected'}
                  </span>
                  <span className="ds-noresults-sub">
                    {filters.status
                      ? <button type="button" onClick={() => updateFilters({ ...filters, status: '' })}>Show current questions</button>
                      : <button type="button" onClick={() => updateFilters({ ...filters, status: 'rejected' })}>Show rejected</button>}
                  </span>
                </>
              )}
            </td>
          </tr>
        </tbody>
      );
    }
    if (!qGroups) {
      return (
        <tbody ref={animateRows}>
          {pageRows.map((q, i) => renderQuestionRow(q, safePage * grid.pageSize + i))}
        </tbody>
      );
    }
    return qGroups.map((g) => {
      const isCollapsed = collapsed.has(g.key);
      const counts = {};
      for (const { q } of g.rows) {
        const tone = statusOf(q.status);
        counts[tone] = (counts[tone] || 0) + 1;
      }
      return (
        <tbody key={g.key} ref={animateRows} className={`b-group${isCollapsed ? ' is-collapsed' : ''}`} style={{ '--gc': g.color }}>
          <BoardGroupHead
            color={g.color}
            title={g.title}
            count={g.rows.length}
            meta={groupBy !== 'status' ? statusMeta(counts, STATUS_ORDER.question) || undefined : undefined}
            colSpan={COLS}
            collapsed={isCollapsed}
            onToggle={() => toggleGroup(g.key)}
          />
          {g.rows.map(({ q, index }) => renderQuestionRow(q, index))}
          {groupBy === 'subject' && g.subjectId && (
            <BoardAddRow
              colSpan={COLS}
              label="New question"
              onClick={() => setEditing({ picker: true, subject_id: g.subjectId })}
            />
          )}
        </tbody>
      );
    });
  }

  return (
    <AppShell pageClass="questions" activeNav="questions" pageTitle="Questions" wide>

      {filteredQuestions === null ? (
        <TableSkeleton />
      ) : (questions || []).length === 0 && !activeFilterCount && !search ? (
        activeCount > 0 ? (
          <JobsActivityPanel
            jobs={jobs}
            activeCount={activeCount}
            title="Building your question bank"
            onRefresh={refreshJobs}
          >
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ picker: true, subject_id: subjects[0]?.id || '' })}>
              <Plus size={15} /> New Question
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={openImport}>
              <Upload size={15} /> Import
            </button>
          </JobsActivityPanel>
        ) : (
          <div className="empty-state">
            <EmptyStateArt icon={HelpCircle} />
            <h4>Your question bank is empty</h4>
            <p>Add a question manually, import from GIFT/XML, or auto-generate from a blueprint (TOS) using your uploaded materials.</p>
            <div className="empty-state-actions">
              <button type="button" className="btn btn-primary" data-tour="questions-new" onClick={() => setEditing({ picker: true, subject_id: subjects[0]?.id || '' })}>
                <Plus size={16} /> New Question
              </button>
              <button type="button" className="btn btn-outline" data-tour="questions-import" onClick={openImport}>
                <Upload size={16} /> Import
              </button>
              <Link to={generateHref} className="btn btn-outline">
                <Sparkles size={16} /> Auto-generate from Blueprint
              </Link>
            </div>
          </div>
        )
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

              <button
                type="button"
                className="btn btn-outline btn-sm q-filters-btn"
                data-tour="questions-filters"
                data-active={activeFilterCount > 0 || undefined}
                onClick={() => setFiltersOpen(true)}
              >
                <ListFilter size={15} /> Filters
                {activeFilterCount > 0 && <span className="q-filter-badge">{activeFilterCount}</span>}
              </button>

              <span className="b-groupby">
                <Layers size={14} aria-hidden="true" />
                <select
                  aria-label="Group questions by"
                  data-active={groupBy !== 'none'}
                  value={groupBy}
                  onChange={(e) => { setGroupBy(e.target.value); setCollapsed(new Set()); }}
                >
                  <option value="none">Group: None</option>
                  <option value="subject">Group: Subject</option>
                  <option value="status">Group: Status</option>
                  <option value="bloom">Group: Bloom</option>
                </select>
              </span>
            </div>

            <div className="dataset-bar-trail">
              {draftCount > 0 && (
                <Link to="/questions/review" className="btn btn-brand btn-sm q-review-cta" data-tour="questions-review">
                  <ListChecks size={15} /> Review {draftCount} draft{draftCount === 1 ? '' : 's'}
                </Link>
              )}
              <button type="button" className="btn btn-outline btn-sm" data-tour="questions-import" onClick={openImport}>
                <Upload size={16} /> Import
              </button>
              <button type="button" className="btn btn-primary btn-sm" data-tour="questions-new" onClick={() => setEditing({ picker: true, subject_id: filters.subject_id || (subjects[0]?.id || '') })}>
                <Plus size={14} /> New Question
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

          <div className="q-statusbar">
            <div className="q-tabs" role="group" aria-label="Show questions by status" data-tour="questions-status">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.value || 'current'}
                  type="button"
                  className="q-tab"
                  data-status={t.value || 'current'}
                  aria-pressed={filters.status === t.value}
                  title={t.title}
                  onClick={() => updateFilters({ ...filters, status: t.value })}
                >
                  {t.label}
                  <span className="q-tab-count">{statusCounts[t.value] || 0}</span>
                </button>
              ))}
            </div>
            {rows.length > 0 && <BankMix questions={rows} />}
          </div>

          {/* Grid */}
          <div className="dataset-scroll" data-tour="questions-table">
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
                  <th className={`col-primary ${showSubject ? 'wp-45' : 'wp-55'}`} data-name="Question" data-locked>Question</th>
                  {showSubject && <th className="wp-10" data-name="Subject">Subject</th>}
                  <th className="wp-14" data-name="Bloom">Bloom</th>
                  <th className="wp-11" data-name="Status">Status</th>
                  <th className="wp-11" data-name="Updated">Updated</th>
                  <th className="col-actions wp-5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              {renderQuestionRows()}
            </table>
          </div>

          {/* Footer */}
          <div className="dataset-foot">
            <div className="ds-foot-lead">
              <div className="ds-range">
                <b>{grid.start}</b>–<b>{grid.end}</b> of <b>{rows.length}</b> question{rows.length !== 1 ? 's' : ''}
                {selecting && <span className="q-foot-note"> · {selectionCount} selected</span>}
              </div>
              <DsPageSize grid={grid} options={[25, 50, 100]} />
            </div>
            {grid.pageCount > 1 && <DsPager grid={grid} />}
          </div>
        </section>
      )}

      {/* Filters modal — the six facets live here so the toolbar stays one row */}
      <Modal
        open={filtersOpen}
        title="Filter questions"
        subtitle="Narrow the bank — filters combine. The list updates as you pick."
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={clearFilters} disabled={!activeFilterCount && !search}>
              <FilterX size={14} /> Clear all
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setFiltersOpen(false)}>Done</button>
          </>
        }
      >
        <div className="q-filter-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="qf-subject">Subject</label>
            <select id="qf-subject" className="form-control form-select" value={filters.subject_id}
              onChange={(e) => updateFilters({ ...filters, subject_id: e.target.value, tos_id: '' })}>
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{subjectLabel(s)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="qf-tos">Blueprint</label>
            <select id="qf-tos" className="form-control form-select" value={filters.tos_id}
              onChange={(e) => updateFilters({ ...filters, tos_id: e.target.value })}>
              <option value="">All blueprints</option>
              {tosOptions.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="qf-topic">Topic</label>
            <select id="qf-topic" className="form-control form-select" value={filters.topic}
              onChange={(e) => updateFilters({ ...filters, topic: e.target.value })}>
              <option value="">All topics</option>
              {topicOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="qf-bloom">Bloom level</label>
            <select id="qf-bloom" className="form-control form-select" value={filters.bloom}
              onChange={(e) => updateFilters({ ...filters, bloom: e.target.value })}>
              <option value="">All Bloom levels</option>
              {BLOOM_ORDER.map((b) => <option key={b} value={b}>{BLOOM_LABELS[b]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="qf-type">Question type</label>
            <select id="qf-type" className="form-control form-select" value={filters.type}
              onChange={(e) => updateFilters({ ...filters, type: e.target.value })}>
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* Create/edit question modal */}
      {/* Create chooser — pick a type, or import a whole bank from a file. */}
      <Modal
        open={!!editing?.picker}
        title="New Question"
        subtitle="Pick a question type — or import a whole bank from a file."
        onClose={() => setEditing(null)}
      >
        <div className="q-type-grid">
          {[
            ['mcq', ListChecks], ['true_false', Check], ['matching', Layers], ['identification', FileText],
          ].map(([t, Icon]) => (
            <button
              key={t}
              type="button"
              className="q-type-card"
              onClick={() => setEditing({ type: t, status: 'draft', subject_id: editing.subject_id || filters.subject_id || subjects[0]?.id || '' })}
            >
              <Icon size={20} />
              <span>{TYPE_LABELS[t]}</span>
            </button>
          ))}
        </div>
        <div className="q-type-divider"><span>or</span></div>
        <button
          type="button"
          className="q-type-import"
          onClick={() => { setEditing(null); openImport(); }}
        >
          <Upload size={18} />
          <span><strong>Import a file</strong> — bring in a GIFT, Moodle XML, or Canvas QTI bank, many questions at once.</span>
        </button>
      </Modal>

      <Modal
        open={!!editing && !editing.picker}
        title={editing?.id ? 'Edit Question' : 'New Question'}
        subtitle={editing?.id ? 'Update this item.' : 'Write the stem, options, and answer.'}
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
                      {subjectLabel(s)}
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

                {editing.id && (
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
                )}
              </div>

              {editing.id && (
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
              )}
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

              {editing.id && (
                <>
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
                </>
              )}
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
            {importState?.preview && (
              <span className="q-import-ready">
                {importReadyCount(importState)} question{importReadyCount(importState) === 1 ? '' : 's'} ready
              </span>
            )}
            <button className="btn btn-outline" onClick={() => setImportState(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              form="question-import-form"
              type="submit"
              disabled={importing || importState?.previewing || !importState?.subjectId || (importState?.content || '').trim().length < 10 || (importState?.preview && importReadyCount(importState) === 0)}
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
                    You have no subjects yet — <Link to="/subjects?new=1">create one first</Link>.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="import-topic">Default Topic</label>
                <input
                  id="import-topic"
                  type="text"
                  className="form-control"
                  maxLength={255}
                  placeholder="Optional — applied to every imported question"
                  value={importState.topic}
                  onChange={(e) => setImportState({ ...importState, topic: e.target.value })}
                />
                <p className="form-hint">Bloom level is detected per question from the stem — you'll see it in the preview.</p>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Source</div>

              <label
                className={`q-import-drop${importState.dragging ? ' is-dragging' : ''}${importState.fileName ? ' has-file' : ''}`}
                htmlFor="import-file"
                onDragOver={(e) => { e.preventDefault(); if (!importState.dragging) setImportState((p) => (p ? { ...p, dragging: true } : p)); }}
                onDragLeave={() => setImportState((p) => (p ? { ...p, dragging: false } : p))}
                onDrop={handleImportDrop}
              >
                <input
                  id="import-file"
                  type="file"
                  accept=".txt,.gift,.xml,text/plain,text/xml,application/xml"
                  onChange={handleImportFile}
                />
                <span className="q-import-drop-icon"><Upload size={22} /></span>
                <span className="q-import-drop-main">
                  {importState.fileName
                    ? <strong>{importState.fileName}</strong>
                    : <><strong>Drop a question file here</strong> or click to browse</>}
                </span>
                <span className="q-import-drop-hint">GIFT · Moodle XML · Canvas QTI — format detected automatically</span>
              </label>

              <div className="q-import-previewbar">
                {importState.previewing && (
                  <span className="q-import-previewmeta"><span className="btn-spinner" /> Parsing file…</span>
                )}
                {importState.preview && (
                  <span className="q-import-previewmeta">
                    {importState.detectedFormat === 'xml' ? 'XML' : 'GIFT'} detected
                    · {importState.preview.filter((it) => it.ok).length} parsed
                    {importState.preview.some((it) => !it.ok) && ` · ${importState.preview.filter((it) => !it.ok).length} skipped`}
                  </span>
                )}
              </div>
              {importState.previewError && <p className="q-import-skip-reason" role="alert">{importState.previewError}</p>}

              {importState.preview && (
                <ol className="q-import-list">
                  {importState.preview.map((item, i) => (
                    <ImportPreviewItem
                      key={i}
                      index={i}
                      item={item}
                      excluded={importState.excluded?.includes(i)}
                      onToggleExclude={() => toggleExclude(i)}
                    />
                  ))}
                </ol>
              )}
            </div>
          </form>
        )}
      </Modal>

      {/* Preview sheet — the full question with its answer marked, the AI
          grounding check, and the actions that decide its status. */}
      <Modal
        open={!!viewing}
        side
        title="Question preview"
        subtitle={viewing ? [viewing.subject_name, viewing.topic].filter(Boolean).join(' · ') || 'Question' : ''}
        icon={HelpCircle}
        accent={viewing ? groupColor(viewing.subject_id || viewing.subject_name) : undefined}
        onClose={() => setViewing(null)}
        footer={viewing && (
          <>
            <button type="button" className="btn btn-outline" onClick={() => { const q = viewing; setViewing(null); openEdit(q); }}>
              <Pencil size={15} /> Edit
            </button>
            {viewing.status !== 'rejected' && (
              <button type="button" className="btn btn-outline" onClick={() => { const q = viewing; setViewing(null); handleReject(q); }}>
                <X size={15} /> Reject
              </button>
            )}
            {viewing.status === 'draft' && (
              <button type="button" className="btn btn-primary" onClick={() => { const q = viewing; setViewing(null); handleApprove(q); }}>
                <Check size={15} /> Approve
              </button>
            )}
            {viewing.status === 'rejected' && (
              <button type="button" className="btn btn-primary" onClick={() => { const q = viewing; setViewing(null); handleApprove(q); }}>
                <RotateCcw size={15} /> Restore
              </button>
            )}
          </>
        )}
      >
        {viewing && (
          <div className="q-preview">
            <div className="q-preview-meta">
              <StatusPill status={viewing.status} small inline />
              <span className="q-preview-chip">{TYPE_LABELS[viewing.type] || viewing.type}</span>
              {BLOOM_LEVELS[viewing.bloom] && (
                <span className="g-bloom" data-level={BLOOM_LEVELS[viewing.bloom]}>{BLOOM_LABELS[viewing.bloom]}</span>
              )}
            </div>
            {viewing.similarity_flag === 'flagged' && (
              <Link to={`/questions/${viewing.id}/similarity`} className="q-preview-alert">
                <FileText size={15} aria-hidden="true" />
                <span>
                  <strong>Possible duplicate of a bank question</strong>
                  {viewing.similarity_score != null && ` — ${(Number(viewing.similarity_score) * 100).toFixed(0)}% similar`}
                </span>
                <span className="q-preview-alert-cta">Compare</span>
              </Link>
            )}
            <QuestionPreview question={viewing} />
            {viewing.source === 'ai' && <EvidenceViewer key={viewing.id} question={viewing} onChecked={load} />}
            <dl className="q-preview-facts">
              <div><dt>Source</dt><dd>{isKnowledgeQuestion(viewing) ? 'AI knowledge — not from your materials' : SOURCE_LABELS[viewing.source] || viewing.source || '—'}</dd></div>
              <div><dt>Updated</dt><dd>{fmtDateQ(viewing.updated_at || viewing.created_at) || '—'}</dd></div>
              {viewing.approved_at && <div><dt>Approved</dt><dd>{fmtDateQ(viewing.approved_at)}</dd></div>}
            </dl>
          </div>
        )}
      </Modal>
      {menuEl}
    </AppShell>
  );
}
