import '../styles/review.css';
/**
 * ReviewQueuePage — one-draft-at-a-time human review of AI-generated questions.
 *
 * The question bank grid shows a draft as one truncated 120-character row, so
 * approving from there means reading a fragment and trusting the rest. This
 * screen is the project's mandatory human-in-the-loop step done properly: the
 * whole draft on screen, four decisions reachable by key or pointer, automatic
 * advance, and an undo that moves server state back — not just local state.
 *
 * Contracts honoured here: approve → 'active', reject → 'rejected' (soft, the
 * row is kept so the AI-eval precision metric keeps counting instructor
 * decisions), and undo returns the row to 'draft' after evicting it from the
 * vector index, which holds active questions only.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, X, Pencil, SkipForward, Undo2, ArrowLeft, ArrowRight, AlertTriangle,
  CheckCheck, ClipboardCheck, Keyboard, Sparkles, Plus, Trash2, Save, RefreshCw,
  Loader2, GripVertical,
} from 'lucide-react';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from '../components/Toast.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import useJobs, { isActiveJob } from '../lib/useJobs.js';
import AppShell from '../components/AppShell.jsx';
import { CardsSkeleton } from '../components/Loaders.jsx';
import { JobsActivityPanel } from '../components/JobsList.jsx';
import EvidenceViewer from '../components/EvidenceViewer.jsx';
import RichText from '../components/RichText.jsx';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const BLOOM_LEVELS = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };

// 'identification' is the wire value — a cross-tier contract shared with the
// API, the OMR scorer and the Flutter app. Only the label follows the scope
// document's wording.
const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / false', matching: 'Matching type', identification: 'Fill in the blank' };

// PUT /api/questions/:id persists `options` for mcq only, so a save from here
// would silently drop a matching item's premise list. Inline edit and undo
// (which returns the row to draft through the same PUT) are withheld for that
// one type rather than destroying data behind the instructor's back.
const PUT_SAFE_TYPES = new Set(['mcq', 'true_false', 'identification']);

/** Normalise free text for tolerant answer matching (mirrors scoring.js). */
function normText(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Strip a leading option label so 'B) Paris' compares equal to 'Paris'. */
function cleanOptionText(opt) {
  return String(opt ?? '').replace(/^\s*[A-Za-z]\s*[).:-]\s*/, '').trim();
}

/**
 * Index of the option the stored answer points at, or -1.
 * Accepts the canonical bare letter ('B'), the legacy 'B) Paris' shape, and
 * the option text itself — the same three forms scoring.js tolerates.
 */
function resolveAnswerIndex(options, answer) {
  if (!Array.isArray(options) || options.length === 0 || !answer) return -1;
  const raw = String(answer).trim();

  if (/^[A-Za-z]$/.test(raw)) {
    const idx = raw.toUpperCase().charCodeAt(0) - 65;
    return idx >= 0 && idx < options.length ? idx : -1;
  }

  const labelled = raw.match(/^([A-Za-z])\s*[).:-]\s*(.+)$/);
  if (labelled) {
    const byText = options.findIndex((o) => normText(cleanOptionText(o)) === normText(labelled[2]));
    if (byText >= 0) return byText;
    const idx = labelled[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return idx;
  }

  return options.findIndex((o) => normText(cleanOptionText(o)) === normText(raw));
}

/**
 * Response letter assigned to each matching premise.
 * Reads the stored '1-B, 2-A, 3-D' shape first, then the canonical
 * comma-joined 'B,A,D,C' form used on the OMR wire.
 */
function matchingLetters(answer, count) {
  const out = new Array(count).fill(null);
  const re = /(\d+)\s*[-–—:.]\s*([A-Za-z])/g;
  let m;
  while ((m = re.exec(String(answer ?? ''))) !== null) {
    const i = parseInt(m[1], 10) - 1;
    if (i >= 0 && i < count) out[i] = m[2].toUpperCase();
  }
  if (out.every((v) => v === null)) {
    String(answer ?? '').split(',').forEach((piece, i) => {
      const letter = piece.trim().toUpperCase();
      if (i < count && /^[A-Z]$/.test(letter)) out[i] = letter;
    });
  }
  return out;
}

/** True / False / null for whichever legacy shape the answer was stored in. */
function trueFalseAnswer(answer) {
  const v = String(answer ?? '').trim().toUpperCase();
  if (v === 'T' || v === 'TRUE') return 'True';
  if (v === 'F' || v === 'FALSE') return 'False';
  return null;
}

/**
 * Full question body for PUT /api/questions/:id — mirrors the payload
 * QuestionsPage builds, including sending `options` for mcq only.
 */
function buildBody(q, status) {
  const body = {
    subject_id: q.subject_id,
    type: q.type,
    stem: q.stem,
    bloom: q.bloom || undefined,
    topic: q.topic || undefined,
    answer: q.answer || undefined,
    explanation: q.explanation || undefined,
    status,
  };
  if (q.type === 'mcq') {
    body.options = (Array.isArray(q.options) ? q.options : []).map((o) => String(o).trim()).filter(Boolean);
  }
  return body;
}

/** Next still-undecided position after `from`, wrapping once. -1 if none left. */
function findNext(list, decided, from) {
  if (!list || list.length === 0) return -1;
  for (let step = 1; step <= list.length; step += 1) {
    const i = (from + step) % list.length;
    if (!decided[list[i].id]) return i;
  }
  return -1;
}

