import '../styles/blueprint-detail.css';
/**
 * TosDetailPage — TOS builder with topic management.
 *
 * Uses page-header, tos-workflow-callout, stats-grid, Bloom distribution with
 * bloom-bar-row, topics card with data-table + inline-form.
 *
 * It renders learning outcomes and per-topic item counts on the topics
 * table, and the topic × Bloom-level matrix (item distribution per topic AND
 * cognitive level). Topics are edited in place — no modal, no page change.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, BookOpen, Sparkles, FileText, Pencil, ListOrdered, Layers, Clock, Check, X, AlertTriangle, Lock, Copy, GripVertical } from 'lucide-react';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from '../components/Toast.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import useJobs, { isActiveJob, jobPayload } from '../lib/useJobs.js';
import AppShell from '../components/AppShell.jsx';
import { CardsSkeleton } from '../components/Loaders.jsx';
import { useGridTable, DsPager, DsPageSize } from '../components/DataTable.jsx';
import Reveal from '../components/Reveal.jsx';
import StageRail from '../components/StageRail.jsx';
import celebrate from '../lib/celebrate.js';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

/** How many learning outcomes a collapsed topic row shows before "+N more". */
const OUTCOME_PREVIEW = 2;

/** Topics table page size — rows carry outcome lists, so they are tall. */
const TOPIC_PAGE_SIZE = 10;

// Topic order comes from the blueprint itself — the table only paginates.
const TOPIC_PAGER_COLUMNS = [{ id: 'row', enableSorting: false }];

/** Split a textarea's contents into trimmed, non-empty outcome lines. */
function splitLines(text) {
  return String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/**
 * Coerce tos_topics.learning_outcomes into a string array.
 *
 * The column normally holds a JSON array string (normalizeOutcomes() in
 * api/src/routes/tos.js writes it), but legacy rows hold plain text and a
 * hand-edited row can hold malformed JSON. None of those may throw here.
 */
function parseOutcomes(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return cleanOutcomes(value);
  if (typeof value !== 'string') return [];

  const raw = value.trim();
  if (!raw) return [];
  if (raw.startsWith('[') || raw.startsWith('"')) {
    try {
      const decoded = JSON.parse(raw);
      if (Array.isArray(decoded)) return cleanOutcomes(decoded);
      if (typeof decoded === 'string') return splitLines(decoded);
    } catch {
      /* malformed JSON — fall through and treat it as plain text */
    }
  }
  return splitLines(raw);
}

/** Keep only printable scalar entries from a decoded outcomes array. */
function cleanOutcomes(list) {
  return list
    .filter((o) => typeof o === 'string' || typeof o === 'number')
    .map((o) => String(o).trim())
    .filter(Boolean);
}

/**
 * Largest-remainder apportionment: split `total` into buckets sized by
 * `weights` so the parts sum to exactly `total`, instead of drifting the way
 * per-cell Math.round() does. Mirrors recalcTopicItemCounts() in the API.
 */
function apportion(total, weights) {
  const target = Math.max(0, Math.trunc(Number(total) || 0));
  const w = weights.map((n) => Math.max(0, Number(n) || 0));
  const sum = w.reduce((s, n) => s + n, 0);
  if (!target || !sum) return w.map(() => 0);

  const parts = [];
  const remainders = [];
  let allocated = 0;
  w.forEach((weight, i) => {
    const exact = (weight / sum) * target;
    const whole = Math.floor(exact);
    parts[i] = whole;
    allocated += whole;
    remainders.push({ i, remainder: exact - whole });
  });
  remainders.sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of remainders) {
    if (allocated >= target) break;
    parts[i]++;
    allocated++;
  }
  return parts;
}

/**
 * Build the specification matrix: rows are topics, columns are the six Bloom
 * levels, cells are the items that topic contributes at that level.
 *
 * Per-topic totals come from tos_topics.item_count (the API derives it from
 * instructional hours). If those have drifted — legacy rows, a blueprint whose
 * total changed before the recalc landed — they are re-derived here from hours
 * so the grand total still equals tos.total_items. Each row is then split
 * across the Bloom weights by largest remainder, so every row sums to the
 * topic's item count and the columns sum to the blueprint total.
 */
