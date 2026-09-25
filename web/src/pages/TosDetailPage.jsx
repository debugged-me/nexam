/**
 * TosDetailPage — TOS builder with topic management.
 *
 * Matches the PHP CodeIgniter design (application/views/tos/view.php):
 * page-header, tos-workflow-callout, stats-grid, Bloom distribution card with
 * bloom-bar-row, topics card with data-table + inline-form.
 *
 * Beyond the PHP view it renders what makes this an actual Table of
 * Specifications: learning outcomes and per-topic item counts on the topics
 * table, and the topic × Bloom-level matrix (item distribution per topic AND
 * cognitive level). Topics are edited in place — no modal, no page change.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, BookOpen, ChevronRight, Sparkles, FileText, Pencil, ListOrdered, Layers, Clock, Check, X, AlertTriangle, Lock } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/tos.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

/** How many learning outcomes a collapsed topic row shows before "+N more". */
const OUTCOME_PREVIEW = 2;

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

  return { rows, colTotals, grand, weights, reconciled: storedSum !== totalItems, storedSum };
}

export default function TosDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [newTopic, setNewTopic] = useState({ title: '', instructional_hours: 0, outcomes: '' });
  const [savingTopic, setSavingTopic] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', instructional_hours: 0, outcomes: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const titleRef = useRef(null);

  const load = useCallback(() => (
    api.get(`/tos/${id}`)
      .then(setData)
      .catch((err) => {
        toast.error(err.message || 'Could not load TOS.');
        navigate('/tos');
      })
  ), [id, toast, navigate]);

  useEffect(() => { load(); }, [load]);

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
    if (!confirm('Remove this topic? This cannot be undone.')) return;
    try {
      await api.del(`/tos/${id}/topics/${topicId}`);
      toast.success('Topic removed.');
      if (editingId === topicId) setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Could not remove topic.');
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await api.post('/ai/generate-questions', { tosId: id });
      toast.success(`Generation queued (job ${result.jobId}). Drafts will appear on the Questions page.`);
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
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not finalize this TOS.');
    } finally {
      setFinalizing(false);
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

  if (!data) return <AppShell activeNav="tos" pageTitle="Blueprint"><p className="placeholder">Loading…</p></AppShell>;
  const { tos, topics } = data;
  const finalized = tos.status === 'finalized';
  const totalHours = topics.reduce((s, t) => s + (Number(t.instructional_hours) || 0), 0);

  return (
    <AppShell activeNav="tos" pageTitle={tos.title}>

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
        <div className="header-actions">
          {!finalized && (
            <button type="button" className="btn btn-outline btn-sm" onClick={handleFinalize} disabled={finalizing}>
              {finalizing ? <span className="btn-spinner" /> : <Lock size={14} />} Finalize TOS
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating || !finalized}
            title="AI drafts questions from your materials based on this blueprint">
            {generating ? <span className="btn-spinner" /> : <Sparkles size={14} />} Auto-generate Questions
          </button>
          <Link to="/exams" className="btn btn-outline btn-sm">
            <FileText size={14} /> Build Exam
          </Link>
          {!finalized && <Link to="/tos" className="btn btn-outline btn-sm"><Pencil size={14} /> Edit</Link>}
        </div>
      </div>

      <div className="tos-workflow-callout">
        <div className="tos-workflow-step">
          <span className="tos-workflow-num">1</span>
          <span className="tos-workflow-text"><strong>Review & Finalize TOS</strong> — Confirm topics, hours, item counts, and Bloom weights before locking the blueprint.</span>
        </div>
        <ChevronRight className="tos-workflow-arrow" />
        <div className="tos-workflow-step">
          <span className="tos-workflow-num">2</span>
          <span className="tos-workflow-text"><strong>Generate & Review</strong> — AI drafts grounded questions; duplicate checking must finish before instructor approval.</span>
        </div>
        <ChevronRight className="tos-workflow-arrow" />
        <div className="tos-workflow-step">
          <span className="tos-workflow-num">3</span>
          <span className="tos-workflow-text"><strong>Build Set A/B</strong> — Uses only approved questions and fills every topic × Bloom allocation exactly.</span>
        </div>
      </div>

      <div className="stats-grid mb-2">
        <div className="stat-card">
          <div className="stat-icon blue"><ListOrdered size={18} /></div>
          <div className="stat-info"><div className="stat-value">{Number(tos.total_items)}</div><div className="stat-label">Total Items</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Layers size={18} /></div>
          <div className="stat-info"><div className="stat-value">{topics.length}</div><div className="stat-label">Topics</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Clock size={18} /></div>
          <div className="stat-info"><div className="stat-value">{totalHours}</div><div className="stat-label">Instructional Hours</div></div>
        </div>
      </div>

      <div className="card mb-2">
        <div className="card-header">
          <span className="card-title">Bloom's Taxonomy Distribution</span>
        </div>
        <div className="card-body">
          {BLOOM_ORDER.map((k) => {
            const pct = Number(tos.bloom_weights?.[k]) || 0;
            const itemCount = Math.round((pct / 100) * Number(tos.total_items));
            return (
              <div key={k} className="bloom-bar-row">
                <div className="bloom-bar-label">{BLOOM_LABELS[k]}</div>
                <div className="bloom-bar-track">
                  <div className="bloom-bar-fill" style={{ width: `${pct}%` }} />
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
        <div className="card mb-2">
          <div className="card-header">
            <div>
              <span className="card-title">Specification Matrix</span>
              <p className="card-sub">Items per topic and cognitive level — each row totals that topic's items, each column follows the blueprint's Bloom weight.</p>
            </div>
            {matrix.reconciled ? (
              <span className="tos-matrix-drift" title={`Stored per-topic counts total ${matrix.storedSum}, blueprint total is ${Number(tos.total_items)}.`}>
                <AlertTriangle size={13} aria-hidden="true" /> Item counts re-derived from hours
              </span>
            ) : (
              <span className="text-muted meta-sm">{matrix.grand} of {Number(tos.total_items)} items placed</span>
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
                    {cells.map((n, c) => (
                      <td key={BLOOM_ORDER[c]} className={`tos-matrix-num${n === 0 ? ' is-zero' : ''}`}>{n}</td>
                    ))}
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
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Topics</span>
          <span className="text-muted meta-sm">{topics.length} topic{topics.length === 1 ? '' : 's'}</span>
        </div>
        {topics.length === 0 ? (
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
                  <th scope="col" className="col-num">#</th>
                  <th scope="col">Topic</th>
                  <th scope="col" className="col-outcomes">Learning Outcomes</th>
                  <th scope="col" className="col-medium">Instructional Hours</th>
                  <th scope="col" className="col-items">Items</th>
                  <th scope="col" className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((tp, i) => {
                  const editing = editingId === tp.id;
                  const outcomes = parseOutcomes(tp.learning_outcomes);
                  const open = expanded.has(tp.id);
                  const shown = open ? outcomes : outcomes.slice(0, OUTCOME_PREVIEW);
                  const items = matrix?.rows[i]?.items ?? (Number(tp.item_count) || 0);

                  return (
                    <tr key={tp.id} className={editing ? 'tos-row-editing' : undefined}>
                      <td className="text-muted">{i + 1}</td>
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
                              <button className="action-icon tos-action-save" aria-label="Save changes"
                                disabled={savingEdit} onClick={() => handleSaveEdit(tp.id)}>
                                {savingEdit ? <span className="btn-spinner" /> : <Check size={15} />}
                              </button>
                              <button className="action-icon" aria-label="Cancel editing"
                                disabled={savingEdit} onClick={cancelEdit}>
                                <X size={15} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="action-icon" aria-label={`Edit ${tp.title}`} onClick={() => startEdit(tp)} disabled={finalized}>
                                <Pencil size={15} />
                              </button>
                              <button className="action-icon danger is-quiet" aria-label={`Remove ${tp.title}`}
                                onClick={() => handleDeleteTopic(tp.id)} disabled={finalized}>
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

        {!finalized && <div className="card-body card-body-divider">
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

    </AppShell>
  );
}