export default function ReviewQueuePage() {
  const toast = useToast();
  // The toast context object is rebuilt on every provider render, so holding it
  // in an effect dependency would refetch the queue — and wipe the running
  // tally — every time a toast appears or expires. Read it through a ref.
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });

  // Keyed by the subject filter the rows were fetched for, so a pending reload
  // is derived during render rather than pushed from inside the effect.
  const [loaded, setLoaded] = useState({ key: null, questions: [] });
  const [reloadTick, setReloadTick] = useState(0);
  const [subjects, setSubjects] = useState(() => api.peek('/subjects')?.subjects ?? []);
  // ?subject_id= deep links (e.g. a subject card's "Review drafts") open the
  // queue already filtered to that subject.
  const [searchParams] = useSearchParams();
  const [subjectId, setSubjectId] = useState(() => searchParams.get('subject_id') || '');
  const navigate = useNavigate();

  /** Send the user to the right blueprint — not just the list. */
  async function goGenerate() {
    if (subjectId) {
      try {
        const data = await api.get(`/tos?subject_id=${encodeURIComponent(subjectId)}`);
        const finalized = (data?.tos || []).filter((t) => t.status === 'finalized');
        if (finalized.length === 1) { navigate(`/tos/${finalized[0].id}`); return; }
      } catch { /* fall through to the list */ }
    }
    navigate('/tos');
  }
  const [decisions, setDecisions] = useState({});
  const [cursor, setCursor] = useState(0);
  const [lastAction, setLastAction] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBypass, setConfirmBypass] = useState(false);
  const [includeFailed, setIncludeFailed] = useState(false);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  // Live view of the background worker — generation and per-draft duplicate
  // checks surface here instead of disappearing behind a toast. When a job
  // that was active leaves the active set, fresh drafts may have landed, so
  // the queue is pulled again.
  const { jobs, activeCount, refresh: refreshJobs } = useJobs();
  const activeJobs = useMemo(() => jobs.filter(isActiveJob), [jobs]);
  const activeSummary = useMemo(() => {
    const labels = {
      generate: 'Generating questions',
      similarity: 'Duplicate checks',
      extract: 'Reading material',
      embed: 'Indexing material',
      syllabus_tos: 'Drafting blueprint',
    };
    const seen = [];
    for (const j of activeJobs) {
      const label = labels[j.type] || j.type;
      if (!seen.includes(label)) seen.push(label);
    }
    return seen.join(' · ');
  }, [activeJobs]);
  const failedGenerate = useMemo(
    () => jobs.find((j) => j.type === 'generate' && j.status === 'failed'),
    [jobs]
  );
  // The API rewrites rate-limit errors to "the wait is over" once the
  // provider cooldown has elapsed — at that point the alert isn't
  // actionable, so it hides. Other failures stay until dismissed.
  const [dismissedFailure, setDismissedFailure] = useState(null);
  const failureOver = failedGenerate?.error?.includes('the wait is over')
    || dismissedFailure === failedGenerate?.id;

  const prevActiveIds = useRef(null);
  useEffect(() => {
    const now = new Set(activeJobs.map((j) => j.id));
    const prev = prevActiveIds.current;
    prevActiveIds.current = now;
    if (!prev || prev.size === 0) return;
    for (const id of prev) {
      if (!now.has(id)) { reload(); break; }
    }
  }, [activeJobs, reload]);

  useEffect(() => {
    api.get('/subjects').then((data) => setSubjects(data.subjects || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status: 'draft' });
    if (subjectId) params.set('subject_id', subjectId);
    api.get(`/questions?${params}`)
      .then((data) => {
        if (cancelled) return;
        setLoaded({ key: subjectId, questions: data.questions || [] });
        setDecisions({});
        setCursor(0);
        setLastAction(null);
        setEditing(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoaded({ key: subjectId, questions: [] });
        toastRef.current.error(err instanceof ApiError ? err.message : 'Could not load the review queue.');
      });
    return () => { cancelled = true; };
  }, [subjectId, reloadTick]);

  // null while the queue for the current filter is still in flight.
  const queue = loaded.key === subjectId ? loaded.questions : null;
  const current = queue && cursor >= 0 && cursor < queue.length ? queue[cursor] : null;


  const tally = useMemo(() => {
    const values = Object.values(decisions);
    return {
      approved: values.filter((v) => v === 'approved').length,
      rejected: values.filter((v) => v === 'rejected').length,
      remaining: (queue?.length || 0) - values.length,
    };
  }, [decisions, queue]);

  const approvableIds = useMemo(
    () => (queue || []).filter((q) => !decisions[q.id]
      && q.similarity_checked_at && !q.similarity_error && q.similarity_flag === 'none').map((q) => q.id),
    [queue, decisions]
  );

  // Undecided drafts — the set "Clear queue" would delete.
  const pendingIds = useMemo(
    () => (queue || []).filter((q) => !decisions[q.id]).map((q) => q.id),
    [queue, decisions]
  );

  // Drafts whose duplicate check failed — approvable only through the explicit
  // outage bypass, since a failure carries no information about duplication.
  const failedCheckIds = useMemo(
    () => (queue || []).filter((q) => !decisions[q.id] && q.similarity_error).map((q) => q.id),
    [queue, decisions]
  );

  const total = queue?.length || 0;
  const decidedCount = total - tally.remaining;
  const progressPct = total ? Math.round((decidedCount / total) * 100) : 0;
  const canEditInline = !!current && PUT_SAFE_TYPES.has(current.type);
  const canUndo = !!lastAction && PUT_SAFE_TYPES.has(lastAction.snapshot.type);
  const similarityReady = !!current?.similarity_checked_at
    && !current?.similarity_error && current?.similarity_flag === 'none';

  // ── Decisions ──────────────────────────────────────

  const decide = useCallback(async (action, opts = {}) => {
    if (!current || busy) return;
    if (action === 'approved' && !similarityReady && !opts.allowSimilarityFailure) {
      toastRef.current.warning('Wait for duplicate checking, or resolve the similarity warning, before approval.');
      return;
    }
    const item = current;
    const at = cursor;
    setBusy(true);
    try {
      await api.post(
        `/questions/${item.id}/${action === 'approved' ? 'approve' : 'reject'}`,
        action === 'approved' && opts.allowSimilarityFailure ? { allowSimilarityFailure: true } : undefined
      );
      const bypassed = action === 'approved' && opts.allowSimilarityFailure === true;
      const next = { ...decisions, [item.id]: action };
      setDecisions(next);
      setLastAction({ id: item.id, index: at, action, snapshot: item, bypassed });
      if (bypassed) {
        toastRef.current.success(
          'Approved without duplicate check — it joins your bank unverified and stays out of the shared institution bank until a check succeeds.'
        );
      }
      const n = findNext(queue, next, at);
      if (n >= 0) setCursor(n);
    } catch (err) {
      toastRef.current.error(
        err instanceof ApiError ? err.message : `Could not ${action === 'approved' ? 'approve' : 'reject'} this question.`
      );
    } finally {
      setBusy(false);
    }
  }, [current, cursor, busy, decisions, queue, similarityReady]);

  const retrySimilarity = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await api.post(`/questions/${current.id}/similarity/retry`);
      toastRef.current.success('Duplicate check queued again.');
      reload();
    } catch (err) {
      toastRef.current.error(err instanceof ApiError ? err.message : 'Could not retry duplicate checking.');
    } finally {
      setBusy(false);
    }
  }, [current, busy, reload]);

  /**
   * Put the last decision back. Approve and reject are both server-side state
   * changes, so the undo is too: an approved row is rejected first (that is
   * what evicts it from the vector index) and then PUT back to 'draft'. A
   * half-applied undo is reported as such rather than shown as success.
   */
  const undoLast = useCallback(async () => {
    if (!lastAction || busy || !canUndo) return;
    const { id, index, action, snapshot } = lastAction;
    let evicted = false;
    setBusy(true);
    try {
      if (action === 'approved') {
        await api.post(`/questions/${id}/reject`);
        evicted = true;
      }
      await api.put(`/questions/${id}`, buildBody(snapshot, 'draft'));
      setDecisions((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      setCursor(index);
      setLastAction(null);
      setEditing(null);
      toastRef.current.success('Put back in the queue as a draft.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'The server did not respond.';
      if (evicted) {
        setDecisions((d) => ({ ...d, [id]: 'rejected' }));
        setLastAction(null);
        toastRef.current.error(`Only half undone — the question is no longer active, but it could not be returned to draft. ${msg}`);
      } else {
        toastRef.current.error(`Could not undo — the question is still ${action}. ${msg}`);
      }
    } finally {
      setBusy(false);
    }
  }, [lastAction, busy, canUndo]);

  const skip = useCallback(() => {
    if (!queue || queue.length === 0) return;
    const n = findNext(queue, decisions, cursor);
    if (n >= 0) setCursor(n);
  }, [queue, decisions, cursor]);

  const goBack = useCallback(() => {
    setCursor((c) => (c > 0 ? c - 1 : c));
  }, []);

  // ── Inline edit ────────────────────────────────────

  const openEdit = useCallback(() => {
    if (!current || !PUT_SAFE_TYPES.has(current.type)) return;
    const options = Array.isArray(current.options) ? current.options.map(String) : [];
    setEditing({
      ...current,
      optionList: current.type === 'mcq' ? (options.length ? options : ['', '']) : [],
      correctIndex: current.type === 'mcq' ? resolveAnswerIndex(options, current.answer) : -1,
    });
  }, [current]);

  async function saveEdit(approveAfter) {
    if (!editing || !current || busy) return;

    if (!String(editing.stem || '').trim()) {
      toastRef.current.warning('The stem cannot be empty.');
      return;
    }

    let options = Array.isArray(current.options) ? current.options : [];
    let answer = String(editing.answer || '').trim();

    if (editing.type === 'mcq') {
      const trimmed = editing.optionList.map((o) => String(o).trim());
      const correctText = editing.correctIndex >= 0 ? trimmed[editing.correctIndex] : '';
      options = trimmed.filter(Boolean);
      if (options.length < 2) {
        toastRef.current.warning('A multiple-choice item needs at least two options.');
        return;
      }
      if (!correctText) {
        toastRef.current.warning('Mark which option is correct before saving.');
        return;
      }
      answer = correctText;
    }

    const merged = {
      ...current,
      stem: String(editing.stem).trim(),
      topic: editing.topic,
      bloom: editing.bloom,
      explanation: editing.explanation,
      options,
      answer,
    };
    const at = cursor;

    setBusy(true);
    try {
      const res = await api.put(`/questions/${merged.id}`, buildBody(merged, approveAfter ? 'active' : 'draft'));
      // The PUT response carries the stored row (options already parsed) but no
      // joined subject name — keep the one the list gave us.
      const saved = { ...merged, ...(res?.question || {}), subject_name: current.subject_name };
      const nextQueue = (queue || []).map((q) => (q.id === saved.id ? saved : q));
      setLoaded((s) => ({ ...s, questions: nextQueue }));
      setEditing(null);

      if (approveAfter && saved.status === 'active') {
        const next = { ...decisions, [saved.id]: 'approved' };
        setDecisions(next);
        setLastAction({ id: saved.id, index: at, action: 'approved', snapshot: saved });
        const n = findNext(nextQueue, next, at);
        if (n >= 0) setCursor(n);
        toastRef.current.success('Saved and approved.');
      } else {
        toastRef.current.success(approveAfter
          ? 'Changes saved. A new duplicate check is required before approval.'
          : 'Changes saved — still a draft.');
      }
    } catch (err) {
      toastRef.current.error(err instanceof ApiError ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  // ── Approve all remaining ──────────────────────────

  async function approveAll() {
    setConfirmBulk(false);
    const ids = includeFailed ? [...approvableIds, ...failedCheckIds] : approvableIds;
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await api.post('/questions/bulk-approve', { ids, allowSimilarityFailure: includeFailed });
      const count = typeof res?.approved === 'number' ? res.approved : ids.length;
      // Only mark ids the server actually approved — when it returns none
      // (all were already active), blindly marking the whole set is what made
      // the banner claim "14 approved" on a no-op click.
      const approvedIds = Array.isArray(res?.approvedIds) ? res.approvedIds : (count > 0 ? ids : []);
      setDecisions((d) => {
        const next = { ...d };
        for (const id of approvedIds) next[id] = 'approved';
        return next;
      });
      // A bulk approve has no one-step inverse, so the undo offer is withdrawn
      // rather than left pointing at a decision that is no longer the last one.
      setLastAction(null);
      setEditing(null);
      if (count === 0) {
        // The ids went out already-approved (e.g. a second click after the
        // queue cleared) — say so, then resync the queue to server truth.
        toastRef.current.info('Already approved — nothing left to do.');
        reload();
      } else {
        const failedSet = new Set(failedCheckIds);
        const bypassedCount = approvedIds.filter((id) => failedSet.has(id)).length;
        toastRef.current.success(
          `${count} question${count === 1 ? '' : 's'} approved` +
          `${bypassedCount ? ` — ${bypassedCount} without duplicate check` : ''}.`
        );
      }
    } catch (err) {
      toastRef.current.error(err instanceof ApiError ? err.message : 'Could not approve the remaining drafts.');
    } finally {
      setBusy(false);
    }
  }

  // ── Clear queue ────────────────────────────────────
  // Deletes every still-undecided draft via the same ownership-scoped bulk
  // endpoint the question bank uses; queued duplicate checks for those rows
  // are cancelled server-side so they don't fail on missing questions.

  async function clearQueue() {
    setConfirmClear(false);
    if (pendingIds.length === 0) return;
    setBusy(true);
    try {
      const res = await api.post('/questions/bulk-delete', { ids: pendingIds });
      const count = typeof res?.deleted === 'number' ? res.deleted : pendingIds.length;
      toastRef.current.success(`${count} draft${count === 1 ? '' : 's'} deleted.`);
      setDecisions({});
      setCursor(0);
      setLastAction(null);
      setEditing(null);
      reload();
      refreshJobs();
    } catch (err) {
      toastRef.current.error(err instanceof ApiError ? err.message : 'Could not clear the queue.');
    } finally {
      setBusy(false);
    }
  }

  // ── Keyboard ───────────────────────────────────────

  const hotkeys = useRef({});
  useEffect(() => {
    hotkeys.current = {
      active: !!current && !busy && !editing && !confirmBulk && tally.remaining > 0,
      canUndo: canUndo && !busy && !editing && !confirmBulk,
      canEdit: canEditInline && !busy && !editing && !confirmBulk,
      decide, undoLast, skip, goBack, openEdit,
    };
  });

  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      // Never steal a keystroke the instructor is typing into a field.
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

      const h = hotkeys.current;
      const key = (e.key || '').toLowerCase();

      if (key === 'u') {
        if (!h.canUndo) return;
        e.preventDefault();
        h.undoLast();
        return;
      }
      if (key === 'e') {
        if (!h.canEdit) return;
        e.preventDefault();
        h.openEdit();
        return;
      }
      if (!h.active) return;

      if (key === 'a') { e.preventDefault(); h.decide('approved'); }
      else if (key === 'r') { e.preventDefault(); h.decide('rejected'); }
      else if (key === 's' || e.key === 'ArrowRight') { e.preventDefault(); h.skip(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); h.goBack(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Render ─────────────────────────────────────────

  const undoBar = lastAction && (
    <div className={`rv-undo ${lastAction.action === 'approved' ? 'is-approved' : 'is-rejected'}`} role="status">
      <span className={`rv-undo-mark ${lastAction.action === 'approved' ? 'is-approved' : 'is-rejected'}`}>
        {lastAction.action === 'approved' ? <Check size={15} /> : <X size={15} />}
      </span>
      <span className="rv-undo-text">
        {lastAction.action === 'approved' ? 'Approved' : 'Rejected'}
        {lastAction.bypassed ? ' — without duplicate check' : ''}
        <span className="rv-undo-stem">“{shorten(lastAction.snapshot.stem)}”</span>
      </span>
      {canUndo ? (
        <button type="button" className="btn btn-outline btn-sm rv-undo-btn" onClick={undoLast} disabled={busy}>
          <Undo2 size={15} /> Undo <kbd className="rv-kbd">U</kbd>
        </button>
      ) : (
        <span className="rv-undo-note">
          Undo is unavailable for matching items —{' '}
          <Link to="/questions">reopen it in the question bank</Link>.
        </span>
      )}
    </div>
  );

  // Queue tools ride inside the progress strip once drafts are on screen —
  // the header keeps them only while the queue is empty or loading.
  const queueActions = (
    <div className="rv-head-actions" data-tour="review-tools">
      <label className="sr-only" htmlFor="rv-subject">Filter by subject</label>
      <select
        id="rv-subject"
        className="rv-select"
        data-active={!!subjectId}
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        disabled={busy}
      >
        <option value="">All subjects</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.code ? `${s.code} — ${s.name}` : s.name}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => { setIncludeFailed(approvableIds.length === 0); setConfirmBulk(true); }}
        disabled={busy || (approvableIds.length === 0 && failedCheckIds.length === 0)}
        title="Approve every draft still waiting in this queue"
      >
        <CheckCheck size={16} /> Approve all remaining
      </button>
      <button
        type="button"
        className="btn btn-outline btn-sm is-danger"
        onClick={() => setConfirmClear(true)}
        disabled={busy || pendingIds.length === 0}
        title="Delete every draft still waiting in this queue"
      >
        <Trash2 size={16} /> Clear queue
      </button>
    </div>
  );

  return (
    <AppShell pageClass="review" activeNav="questions" pageTitle="Review Queue">
      <header className="rv-head">
        <div className="rv-head-main">
          <span className="eyebrow">Question bank</span>
          <h1 className="rv-head-title">Review queue</h1>
          <p className="rv-head-sub">
            Every draft — AI-drafted, imported, or written by hand — needs your decision before it joins the bank. One item at a time, in full.
          </p>
        </div>
        {!queue?.length && queueActions}
      </header>

      {activeCount > 0 && (
        <div className="rv-alert" role="status">
          <Loader2 size={18} className="rv-spin" />
          <div className="rv-alert-body">
            <strong>{activeSummary || 'Background work in progress'}</strong>
            <span>
              {activeCount} task{activeCount === 1 ? '' : 's'} still running — new drafts
              appear here automatically as they finish.
            </span>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={reload} disabled={busy}>
            <RefreshCw size={15} /> Refresh now
          </button>
        </div>
      )}

      {failedGenerate && !failureOver && (
        <div className="rv-alert" role="alert">
          <AlertTriangle size={18} />
          <div className="rv-alert-body">
            <strong>Question generation failed</strong>
            <span>{failedGenerate.error || 'The worker reported an error.'}</span>
          </div>
          <button
            type="button"
            className="rv-alert-dismiss"
            aria-label="Dismiss"
            onClick={() => setDismissedFailure(failedGenerate.id)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {queue === null ? (
        <CardsSkeleton tiles={3} />
      ) : queue.length === 0 ? (
        activeCount > 0 ? (
          <JobsActivityPanel
            jobs={jobs}
            activeCount={activeCount}
            title="Drafts are being generated"
            onRefresh={refreshJobs}
          >
            <Link to="/questions" className="btn btn-outline btn-sm"><ArrowLeft size={15} /> Question bank</Link>
          </JobsActivityPanel>
        ) : (
          <div className="rv-panel">
            <div className="empty-state">
              <EmptyStateArt art="check" tone={3} />
              <h4>Nothing waiting for review</h4>
              <p>
                {subjectId
                  ? 'This subject has no draft questions. Try another subject, or generate a new batch from a blueprint.'
                  : 'There are no draft questions right now. Generate a batch from a blueprint, and they will queue up here for your approval.'}
              </p>
              <div className="empty-state-actions">
                <Link to="/questions" className="btn btn-outline"><ArrowLeft size={16} /> Question bank</Link>
                {/* Resolve to the blueprint itself when the scoped subject has
                    exactly one finalized TOS — otherwise land on the list. */}
                <button type="button" className="btn btn-primary" onClick={goGenerate}>
                  <Sparkles size={16} /> Generate from a blueprint
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          <section className="rv-progress" aria-label="Review progress" data-tour="review-progress">
            <div className="rv-progress-top">
              <span className="rv-progress-pos">
                {tally.remaining > 0 ? <>Item <b>{cursor + 1}</b> of {total}</> : <>All {total} reviewed</>}
              </span>
              <div className="rv-tally">
                <span className="rv-tally-item is-approved"><Check size={13} /> {tally.approved} approved</span>
                <span className="rv-tally-item is-rejected"><X size={13} /> {tally.rejected} rejected</span>
                <span className="rv-tally-item"><ClipboardCheck size={13} /> {tally.remaining} remaining</span>
              </div>
              {queueActions}
            </div>
            <div
              className="rv-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={decidedCount}
              aria-label={`${decidedCount} of ${total} drafts reviewed`}
            >
              <div className="rv-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </section>

          {undoBar}

          {tally.remaining === 0 ? (
            <div className="rv-panel">
              <div className="empty-state">
                <CheckCheck size={26} />
                <h4>Queue cleared</h4>
                <p>
                  {tally.approved} approved and {tally.rejected} rejected. Approved items are in the bank and
                  indexed for duplicate checks; rejected ones are kept so your decisions keep counting.
                </p>
                <div className="empty-state-actions">
                  <Link to="/questions" className="btn btn-primary"><ArrowLeft size={16} /> Question bank</Link>
                  <button type="button" className="btn btn-outline" onClick={reload} disabled={busy}>
                    <ClipboardCheck size={16} /> Check for new drafts
                  </button>
                </div>
              </div>
            </div>
          ) : current ? (
            <>
              <article className="rv-card" aria-label={`Draft ${cursor + 1} of ${total}`} data-tour="review-card">
                <div className="rv-card-meta">
                  <span className="rv-chip rv-chip-type">{TYPE_LABELS[current.type] || current.type}</span>
                  {current.subject_name && <span className="rv-chip">{current.subject_name}</span>}
                  {current.topic && <span className="rv-chip">{current.topic}</span>}
                  {current.bloom && (
                    <span className="g-bloom" data-level={BLOOM_LEVELS[current.bloom] || 1}>
                      {BLOOM_LABELS[current.bloom]}
                    </span>
                  )}
                  {current.ai_predicted_bloom && current.ai_predicted_bloom !== current.bloom && (
                    <span className="rv-chip rv-chip-ai" title="Bloom level the model predicted, for AI-evaluation metrics">
                      <Sparkles size={12} /> AI: {BLOOM_LABELS[current.ai_predicted_bloom] || current.ai_predicted_bloom}
                    </span>
                  )}
                  <span className="rv-chip rv-chip-source">
                    {current.source === 'ai' ? 'AI-generated' : current.source === 'import' ? 'Imported' : 'Manual'}
                  </span>
                </div>

                {current.similarity_flag === 'flagged' && (
                  <div className="rv-alert" role="alert">
                    <AlertTriangle size={18} />
                    <div className="rv-alert-body">
                      <strong>Possible duplicate of a question already in the bank</strong>
                      <span>
                        {current.similarity_score != null
                          ? `Closest match scores ${(Number(current.similarity_score) * 100).toFixed(1)}% similar. `
                          : ''}
                        Compare them before you approve.
                      </span>
                    </div>
                    <Link to={`/questions/${current.id}/similarity`} className="btn btn-outline btn-sm">
                      Compare <ArrowRight size={15} />
                    </Link>
                  </div>
                )}

                {!current.similarity_checked_at && !current.similarity_error && current.similarity_flag !== 'flagged' && (
                  <div className="rv-alert" role="status">
                    <AlertTriangle size={18} />
                    <div className="rv-alert-body">
                      <strong>Duplicate check pending</strong>
                      <span>This draft cannot be approved until its semantic similarity check finishes.</span>
                    </div>
                  </div>
                )}

                {current.similarity_error && (
                  <div className="rv-alert" role="alert">
                    <AlertTriangle size={18} />
                    <div className="rv-alert-body">
                      <strong>Duplicate check failed</strong>
                      <span>{current.similarity_error}</span>
                    </div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={retrySimilarity} disabled={busy}>
                      <RefreshCw size={15} /> Retry
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmBypass(true)} disabled={busy}>
                      <Check size={15} /> Approve anyway
                    </button>
                  </div>
                )}

                {editing ? (
                  <EditPanel
                    editing={editing}
                    setEditing={setEditing}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSaveDraft={() => saveEdit(false)}
                    onSaveApprove={() => saveEdit(true)}
                  />
                ) : (
                  <>
                    <RichText as="p" className="rv-stem" text={current.stem} />
                    <QuestionBody question={current} />
                    {current.explanation && (
                      <div className="rv-explanation">
                        <span className="rv-label">Explanation</span>
                        <RichText as="p" text={current.explanation} />
                      </div>
                    )}
                    {current.source === 'ai' && <EvidenceViewer key={current.id} question={current} />}
                    {!canEditInline && (
                      <p className="rv-note">
                        Matching items can't be edited from here — saving would drop their premise list.
                        Approve, reject, or <Link to="/questions">open the question bank</Link> to change the pairs.
                      </p>
                    )}
                  </>
                )}
              </article>

              {!editing && (
                <div className="rv-actions" data-tour="review-actions">
                  <div className="rv-actions-main">
                    <button type="button" className="rv-act is-approve" onClick={() => decide('approved')} disabled={busy || !similarityReady}>
                      <Check size={18} /> Approve <kbd className="rv-kbd">A</kbd>
                    </button>
                    <button type="button" className="rv-act is-reject" onClick={() => decide('rejected')} disabled={busy}>
                      <X size={18} /> Reject <kbd className="rv-kbd">R</kbd>
                    </button>
                    <button
                      type="button"
                      className="rv-act is-edit"
                      onClick={openEdit}
                      disabled={busy || !canEditInline}
                      title={canEditInline ? 'Fix it and approve in one motion' : 'Not available for matching items'}
                    >
                      <Pencil size={18} /> Edit <kbd className="rv-kbd">E</kbd>
                    </button>
                    <button type="button" className="rv-act is-skip" onClick={skip} disabled={busy}>
                      <SkipForward size={18} /> Skip <kbd className="rv-kbd">S</kbd>
                    </button>
                  </div>
                  <div className="rv-actions-foot">
                    <button type="button" className="rv-nav" onClick={goBack} disabled={busy || cursor === 0}>
                      <ArrowLeft size={15} /> Previous
                    </button>
                    <span className="rv-hint">
                      <Keyboard size={14} /> Arrow keys move, <kbd className="rv-kbd">U</kbd> undoes the last decision.
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rv-panel">
              <p className="placeholder">Nothing selected — <button type="button" className="rv-linkbtn" onClick={skip}>jump to the next draft</button>.</p>
            </div>
          )}
        </>
      )}

      <Modal
        open={confirmBulk}
        title={`Approve ${includeFailed ? approvableIds.length + failedCheckIds.length : approvableIds.length} draft${(includeFailed ? approvableIds.length + failedCheckIds.length : approvableIds.length) === 1 ? '' : 's'}?`}
        subtitle="This skips the per-item read that this screen exists for."
        onClose={() => setConfirmBulk(false)}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setConfirmBulk(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={approveAll}
              disabled={busy || (includeFailed ? approvableIds.length + failedCheckIds.length : approvableIds.length) === 0}
            >
              {busy && <span className="btn-spinner" />}
              <CheckCheck size={16} /> Approve {includeFailed ? approvableIds.length + failedCheckIds.length : approvableIds.length}
            </button>
          </>
        }
      >
        <p className="rv-modal-text">
          {approvableIds.length > 0
            ? `${approvableIds.length} question${approvableIds.length === 1 ? '' : 's'} that passed duplicate checking will become
          active and enter the duplicate-check index immediately.`
            : 'No drafts in this queue passed duplicate checking.'}
          {' '}There is no one-step undo for a bulk approval — you would have to reject them individually.
        </p>
        {failedCheckIds.length > 0 && (
          <label className="rv-checkline">
            <input
              type="checkbox"
              checked={includeFailed}
              onChange={(e) => setIncludeFailed(e.target.checked)}
            />
            <span>
              Also approve {failedCheckIds.length} draft{failedCheckIds.length === 1 ? '' : 's'} whose duplicate check
              {' '}<b>failed</b> — the similarity service is unreachable, so they join your bank
              unverified and stay out of the shared institution bank until a check succeeds.
              The bypass is audit-logged.
            </span>
          </label>
        )}
      </Modal>

      <Modal
        open={confirmBypass}
        title="Approve without duplicate check?"
        subtitle="The similarity service is unreachable — a failed check carries no information."
        onClose={() => setConfirmBypass(false)}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setConfirmBypass(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => { setConfirmBypass(false); decide('approved', { allowSimilarityFailure: true }); }}
              disabled={busy}
            >
              {busy && <span className="btn-spinner" />}
              <Check size={16} /> Approve anyway
            </button>
          </>
        }
      >
        <p className="rv-modal-text">
          The question becomes active in your bank and can be attached to exams, but it stays out of the
          shared institution bank until a successful check verifies it. Pending checks and flagged
          duplicates still block — this only bypasses the outage. The override is audit-logged.
        </p>
      </Modal>

      <Modal
        open={confirmClear}
        title={`Delete ${pendingIds.length} remaining draft${pendingIds.length === 1 ? '' : 's'}?`}
        subtitle="Deleted questions are gone — reject instead if you want the record kept."
        onClose={() => setConfirmClear(false)}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setConfirmClear(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={clearQueue} disabled={busy}>
              {busy && <span className="btn-spinner" />}
              <Trash2 size={16} /> Delete {pendingIds.length} draft{pendingIds.length === 1 ? '' : 's'}
            </button>
          </>
        }
      >
        <p className="rv-modal-text">
          Every draft still waiting in this queue will be permanently deleted, and its pending
          duplicate checks cancelled. Anything you already approved or rejected is untouched.
        </p>
      </Modal>
    </AppShell>
  );
}

/** First ~60 characters of a stem, for the undo bar. */
function shorten(stem) {
  const s = String(stem ?? '').replace(/\s+/g, ' ').trim();
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

/**
 * The answerable part of a draft, rendered per type — options with the correct
 * one marked, the premise/response map for matching, and the expected answer
 * for fill-in-the-blank. Nothing is truncated: an instructor cannot approve
 * what they cannot read.
 */
function QuestionBody({ question }) {
  const options = Array.isArray(question.options) ? question.options : [];

  if (question.type === 'mcq') {
    const correct = resolveAnswerIndex(options, question.answer);
    return (
      <ul className="rv-options">
        {options.map((opt, i) => (
          <li key={i} className={i === correct ? 'is-correct' : ''}>
            <span className="rv-option-letter">{String.fromCharCode(65 + i)}</span>
            <RichText className="rv-option-text" text={cleanOptionText(opt)} />
            {i === correct && <span className="rv-option-mark"><Check size={14} /> Correct</span>}
          </li>
        ))}
        {correct < 0 && (
          <li className="rv-options-warn">
            <AlertTriangle size={14} /> No option matches the stored answer{question.answer ? ` (“${question.answer}”)` : ''} — fix it before approving.
          </li>
        )}
      </ul>
    );
  }

  if (question.type === 'true_false') {
    const answer = trueFalseAnswer(question.answer);
    return (
      <ul className="rv-options rv-options-tf">
        {['True', 'False'].map((v) => (
          <li key={v} className={answer === v ? 'is-correct' : ''}>
            <span className="rv-option-letter">{v[0]}</span>
            <span className="rv-option-text">{v}</span>
            {answer === v && <span className="rv-option-mark"><Check size={14} /> Correct</span>}
          </li>
        ))}
        {!answer && (
          <li className="rv-options-warn">
            <AlertTriangle size={14} /> No answer recorded — fix it before approving.
          </li>
        )}
      </ul>
    );
  }

  if (question.type === 'matching') {
    const letters = matchingLetters(question.answer, options.length);
    return (
      <>
        <span className="rv-label">Premises and their answers</span>
        <ol className="rv-matching">
          {options.map((premise, i) => (
            <li key={i}>
              <span className="rv-match-num">{i + 1}</span>
              <RichText className="rv-option-text" text={cleanOptionText(premise)} />
              <span className={`rv-match-letter ${letters[i] ? '' : 'is-missing'}`}>{letters[i] || '—'}</span>
            </li>
          ))}
        </ol>
      </>
    );
  }

  // identification — displayed as fill-in-the-blank, wire value unchanged
  return (
    <div className="rv-answer">
      <span className="rv-label">Expected answer</span>
      <p>{question.answer || <em>None recorded — fix it before approving.</em>}</p>
    </div>
  );
}

/** One sortable option row in the MCQ editor. The grip is the only drag
 *  handle so text selection inside the input stays untouched. Row ids are
 *  positional — the list is a plain string[] — and correctIndex is remapped
 *  on drop in moveOption(). */
function SortableOptionRow({ id, index, opt, editing, setOption, removeOption, onCorrect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const letter = String.fromCharCode(65 + index);
  return (
    <div
      ref={setNodeRef}
      className={`rv-edit-option${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="rv-option-grip"
        aria-label={`Drag to reorder option ${letter}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <span className="rv-option-letter">{letter}</span>
      <label className="rv-radio-wrap">
        <span className="sr-only">Mark option {letter} as correct</span>
        <input
          type="radio"
          name="rv-correct"
          className="rv-radio"
          checked={editing.correctIndex === index}
          onChange={() => onCorrect(index)}
        />
      </label>
      <input
        type="text"
        className="form-control"
        value={opt}
        placeholder={`Option ${letter}`}
        onChange={(e) => setOption(index, e.target.value)}
      />
      <button
        type="button"
        className="rv-option-remove"
        aria-label={`Remove option ${letter}`}
        onClick={() => removeOption(index)}
        disabled={editing.optionList.length <= 2}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

/**
 * Inline editor. It lives in the card rather than a modal so fixing a typo and
 * approving is one motion instead of a context switch. The payload it builds is
 * the same full-body PUT QuestionsPage sends.
 */
function EditPanel({ editing, setEditing, busy, onCancel, onSaveDraft, onSaveApprove }) {
  const isMcq = editing.type === 'mcq';

  const sensors = useSensors(
    // A 6px travel threshold keeps clicks (radio, caret placement) off the drag path.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function moveOption(from, to) {
    const optionList = arrayMove(editing.optionList, from, to);
    let correctIndex = editing.correctIndex;
    if (correctIndex === from) correctIndex = to;
    else if (from < to && correctIndex > from && correctIndex <= to) correctIndex -= 1;
    else if (to < from && correctIndex >= to && correctIndex < from) correctIndex += 1;
    setEditing({ ...editing, optionList, correctIndex });
  }

  function setOption(i, value) {
    const optionList = editing.optionList.slice();
    optionList[i] = value;
    setEditing({ ...editing, optionList });
  }

  function removeOption(i) {
    const optionList = editing.optionList.filter((_, idx) => idx !== i);
    let correctIndex = editing.correctIndex;
    if (correctIndex === i) correctIndex = -1;
    else if (correctIndex > i) correctIndex -= 1;
    setEditing({ ...editing, optionList, correctIndex });
  }

  return (
    <div className="rv-edit">
      <div className="form-group">
        <label className="form-label" htmlFor="rv-stem">Question stem <span className="req">*</span></label>
        <textarea
          id="rv-stem"
          className="form-control"
          rows={4}
          autoFocus
          value={editing.stem || ''}
          onChange={(e) => setEditing({ ...editing, stem: e.target.value })}
        />
      </div>

      {isMcq && (
        <div className="form-group">
          <span className="form-label">Options <span className="form-hint-inline">select the correct one · drag to reorder</span></span>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id) moveOption(Number(active.id), Number(over.id));
            }}
          >
            <SortableContext
              items={editing.optionList.map((_, i) => i)}
              strategy={verticalListSortingStrategy}
            >
              <div className="rv-edit-options">
                {editing.optionList.map((opt, i) => (
                  <SortableOptionRow
                    key={i}
                    id={i}
                    index={i}
                    opt={opt}
                    editing={editing}
                    setOption={setOption}
                    removeOption={removeOption}
                    onCorrect={(idx) => setEditing({ ...editing, correctIndex: idx })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            className="btn btn-outline btn-sm rv-edit-add"
            onClick={() => setEditing({ ...editing, optionList: [...editing.optionList, ''] })}
          >
            <Plus size={15} /> Add option
          </button>
        </div>
      )}

      {editing.type === 'true_false' && (
        <div className="form-group">
          <label className="form-label" htmlFor="rv-answer-tf">Answer</label>
          <select
            id="rv-answer-tf"
            className="form-control form-select"
            value={trueFalseAnswer(editing.answer) || ''}
            onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
          >
            <option value="">Select an answer…</option>
            <option value="True">True</option>
            <option value="False">False</option>
          </select>
        </div>
      )}

      {editing.type === 'identification' && (
        <div className="form-group">
          <label className="form-label" htmlFor="rv-answer">Expected answer</label>
          <input
            id="rv-answer"
            type="text"
            className="form-control"
            maxLength={10000}
            value={editing.answer || ''}
            onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
          />
        </div>
      )}

      <div className="rv-edit-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="rv-topic">Topic</label>
          <input
            id="rv-topic"
            type="text"
            className="form-control"
            maxLength={255}
            value={editing.topic || ''}
            onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="rv-bloom">Bloom level</label>
          <select
            id="rv-bloom"
            className="form-control form-select"
            value={editing.bloom || ''}
            onChange={(e) => setEditing({ ...editing, bloom: e.target.value })}
          >
            <option value="">— Select —</option>
            {BLOOM_ORDER.map((b) => <option key={b} value={b}>{BLOOM_LABELS[b]}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="rv-explanation">Explanation</label>
        <textarea
          id="rv-explanation"
          className="form-control"
          rows={3}
          maxLength={10000}
          value={editing.explanation || ''}
          onChange={(e) => setEditing({ ...editing, explanation: e.target.value })}
        />
      </div>

      <div className="rv-edit-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-outline" onClick={onSaveDraft} disabled={busy}>
          <Save size={16} /> Save as draft
        </button>
        <button type="button" className="btn btn-primary" onClick={onSaveApprove} disabled={busy}>
          {busy && <span className="btn-spinner" />}
          <Check size={16} /> Save &amp; approve
        </button>
      </div>
    </div>
  );
}