function buildMatrix(tos, topics) {
  const weights = BLOOM_ORDER.map((k) => Number(tos.bloom_weights?.[k]) || 0);
  const totalItems = Math.max(0, Number(tos.total_items) || 0);

  const stored = topics.map((t) => Math.max(0, Number(t.item_count) || 0));
  const storedSum = stored.reduce((s, n) => s + n, 0);
  let itemCounts = stored;
  if (storedSum !== totalItems) {
    const hours = topics.map((t) => Math.max(0, Number(t.instructional_hours) || 0));
    const hourSum = hours.reduce((s, n) => s + n, 0);
    itemCounts = apportion(totalItems, hourSum > 0 ? hours : topics.map(() => 1));
  }

  // Apportioning each row independently against the static weights satisfies
  // the row totals but not the column ones: with 4-5 items split six ways, the
  // smallest weight never wins a remainder, so a blueprint asking for 10%
  // 'Create' can render a column of zeros and contradict itself.
  //
  // Instead, fix the column targets once from the blueprint, then fill each row
  // against what each column still NEEDS. Both margins then hold: every row
  // sums to its item count and every column to its Bloom share.
  const colTargets = apportion(totalItems, weights);
  const need = [...colTargets];
  const rows = topics.map((topic, i) => {
    const items = itemCounts[i] || 0;
    const cells = apportion(items, need);
    // apportion() can hand a column more than it still needs when the remaining
    // need is lumpy; pull the excess back and re-place it where need is largest.
    let excess = 0;
    cells.forEach((n, j) => {
      if (n > need[j]) { excess += n - need[j]; cells[j] = need[j]; }
    });
    while (excess > 0) {
      let best = -1;
      need.forEach((n, j) => {
        if (n - cells[j] > 0 && (best < 0 || n - cells[j] > need[best] - cells[best])) best = j;
      });
      if (best < 0) break; // nothing left anywhere — drop rather than loop
      cells[best]++; excess--;
    }
    cells.forEach((n, j) => { need[j] -= n; });
    return { topic, items, cells };
  });

  const colTotals = BLOOM_ORDER.map((_, c) => rows.reduce((s, r) => s + r.cells[c], 0));
  // Sum the columns, not the row item counts: when every Bloom weight is 0
  // apportion() places nothing, and a grand total taken from row items would
  // claim items the matrix never actually shows.
  const grand = colTotals.reduce((s, n) => s + n, 0);

  const cellMax = Math.max(1, ...rows.flatMap((r) => r.cells));

  return { rows, colTotals, grand, weights, cellMax, reconciled: storedSum !== totalItems, storedSum };
}

export default function TosDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();
  const navigate = useNavigate();
  const [data, setData] = useState(() => api.peek(`/tos/${id}`) ?? null);
  const [newTopic, setNewTopic] = useState({ title: '', instructional_hours: 0, outcomes: '' });
  const [savingTopic, setSavingTopic] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', instructional_hours: 0, outcomes: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [selTopics, setSelTopics] = useState(() => new Set());
  const [deriveOpen, setDeriveOpen] = useState(false);
  const [deriveTitle, setDeriveTitle] = useState('');
  const [deriving, setDeriving] = useState(false);
  const [removingSel, setRemovingSel] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [fillingSyllabus, setFillingSyllabus] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [orderDraft, setOrderDraft] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const titleRef = useRef(null);
  const jobStatusesRef = useRef(new Map());

  const load = useCallback(() => (
    api.get(`/tos/${id}`)
      .then(setData)
      .catch((err) => {
        toast.error(err.message || 'Could not load TOS.');
        navigate('/tos');
      })
  ), [id, toast, navigate]);

  useEffect(() => { load(); }, [load]);

  // One-click topic sources for this blueprint (question bank + sibling
  // blueprints + whether a processed syllabus exists). Cheap — fetch always,
  // render only while the blueprint is a draft. Keyed by id so a stale
  // response can't leak into another blueprint's view.
  useEffect(() => {
    let cancelled = false;
    api.get(`/tos/${id}/topic-suggestions`)
      .then((d) => { if (!cancelled) setSuggestions({ id, ...d }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  async function handleAddTopic(e) {
    e.preventDefault();
    if (!newTopic.title.trim()) { toast.error('Topic title is required.'); return; }
    setSavingTopic(true);
    try {
      await api.post(`/tos/${id}/topics`, {
        title: newTopic.title.trim(),
        instructional_hours: Number(newTopic.instructional_hours) || 0,
        learning_outcomes: splitLines(newTopic.outcomes),
      });
      toast.success('Topic added.');
      setNewTopic({ title: '', instructional_hours: 0, outcomes: '' });
      // Adding topics is a run of repeats — keep the caret where the next one
      // gets typed instead of making the user re-aim at the form every time.
      titleRef.current?.focus();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add topic.');
    } finally {
      setSavingTopic(false);
    }
  }

  function startEdit(tp) {
    setEditingId(tp.id);
    setEditDraft({
      title: tp.title || '',
      instructional_hours: Number(tp.instructional_hours) || 0,
      outcomes: parseOutcomes(tp.learning_outcomes).join('\n'),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setSavingEdit(false);
  }

  async function handleSaveEdit(topicId) {
    if (!editDraft.title.trim()) { toast.error('Topic title is required.'); return; }
    setSavingEdit(true);
    try {
      await api.put(`/tos/${id}/topics/${topicId}`, {
        title: editDraft.title.trim(),
        instructional_hours: Number(editDraft.instructional_hours) || 0,
        learning_outcomes: splitLines(editDraft.outcomes),
      });
      toast.success('Topic updated.');
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update topic.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteTopic(topicId) {
    if (!(await confirm('Remove this topic? This cannot be undone.', { title: 'Remove topic', confirmText: 'Remove' }))) return;
    try {
      await api.del(`/tos/${id}/topics/${topicId}`);
      toast.success('Topic removed.');
      if (editingId === topicId) setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Could not remove topic.');
    }
  }

  // A generation run already active for THIS blueprint — other blueprints
  // can still generate in parallel; the API refuses an identical duplicate.
  const { jobs } = useJobs();
  const generationActive = useMemo(
    () => jobs.some((j) => j.type === 'generate' && isActiveJob(j) && jobPayload(j).tosId === id),
    [jobs, id]
  );
  const syllabusActive = useMemo(
    () => jobs.some((j) => j.type === 'syllabus_tos' && isActiveJob(j) && jobPayload(j).tosId === id),
    [jobs, id]
  );

  // Watch job transitions: when a syllabus→blueprint fill for THIS TOS goes
  // from active to done, pull the new topic rows in without a page refresh.
  useEffect(() => {
    const prev = jobStatusesRef.current;
    const next = new Map();
    for (const j of jobs) {
      next.set(j.id, j.status);
      if (j.type !== 'syllabus_tos' || jobPayload(j).tosId !== id) continue;
      const was = prev.get(j.id);
      if (was === 'queued' || was === 'running') {
        if (j.status === 'done') {
          toast.success('Syllabus topics added to this blueprint.');
          load();
        } else if (j.status === 'failed') {
          toast.error('Syllabus topic extraction failed — try again.');
        }
      }
    }
    jobStatusesRef.current = next;
  }, [jobs, id, toast, load]);

  /** Enqueue AI extraction of topics from the subject's processed syllabus. */
  async function handleSyllabusFill() {
    setFillingSyllabus(true);
    try {
      await api.post('/ai/syllabus-tos', { tosId: id });
      toast.success('Syllabus scan queued — extracted topics drop into this blueprint when it finishes.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start the syllabus scan.');
    } finally {
      setFillingSyllabus(false);
    }
  }

  // Merge bank + sibling-blueprint suggestions into one deduped list —
  // the same topic in both sources renders once, carrying the blueprint's
  // hours/outcomes AND the bank's question count. Sorted by evidence.
  const suggestionItems = useMemo(() => {
    if (!suggestions || suggestions.id !== id) return [];
    const map = new Map();
    for (const b of suggestions.blueprints || []) {
      map.set(b.title.trim().toLowerCase(), {
        title: b.title,
        instructional_hours: b.instructional_hours,
        learning_outcomes: b.learning_outcomes,
        blueprint: b.blueprint_title,
        count: 0,
      });
    }
    for (const q of suggestions.bank || []) {
      const k = q.title.trim().toLowerCase();
      const ex = map.get(k);
      if (ex) ex.count = q.question_count;
      else map.set(k, { title: q.title, instructional_hours: 3, learning_outcomes: [], blueprint: null, count: q.question_count });
    }
    return [...map.values()].sort((a, b) => (b.count - a.count) || a.title.localeCompare(b.title));
  }, [suggestions, id]);

  /** Add one suggested topic through the normal topic endpoint. */
  async function addSuggested(topic) {
    let outcomes = topic.learning_outcomes;
    if (typeof outcomes === 'string') { try { outcomes = JSON.parse(outcomes); } catch { outcomes = []; } }
    try {
      await api.post(`/tos/${id}/topics`, {
        title: topic.title,
        instructional_hours: Number(topic.instructional_hours) || 3,
        learning_outcomes: Array.isArray(outcomes) ? outcomes : [],
      });
      // Drop the suggestion optimistically so the same topic can't be added twice.
      const t = topic.title.trim().toLowerCase();
      setSuggestions((s) => (s ? {
        ...s,
        bank: s.bank.filter((b) => b.title.trim().toLowerCase() !== t),
        blueprints: s.blueprints.filter((b) => b.title.trim().toLowerCase() !== t),
      } : s));
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add topic.');
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await api.post('/ai/generate-questions', { tosId: id });
      toast.success(`Generation queued — drafts will appear on the Questions page, and you can watch progress under Background work.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Generation failed to start.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await api.post(`/tos/${id}/finalize`);
      toast.success('TOS finalized. Its structure is now locked and question generation is enabled.');
      celebrate();
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not finalize this TOS.');
    } finally {
      setFinalizing(false);
    }
  }

  /** Toggle one topic's checkbox. */
  function toggleTopicSel(topicId) {
    setSelTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId); else next.add(topicId);
      return next;
    });
  }

  /** Select/clear just the topics visible on the current page. */
  function toggleTopicsOnPage(ids, turningOn) {
    setSelTopics((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => { if (turningOn) next.add(id); else next.delete(id); });
      return next;
    });
  }

  /** Remove the selected topics (draft blueprints only). */
  async function handleRemoveSelected() {
    const ids = [...selTopics];
    if (!ids.length) return;
    if (!(await confirm(
      `Remove ${ids.length} selected topic${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
      { title: 'Remove topics', confirmText: 'Remove' }
    ))) return;
    setRemovingSel(true);
    try {
      await api.post(`/tos/${id}/topics/bulk-delete`, { ids });
      toast.success(`${ids.length} topic${ids.length === 1 ? '' : 's'} removed.`);
      if (editingId && selTopics.has(editingId)) setEditingId(null);
      setSelTopics(new Set());
      load();
    } catch (err) {
      toast.error(err.message || 'Could not remove topics.');
    } finally {
      setRemovingSel(false);
    }
  }

  /** Clone the selected topics into a new draft blueprint. */
  async function handleDerive(e) {
    e.preventDefault();
    const title = deriveTitle.trim();
    if (!title || !selTopics.size) return;
    setDeriving(true);
    try {
      const { tos: created } = await api.post(`/tos/${id}/derive`, { title, topicIds: [...selTopics] });
      toast.success('New blueprint created from the selected topics.');
      setDeriveOpen(false);
      navigate(`/tos/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the blueprint.');
    } finally {
      setDeriving(false);
    }
  }

  /** Expand / collapse one topic's outcome list without touching the others. */
  function toggleOutcomes(topicId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId); else next.add(topicId);
      return next;
    });
  }

  /** Enter saves an inline edit, Escape abandons it. */
  function onEditKeyDown(e, topicId) {
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); return; }
    if (e.key !== 'Enter') return;
    // A second Enter while the first PUT is in flight would fire a concurrent
    // save, and each save triggers a server-side item-count recalc.
    if (savingEdit) { e.preventDefault(); return; }
    // The outcomes textarea holds one outcome per line, so a plain Enter has
    // to insert a line there — Ctrl/Cmd+Enter saves from any field.
    if (e.target.tagName === 'TEXTAREA' && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    handleSaveEdit(topicId);
  }

  const matrix = useMemo(
    () => (data ? buildMatrix(data.tos, data.topics) : null),
    [data]
  );

  // Hook must run before the !data early return — safe because the table
  // just gets an empty topic list until the blueprint loads.
  const topicGrid = useGridTable({ data: data?.topics || [], columns: TOPIC_PAGER_COLUMNS, pageSize: TOPIC_PAGE_SIZE });

  if (!data) return <AppShell pageClass="blueprint-detail" activeNav="tos" pageTitle="Blueprint"><CardsSkeleton tiles={3} /></AppShell>;
  const { tos, topics, coverage = {}, usage = { exams: 0, scans: 0 } } = data;
  const finalized = tos.status === 'finalized';
  const totalHours = topics.reduce((s, t) => s + (Number(t.instructional_hours) || 0), 0);

  // Live questions already banked for a topic × Bloom cell (drafts + approved;
  // rejected never counts — same rule the generation worker applies).
  const coveredFor = (topicTitle, bloom) =>
    Number(coverage[`${topicTitle}||${bloom}`]?.live || 0);
  let coveredSlots = 0;
  let missingSlots = 0;
  if (matrix) {
    for (const { topic, cells } of matrix.rows) {
      cells.forEach((need, c) => {
        const have = coveredFor(topic.title, BLOOM_ORDER[c]);
        coveredSlots += Math.min(have, need);
        missingSlots += Math.max(0, need - have);
      });
    }
  }

  // The topics table paginates; safeTopicPage self-heals if deletions shrink
  // the last page. Rows index into matrix.rows by ABSOLUTE position.
  const {
    pageRows: pageTopics, safePage: safeTopicPage,
    start: topicStart, end: topicEnd,
  } = topicGrid;

  // Lifecycle rail — where this blueprint actually is, live. The first
  // unfinished stage is "current"; everything before it checks off.
  const totalItems = Math.max(0, Number(tos.total_items) || 0);
  const railStages = [
    { label: 'Topics planned', sub: `${topics.length} topic${topics.length === 1 ? '' : 's'}`, done: topics.length > 0 },
    { label: 'Banked', sub: `${coveredSlots} of ${totalItems} covered`, done: totalItems > 0 && coveredSlots >= totalItems },
    { label: 'Finalized', sub: finalized ? 'locked' : 'draft — review required', done: finalized },
    { label: 'Exam assembled', sub: usage.exams ? `${usage.exams} exam${usage.exams === 1 ? '' : 's'}` : undefined, done: usage.exams > 0 },
    { label: 'Sheets scanned', sub: usage.scans ? `${usage.scans} sheet${usage.scans === 1 ? '' : 's'}` : undefined, done: usage.scans > 0 },
  ];
  const railNext = railStages.findIndex((s) => !s.done);
  const railSteps = railStages.map((s, i) => ({
    label: s.label,
    sub: s.sub,
    state: s.done ? 'done' : i === railNext ? 'current' : 'todo',
  }));

  // Topic checkboxes drive "remove" (draft only) and "derive into new blueprint".
  const selTopicCount = selTopics.size;
  const pageTopicIds = pageTopics.map((t) => t.id);
  const allTopicsChecked = pageTopicIds.length > 0 && pageTopicIds.every((tId) => selTopics.has(tId));
  const someTopicsChecked = !allTopicsChecked && pageTopicIds.some((tId) => selTopics.has(tId));

  // Reorder mode swaps the topics table for a flat sortable list; the order
  // commits once on Save so multi-drag adjustments stay local.
  const startReorder = () => {
    setOrderDraft([...topics]);
    setReordering(true);
    setSelTopics(new Set());
  };
  const cancelReorder = () => { setReordering(false); setOrderDraft(null); };

  const onTopicDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setOrderDraft((cur) => {
      const from = cur.findIndex((t) => t.id === active.id);
      const to = cur.findIndex((t) => t.id === over.id);
      return from < 0 || to < 0 ? cur : arrayMove(cur, from, to);
    });
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      await api.put(`/tos/${id}/topics/reorder`, { orderedIds: orderDraft.map((t) => t.id) });
      setData((d) => d && { ...d, topics: orderDraft.map((t, i) => ({ ...t, sort_order: i + 1 })) });
      setReordering(false);
      setOrderDraft(null);
      toast.success('Topic order saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save the new order.');
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <AppShell pageClass="blueprint-detail" activeNav="tos" pageTitle={tos.title}>

      <div className="page-header">
        <div>
          <h1>{tos.title}</h1>
          {tos.subject_name && (
            <Link to="/subjects" className="crumb-link">
              <BookOpen size={14} />
              {tos.subject_name}
              {tos.subject_code && <span className="badge badge-gray ml-1">{tos.subject_code}</span>}
            </Link>
          )}
          <span className={`badge ${finalized ? 'badge-green' : 'badge-amber'} ml-1`}>
            {finalized ? 'Finalized' : 'Draft — review required'}
          </span>
        </div>
        <div className="header-actions" data-tour="tos-detail-actions">
          {!finalized && (
            <button type="button" className="btn btn-outline btn-sm" onClick={handleFinalize} disabled={finalizing}>
              {finalizing ? <span className="btn-spinner" /> : <Lock size={14} />} Finalize TOS
            </button>
          )}
          <button
            type="button"
            className="btn btn-brand btn-sm"
            onClick={handleGenerate}
            disabled={generating || !finalized || generationActive || !matrix?.rows.length || missingSlots === 0}
            title={generationActive
              ? 'A generation run for this blueprint is already in progress — watch it under Background work'
              : !matrix?.rows.length
                ? 'Add topics to the blueprint first'
                : missingSlots > 0
                  ? `Drafts only the ${missingSlots} item${missingSlots === 1 ? '' : 's'} still missing — existing questions are kept`
                  : 'Every matrix cell is already covered — nothing to generate'}
          >
            {generating || generationActive ? <span className="btn-spinner" /> : <Sparkles size={14} />}
            {generationActive ? 'Generating…' : missingSlots > 0 ? `Generate ${missingSlots} missing` : 'Auto-generate Questions'}
          </button>
          <Link to={`/exams/new?tos=${id}`} className="btn btn-outline btn-sm">
            <FileText size={14} /> Build Exam
          </Link>
          {!finalized && <Link to={`/tos?edit=${id}`} className="btn btn-outline btn-sm"><Pencil size={14} /> Edit</Link>}
        </div>
      </div>

      <div data-tour="tos-workflow">
        <StageRail steps={railSteps} />
      </div>

      <div className="stats-grid mb-2" data-tour="tos-stats">
        <div className="stat-card">
          <div className="stat-icon blue"><ListOrdered size={18} /></div>
          <div className="stat-info"><div className="stat-value">{Number(tos.total_items)}</div><div className="stat-label">Total Items</div></div>
          <div className="stat-context">{finalized ? 'blueprint finalized' : 'draft — finalize to generate'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Layers size={18} /></div>
          <div className="stat-info"><div className="stat-value">{topics.length}</div><div className="stat-label">Topics</div></div>
          <div className="stat-context">{topics.length > 0 ? `~${Math.round(Number(tos.total_items) / topics.length)} items per topic` : 'add topics to allocate items'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Clock size={18} /></div>
          <div className="stat-info"><div className="stat-value">{totalHours}</div><div className="stat-label">Instructional Hours</div></div>
          <div className="stat-context">{Number(totalHours) > 0 ? `${(Number(tos.total_items) / Number(totalHours)).toFixed(1)} items per hour` : 'hours drive allocation'}</div>
        </div>
      </div>

      <div className="card mb-2">
        <div className="card-header">
          <span className="card-title">Bloom's Taxonomy Distribution</span>
        </div>
        <div className="card-body">
          {BLOOM_ORDER.map((k, i) => {
            const pct = Number(tos.bloom_weights?.[k]) || 0;
            const itemCount = Math.round((pct / 100) * Number(tos.total_items));
            return (
              <div key={k} className="bloom-bar-row">
                <div className="bloom-bar-label">{BLOOM_LABELS[k]}</div>
                <div className="bloom-bar-track">
                  <div className="bloom-bar-fill" data-level={i + 1} style={{ width: `${pct}%` }} />
                </div>
                <div className="bloom-bar-meta">
                  <span className="badge badge-gray">{pct}%</span>
                  <span className="text-muted meta-xs">~{itemCount} items</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {matrix && matrix.rows.length > 0 && (
        <Reveal className="card mb-2" data-tour="tos-matrix">
          <div className="card-header">
            <div>
              <span className="card-title">Specification Matrix</span>
              <p className="card-sub">Each cell reads banked/needed. Amber cells are short — generate to fill them; rejected questions never count.</p>
            </div>
            {matrix.reconciled ? (
              <span className="tos-matrix-drift" title={`Stored per-topic counts total ${matrix.storedSum}, blueprint total is ${Number(tos.total_items)}.`}>
                <AlertTriangle size={13} aria-hidden="true" /> Item counts re-derived from hours
              </span>
            ) : (
              <span className="text-muted meta-sm">
                {coveredSlots} of {matrix.grand} covered{missingSlots > 0 ? ` · ${missingSlots} to draft` : ''}
              </span>
            )}
          </div>
          <div className="tos-matrix-scroll">
            <table className="data-table tos-matrix">
              <caption className="sr-only">
                Table of Specifications matrix: rows are topics, columns are Bloom's cognitive
                levels, and each cell is the number of items that topic contributes at that level.
                The last column totals each topic and the last row totals each level.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="tos-matrix-topic-col">Topic</th>
                  {BLOOM_ORDER.map((k, i) => (
                    <th key={k} scope="col" className="tos-matrix-num">
                      <span className="g-bloom" data-level={i + 1}>{BLOOM_LABELS[k]}</span>
                      <span className="tos-matrix-pct">{matrix.weights[i]}%</span>
                    </th>
                  ))}
                  <th scope="col" className="tos-matrix-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map(({ topic, items, cells }) => (
                  <tr key={topic.id}>
                    <th scope="row" className="tos-matrix-topic-col">{topic.title}</th>
                    {cells.map((n, c) => {
                      const have = n > 0 ? coveredFor(topic.title, BLOOM_ORDER[c]) : 0;
                      const short = n > 0 && have < n;
                      return (
                        <td key={BLOOM_ORDER[c]}
                          className={`tos-matrix-num${n === 0 ? ' is-zero' : ''}${short ? ' is-short' : ''}${n > 0 && !short ? ' is-met' : ''}`}
                          style={{ '--heat': n / matrix.cellMax }}
                          title={n > 0 ? `${have} of ${n} banked for ${topic.title} · ${BLOOM_LABELS[BLOOM_ORDER[c]]}` : undefined}>
                          {n === 0 ? 0 : (short ? <>{have}<span className="tos-matrix-need">/{n}</span></> : n)}
                        </td>
                      );
                    })}
                    <td className="tos-matrix-num is-total">{items}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="tos-matrix-topic-col">Total</th>
                  {matrix.colTotals.map((n, c) => (
                    <td key={BLOOM_ORDER[c]} className="tos-matrix-num">{n}</td>
                  ))}
                  <td className="tos-matrix-num is-total">{matrix.grand}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Reveal>
      )}

      <div className="card" data-tour="tos-topics">
        <div className="card-header">
          <span className="card-title">Topics</span>
          {selTopicCount > 0 ? (
            <div className="tos-selbar">
              <span className="tos-selbar-count">{selTopicCount} selected</span>
              <button type="button" className="btn btn-primary btn-xs" onClick={() => { setDeriveTitle(''); setDeriveOpen(true); }}>
                <Copy size={13} /> New blueprint
              </button>
              {!finalized && (
                <button type="button" className="btn btn-outline btn-xs is-danger" onClick={handleRemoveSelected} disabled={removingSel}>
                  {removingSel ? <span className="btn-spinner" /> : <Trash2 size={13} />} Remove
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelTopics(new Set())}>Clear</button>
            </div>
          ) : (
            <div className="tos-head-right">
              <span className="text-muted meta-sm">{topics.length} topic{topics.length === 1 ? '' : 's'}</span>
              {!finalized && topics.length > 1 && (
                <button type="button" className="btn btn-outline btn-xs" onClick={startReorder}>
                  <GripVertical size={13} /> Reorder
                </button>
              )}
              {!finalized && suggestions?.id === id && (suggestionItems.length > 0 || suggestions.hasSyllabus) && (
                <button type="button" className="btn btn-outline btn-xs" onClick={() => setSuggestOpen(true)}>
                  <Sparkles size={13} /> Suggest topics
                  {suggestionItems.length > 0 && <span className="tos-sugg-badge">{suggestionItems.length}</span>}
                </button>
              )}
            </div>
          )}
        </div>
        {reordering ? (
          <div className="tos-reorder">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTopicDragEnd}>
              <SortableContext items={(orderDraft || []).map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <ul className="tos-reorder-list">
                  {(orderDraft || []).map((t, i) => (
                    <SortableTopicRow key={t.id} id={t.id} index={i} title={t.title} hours={t.instructional_hours} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <div className="tos-reorder-foot">
              <span className="text-muted meta-sm">Drag rows to set the topic sequence used by the matrix and generated sets.</span>
              <div className="tos-reorder-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={cancelReorder} disabled={savingOrder}>Cancel</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={saveOrder} disabled={savingOrder}>
                  {savingOrder ? <span className="btn-spinner" /> : <Check size={14} />} Save order
                </button>
              </div>
            </div>
          </div>
        ) : topics.length === 0 ? (
          <div className="empty-state empty-state-md">
            <Layers aria-hidden="true" />
            <p>No topics added yet. Add topics below to define what this TOS covers.</p>
          </div>
        ) : (
          <div className="table-wrap table-bare tos-topics-scroll">
            <table className="data-table tos-topics">
              <caption className="sr-only">Topics in this Table of Specification</caption>
              <thead>
                <tr>
                  <th scope="col" className="col-select">
                    <label className="ds-check">
                      <input
                        type="checkbox"
                        checked={allTopicsChecked}
                        ref={(el) => { if (el) el.indeterminate = someTopicsChecked; }}
                        onChange={() => toggleTopicsOnPage(pageTopicIds, !allTopicsChecked)}
                      />
                      <span aria-hidden="true" />
                      <span className="sr-only">Select topics on this page</span>
                    </label>
                  </th>
                  <th scope="col" className="col-num">#</th>
                  <th scope="col">Topic</th>
                  <th scope="col" className="col-outcomes">Learning Outcomes</th>
                  <th scope="col" className="col-medium">Instructional Hours</th>
                  <th scope="col" className="col-items">Items</th>
                  <th scope="col" className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageTopics.map((tp, i) => {
                  const absI = safeTopicPage * topicGrid.pageSize + i;
                  const editing = editingId === tp.id;
                  const outcomes = parseOutcomes(tp.learning_outcomes);
                  const open = expanded.has(tp.id);
                  const shown = open ? outcomes : outcomes.slice(0, OUTCOME_PREVIEW);
                  const items = matrix?.rows[absI]?.items ?? (Number(tp.item_count) || 0);

                  const isSel = selTopics.has(tp.id);
                  return (
                    <tr key={tp.id} className={`${editing ? 'tos-row-editing' : ''}${isSel ? ' is-selected' : ''}`.trim() || undefined}
                      onContextMenu={editing ? undefined : (e) => openMenu(e, [
                        ...(finalized ? [] : [
                          { label: 'Edit topic', icon: Pencil, onClick: () => startEdit(tp) },
                        ]),
                        { label: 'Copy title', icon: Copy, onClick: () => copyText(tp.title, 'Topic title') },
                        ...(finalized ? [] : [
                          'sep',
                          { label: 'Remove topic', icon: Trash2, danger: true, onClick: () => handleDeleteTopic(tp.id) },
                        ]),
                      ])}>
                      <td className="col-select">
                        <label className="ds-check">
                          <input
                            type="checkbox"
                            checked={isSel}
                            disabled={editing}
                            onChange={() => toggleTopicSel(tp.id)}
                          />
                          <span aria-hidden="true" />
                          <span className="sr-only">Select “{tp.title}”</span>
                        </label>
                      </td>
                      <td className="text-muted">{absI + 1}</td>
                      <td>
                        {editing ? (
                          <input type="text" className="form-control" maxLength={255} autoFocus
                            aria-label="Topic title" disabled={savingEdit}
                            value={editDraft.title}
                            onKeyDown={(e) => onEditKeyDown(e, tp.id)}
                            onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                        ) : (
                          <span className="cell-primary">{tp.title}</span>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <textarea className="form-control tos-edit-outcomes" rows={2} disabled={savingEdit}
                            aria-label="Learning outcomes, one per line"
                            placeholder="One outcome per line"
                            value={editDraft.outcomes}
                            onKeyDown={(e) => onEditKeyDown(e, tp.id)}
                            onChange={(e) => setEditDraft({ ...editDraft, outcomes: e.target.value })} />
                        ) : outcomes.length === 0 ? (
                          <span className="g-mute">—</span>
                        ) : (
                          <div className="tos-outcomes">
                            <ul className="tos-outcome-list">
                              {shown.map((o, oi) => <li key={oi}>{o}</li>)}
                            </ul>
                            {outcomes.length > OUTCOME_PREVIEW && (
                              <button type="button" className="tos-outcome-more" aria-expanded={open}
                                onClick={() => toggleOutcomes(tp.id)}>
                                {open ? 'Show less' : `+${outcomes.length - OUTCOME_PREVIEW} more`}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input type="number" className="form-control tos-edit-hours" min={0} max={1000} disabled={savingEdit}
                            aria-label="Instructional hours"
                            value={editDraft.instructional_hours}
                            onKeyDown={(e) => onEditKeyDown(e, tp.id)}
                            onChange={(e) => setEditDraft({ ...editDraft, instructional_hours: Number(e.target.value) })} />
                        ) : (
                          <span className="badge badge-amber">{Number(tp.instructional_hours)} hrs</span>
                        )}
                      </td>
                      <td><span className="badge badge-gray">{items}</span></td>
                      <td>
                        <div className="action-icons">
                          {editing ? (
                            <>
                              <button className="action-icon tos-action-save" aria-label="Save changes" title="Save changes"
                                disabled={savingEdit} onClick={() => handleSaveEdit(tp.id)}>
                                {savingEdit ? <span className="btn-spinner" /> : <Check size={15} />}
                              </button>
                              <button className="action-icon" aria-label="Cancel editing" title="Cancel editing"
                                disabled={savingEdit} onClick={cancelEdit}>
                                <X size={15} />
                              </button>
                            </>
                          ) : finalized ? (
                            // Finalized blueprints are locked — show why instead
                            // of two dead buttons.
                            <span className="action-icon is-locked" role="img"
                              title="Finalized — the topic matrix is permanently locked"
                              aria-label="Topics locked — blueprint is finalized">
                              <Lock size={14} />
                            </span>
                          ) : (
                            <>
                              <button className="action-icon" aria-label={`Edit ${tp.title}`} title="Edit topic" onClick={() => startEdit(tp)}>
                                <Pencil size={15} />
                              </button>
                              <button className="action-icon danger is-quiet" aria-label={`Remove ${tp.title}`} title="Remove topic"
                                onClick={() => handleDeleteTopic(tp.id)}>
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!reordering && topics.length > TOPIC_PAGE_SIZE && (
          <div className="dataset-foot">
            <div className="ds-foot-lead">
              <div className="ds-range">
                <b>{topicStart}</b>–<b>{topicEnd}</b> of <b>{topics.length}</b>
              </div>
              <DsPageSize grid={topicGrid} options={[10, 20, 50]} />
            </div>
            {topicGrid.pageCount > 1 && <DsPager grid={topicGrid} />}
          </div>
        )}

        {!finalized && !reordering && <div className="card-body card-body-divider">
          <form onSubmit={handleAddTopic}>
            <div className="inline-form">
              <div className="inline-form-grow">
                <label className="form-label" htmlFor="topic_title">Topic Title <span className="req">*</span></label>
                <input type="text" id="topic_title" className="form-control" required maxLength={255}
                  ref={titleRef}
                  placeholder="e.g. Introduction to Algorithms"
                  value={newTopic.title}
                  onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} />
              </div>
              <div className="inline-form-fixed">
                <label className="form-label" htmlFor="topic_hours">Instructional Hours</label>
                <input type="number" id="topic_hours" className="form-control" min={0} max={1000} value={newTopic.instructional_hours}
                  onChange={(e) => setNewTopic({ ...newTopic, instructional_hours: Number(e.target.value) })} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingTopic}>
                {savingTopic ? <span className="btn-spinner" /> : <Plus size={16} />} Add Topic
              </button>
            </div>
            <div className="tos-add-outcomes">
              <label className="form-label" htmlFor="topic_outcomes">
                Learning Outcomes <span className="text-muted meta-xs">(optional — one per line)</span>
              </label>
              <textarea id="topic_outcomes" className="form-control tos-outcomes-input" rows={2}
                placeholder="e.g. Explain the difference between arrays and linked lists"
                value={newTopic.outcomes}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddTopic(e); }}
                onChange={(e) => setNewTopic({ ...newTopic, outcomes: e.target.value })} />
              <p className="form-hint">Items are derived from instructional hours — add every topic here and the matrix above fills itself.</p>
            </div>
          </form>
        </div>}
      </div>

      {/* Suggested topics — one-click adds from the question bank, sibling
          blueprints, or an AI syllabus scan. Draft blueprints only. */}
      <Modal
        open={suggestOpen}
        title="Suggested topics"
        subtitle="Pulled from your question bank and other blueprints in this subject — add only what belongs in this blueprint."
        onClose={() => setSuggestOpen(false)}
      >
        {suggestions?.hasSyllabus && (
          <button
            type="button"
            className="tos-sugg-syllabus"
            onClick={handleSyllabusFill}
            disabled={fillingSyllabus || syllabusActive}
          >
            {fillingSyllabus || syllabusActive ? <span className="btn-spinner" /> : <FileText size={18} />}
            <span className="tos-sugg-syllabus-text">
              <strong>{syllabusActive ? 'Scanning syllabus…' : 'Auto-fill from syllabus'}</strong>
              <small>AI reads the subject's uploaded syllabus and adds its topics — hours and outcomes included.</small>
            </span>
          </button>
        )}
        {suggestionItems.length === 0 ? (
          <p className="text-muted meta-sm">Nothing left to suggest — every topic found is already in this blueprint.</p>
        ) : (
          <div className="tos-sugg-list">
            {suggestionItems.map((s) => (
              <div key={s.title} className="tos-sugg-row">
                <div className="tos-sugg-main">
                  <span className="tos-sugg-title">{s.title}</span>
                  <span className="tos-sugg-meta">
                    {s.count > 0 && <span className="badge badge-blue">{s.count} question{s.count === 1 ? '' : 's'}</span>}
                    {s.blueprint && <span className="badge badge-gray" title={`Also in blueprint "${s.blueprint}"`}>{s.blueprint}</span>}
                    {Number(s.instructional_hours) > 0 && <span className="tos-sugg-hours">{s.instructional_hours}h</span>}
                  </span>
                </div>
                <button type="button" className="btn btn-primary btn-xs" onClick={() => addSuggested(s)}>
                  <Plus size={13} /> Add
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Derive modal — selected topics become a new draft blueprint */}
      <Modal
        open={deriveOpen}
        title="New blueprint from selected topics"
        subtitle={`Creates a separate draft blueprint with just the ${selTopicCount} topic${selTopicCount === 1 ? '' : 's'} you ticked — e.g. a Prelim or Midterm exam.`}
        onClose={() => !deriving && setDeriveOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDeriveOpen(false)} disabled={deriving}>Cancel</button>
            <button type="submit" form="tos-derive-form" className="btn btn-primary" disabled={deriving || !deriveTitle.trim()}>
              {deriving ? <span className="btn-spinner" /> : <Copy size={14} />} Create blueprint
            </button>
          </>
        }
      >
        <form id="tos-derive-form" onSubmit={handleDerive}>
          <div className="form-group">
            <label className="form-label" htmlFor="derive-title">Blueprint title <span className="req">*</span></label>
            <input
              type="text"
              id="derive-title"
              className="form-control"
              required
              maxLength={255}
              autoFocus
              placeholder='e.g. "Prelim Exam — The Contemporary World"'
              value={deriveTitle}
              onChange={(e) => setDeriveTitle(e.target.value)}
            />
          </div>
          <p className="form-hint">
            The new blueprint keeps this one's subject, item total, and Bloom weights — item counts are re-shared across the selected topics.
          </p>
        </form>
      </Modal>

      {menuEl}
    </AppShell>
  );
}

/** Draggable row inside reorder mode — flat list, no editing affordances. */
function SortableTopicRow({ id, index, title, hours }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`tos-reorder-item${isDragging ? ' is-dragging' : ''}`}
    >
      <button type="button" className="tos-drag-handle" {...attributes} {...listeners} aria-label={`Drag to reorder ${title}`}>
        <GripVertical size={15} />
      </button>
      <span className="tos-reorder-num">{index + 1}</span>
      <span className="cell-primary">{title}</span>
      <span className="tos-reorder-hrs">{Number(hours) || 0} hrs</span>
    </li>
  );
}
