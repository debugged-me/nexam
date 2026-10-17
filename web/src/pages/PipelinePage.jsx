/**
 * PipelinePage — "How AI works": a live console for processing tasks.
 *
 * An SVG flow graph whose edges flow while a task is active and whose nodes
 * light up stage by stage, particles traveling to the outcome nodes as
 * questions land, a KPI band, and a one-line caption of what it's doing.
 *
 * Real-time comes from the existing SSE stream (useJobStream) — every
 * `progress` event moves the counters, every `drafts` event spawns a
 * particle DRAFT → CONSTRAINTS → BLIND CHECK → DRAFTED.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, History, Maximize2, Square, Workflow, AlertTriangle } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Filler, Tooltip,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import AppShell from '../components/AppShell.jsx';
import Modal from '../components/Modal.jsx';
import Select from '../components/Select.jsx';
import { useToast } from '../components/Toast.jsx';
import useJobs, { cancelJob, isActiveJob } from '../lib/useJobs.js';
import useJobStream from '../lib/useJobStream.js';
import api from '../lib/api.js';
import { generationSummary, jobJson, selectPipelineJob, syllabusTopicGroups, draftTimeline } from '../lib/pipelineRun.js';
import { BLOOM_LABELS, BLOOM_ORDER } from '../lib/insights.js';
import '../styles/pipeline.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Filler, Tooltip);

/** Resolve a design token so charts follow the active theme + accent. */
const cssVar = (name, fallback) =>
  (typeof window !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

const LABELS = { extract: 'Read material', syllabus_tos: 'Draft blueprint', embed: 'Index passages', generate: 'Generate questions', similarity: 'Check duplicates', lexicon: 'Prepare terminology' };
const STATES = { queued: 'Queued', running: 'Running', done: 'Finished', failed: 'Failed', cancelled: 'Stopped' };
const JOB_LABELS = { generate: 'generate', syllabus_tos: 'blueprint', embed: 'index', extract: 'extract', similarity: 'similarity', lexicon: 'lexicon' };
const MATERIAL_TYPES = ['extract', 'syllabus_tos', 'embed'];
const context = (job) => job?.tos_title || job?.material_title || job?.subject_name || 'Task';
const date = (value) => value ? new Date(value).toLocaleString() : '—';

/* ── Flow graph geometry ──────────────────────────────────────── */
const NW = 120; // node width
const QUESTION_NODES = {
  blueprint: { x: 90,  y: 76,  label: 'BLUEPRINT',   sub: 'your TOS matrix' },
  bank:      { x: 90,  y: 244, label: 'BANK',        sub: 'approved questions' },
  retrieve:  { x: 260, y: 160, label: 'RETRIEVE',    sub: 'reads your lessons' },
  draft:     { x: 424, y: 160, label: 'DRAFT',       sub: 'writes questions' },
  review:    { x: 588, y: 160, label: 'CONSTRAINTS', sub: 'source · format · Bloom' },
  decide:    { x: 736, y: 160, label: 'BLIND CHECK', sub: 'independent solver' },
  saved:     { x: 888, y: 60,  label: 'DRAFTED',     sub: 'for your review' },
  held:      { x: 888, y: 132, label: 'SHORTFALL',   sub: 'not enough proof' },
  covered:   { x: 888, y: 204, label: 'COVERED',     sub: 'already covered' },
  reused:    { x: 888, y: 276, label: 'REUSED',      sub: 'from your bank' },
};
const QUESTION_EDGES = [
  ['blueprint', 'retrieve'], ['retrieve', 'draft'], ['draft', 'review'],
  ['review', 'decide'], ['decide', 'saved'], ['decide', 'held'],
  ['bank', 'covered'], ['bank', 'reused'],
];
const MATERIAL_NODES = {
  file:         { x: 90,  y: 160, label: 'MATERIAL',   sub: 'your uploaded file' },
  extract:      { x: 270, y: 160, label: 'READ',       sub: 'extract the text' },
  syllabus_tos: { x: 470, y: 76,  label: 'BLUEPRINT',  sub: 'topics & periods' },
  embed:        { x: 470, y: 244, label: 'INDEX',      sub: 'source passages' },
  plan:         { x: 680, y: 76,  label: 'DRAFT PLAN', sub: 'instructor reviews' },
  source:       { x: 680, y: 244, label: 'SOURCES',    sub: 'lessons for answers' },
  questions:    { x: 888, y: 160, label: 'QUESTIONS',  sub: 'separate next step' },
};
const MATERIAL_EDGES = [
  ['file', 'extract'], ['extract', 'syllabus_tos'], ['extract', 'embed'],
  ['syllabus_tos', 'plan'], ['embed', 'source'], ['plan', 'questions'], ['source', 'questions'],
];
const OUTCOME_W = 116; // outcome nodes are slightly narrower
const QUESTION_OUTCOMES = new Set(['saved', 'reused', 'covered', 'held']);
const MATERIAL_OUTCOMES = new Set(['plan', 'source', 'questions']);
// Edges that stay lit for the whole run — the writing channel.
const LIVE_EDGES = new Set(['blueprint|retrieve', 'retrieve|draft', 'draft|review', 'review|decide']);

/** Sankey-style smooth stream: horizontal tangents both ends so the band
 *  reads as a flowing channel, not a wire. */
const rightX = (nodes, k) => nodes[k].x + ((QUESTION_OUTCOMES.has(k) || MATERIAL_OUTCOMES.has(k)) ? OUTCOME_W : NW) / 2;
const leftX = (nodes, k) => nodes[k].x - ((QUESTION_OUTCOMES.has(k) || MATERIAL_OUTCOMES.has(k)) ? OUTCOME_W : NW) / 2;
function seg(nodes, a, b) {
  const ax = rightX(nodes, a); const ay = nodes[a].y;
  const bx = leftX(nodes, b); const by = nodes[b].y;
  const dx = Math.max(30, Math.abs(bx - ax) * 0.5);
  return `C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}`;
}
function chain(nodes, keys) {
  let d = `M ${rightX(nodes, keys[0])} ${nodes[keys[0]].y}`;
  for (let i = 1; i < keys.length; i += 1) d += ` ${seg(nodes, keys[i - 1], keys[i])}`;
  return d;
}
// Edge path each outcome flashes as its particle travels it.
const JOURNEYS = {
  draft: { path: chain(QUESTION_NODES, ['draft', 'review', 'decide', 'saved']), edges: ['draft|review', 'review|decide', 'decide|saved'], tone: 'blue' },
  adopt: { path: chain(QUESTION_NODES, ['bank', 'reused']), edges: ['bank|reused'], tone: 'green' },
  skip: { path: chain(QUESTION_NODES, ['bank', 'covered']), edges: ['bank|covered'], tone: 'slate' },
  refuse: { path: chain(QUESTION_NODES, ['decide', 'held']), edges: ['decide|held'], tone: 'rose' },
};

const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const clip = (s, n = 64) => (String(s || '').length > n ? `${String(s).slice(0, n)}…` : String(s || ''));
const counted = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

export default function PipelinePage() {
  const { jobs, loaded, refresh } = useJobs({ activeInterval: 3000, idleInterval: 10000 });
  const [params, setParams] = useSearchParams();
  const pickedId = params.get('job');
  const recentJob = selectPipelineJob(jobs, pickedId);
  const [olderTask, setOlderTask] = useState(null);
  useEffect(() => {
    if (!pickedId || recentJob || !loaded) return undefined;
    let alive = true;
    api.get('/ai/jobs/' + encodeURIComponent(pickedId)).then(({ job }) => {
      if (alive) setOlderTask({ id: pickedId, job });
    }).catch((error) => {
      if (alive) setOlderTask({ id: pickedId, error: error.message });
    });
    return () => { alive = false; };
  }, [pickedId, recentJob, loaded]);
  const job = recentJob || (olderTask?.id === pickedId ? olderTask.job : null);
  const feed = useJobStream(job?.id);
  const status = feed.status || job?.status;
  const running = ['queued', 'running'].includes(status);
  const result = feed.result || jobJson(job?.result);
  const payload = jobJson(job?.payload);
  const progress = feed.progress || jobJson(job?.progress);
  const error = feed.error || job?.error;
  const stats = generationSummary(job, feed);
  const drafts = feed.drafts;
  const material = MATERIAL_TYPES.includes(job?.type);
  const generation = job?.type === 'generate';
  const tosId = result.tosId || payload.tosId;
  const related = jobs.filter((j) => payload.materialId && jobJson(j.payload).materialId === payload.materialId);
  const toast = useToast();

  /* ── Scanned blueprint — a scan's topics, periods and planned item mix,
   * charted like a run's stats instead of listed as text. A read or index
   * task still finds the scan through the jobs that share its material. ── */
  const scanTosId = material
    ? tosId || related.map((task) => jobJson(task.result)?.tosId).find(Boolean) || null
    : null;
  const [blueprint, setBlueprint] = useState(null);
  useEffect(() => {
    if (!scanTosId) return undefined;
    let alive = true;
    api.get('/tos/' + scanTosId).then((data) => {
      if (alive) setBlueprint({ id: scanTosId, data });
    }).catch(() => {
      if (alive) setBlueprint({ id: scanTosId, error: true });
    });
    return () => { alive = false; };
  }, [scanTosId]);
  const blueprintData = scanTosId && blueprint?.id === scanTosId && !blueprint.error ? blueprint.data : null;
  const [stopping, setStopping] = useState(false);

  // Other in-flight work as ambient activity, grouped so eight similarity
  // checks read as "similarity ×8".
  const others = jobs.filter((j) => isActiveJob(j) && j.id !== job?.id)
    .reduce((acc, j) => {
      const label = JOB_LABELS[j.type] || j.type;
      const found = acc.find((a) => a.label === label);
      if (found) found.n += 1; else acc.push({ label, n: 1 });
      return acc;
    }, []);

  /* ── Elapsed clock ── */
  const startedAt = job?.started_at || job?.created_at;
  const finishedAt = job?.finished_at;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const elapsedMs = startedAt ? Math.max(0, new Date(finishedAt || now) - new Date(startedAt)) : null;
  const elapsed = elapsedMs !== null ? fmtClock(elapsedMs) : '—';
  const rate = generation && stats.drafted && startedAt ? (stats.drafted / Math.max(1, elapsedMs / 60000)).toFixed(1) : null;

  /* ── Particle bursts + edge pulses as outcomes land ── */
  const [bursts, setBursts] = useState([]);
  const [pulses, setPulses] = useState({}); // edgeKey -> tone
  const prev = useRef({ adopted: 0, skipped: 0, drafted: 0, refused: 0, jobId: null });
  const burstSeq = useRef(0);

  const spawn = (journey, color, n = 1, tone = journey.tone) => {
    const items = Array.from({ length: n }, (_, i) => ({ id: ++burstSeq.current, path: journey.path, color, delay: i * 0.18 }));
    setBursts((b) => [...b, ...items]);
    setTimeout(() => setBursts((b) => b.filter((p) => !items.some((it) => it.id === p.id))), 2600);
    // Light this journey's edges in the same color while the particle rides them.
    setPulses((h) => { const next = { ...h }; journey.edges.forEach((k) => { next[k] = tone; }); return next; });
    setTimeout(() => setPulses((h) => {
      const next = { ...h };
      journey.edges.forEach((k) => { if (next[k] === tone) delete next[k]; });
      return next;
    }), 2400);
  };

  // Reset when the watched task changes.
  useEffect(() => {
    if (prev.current.jobId === job?.id) return;
    prev.current = { adopted: 0, skipped: 0, drafted: 0, refused: 0, jobId: job?.id };
    setBursts([]);
    setPulses({});
  }, [job?.id]);

  useEffect(() => {
    const p = prev.current;
    if (!p.jobId || !generation) return;
    const ad = stats.adopted;
    if (ad > p.adopted) spawn(JOURNEYS.adopt, 'var(--green-600)', ad - p.adopted);
    const sk = stats.coveredCells;
    if (sk > p.skipped) spawn(JOURNEYS.skip, 'var(--ink-faint)', sk - p.skipped);
    if (stats.failedSlots.length > p.refused) {
      spawn(JOURNEYS.refuse, 'var(--red-600)', Math.min(6, stats.failedSlots.length - p.refused));
    }
    p.adopted = ad; p.skipped = sk; p.refused = stats.failedSlots.length;
  }, [feed, generation, stats]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draft events → a particle per stored question.
  useEffect(() => {
    const p = prev.current;
    if (!p.jobId || !generation) return;
    if (drafts.length > p.drafted) {
      const fresh = drafts.slice(p.drafted);
      fresh.forEach((d, i) => {
        const knowledge = d.grounding === 'knowledge';
        setTimeout(() => spawn(JOURNEYS.draft, knowledge ? 'var(--amber-600)' : 'var(--accent)', 1, knowledge ? 'amber' : 'blue'), i * 120);
      });
      p.drafted = drafts.length;
    }
  }, [drafts, generation]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateLabel = running ? (status === 'queued' ? 'QUEUED' : 'LIVE') : (status || 'idle').toUpperCase();
  const nowSlot = generation && status === 'running' ? progress?.lastSlot : null;
  const latestDraft = drafts.length ? drafts[drafts.length - 1] : null;

  /* ── Expanded pipeline graph (modal) ── */
  const [graphOpen, setGraphOpen] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const graphMaterial = material && !showQuestions;

  /* ── Which of this run's drafts are still in the review queue?
   * The stream replays stored drafts, so the list keeps its content after
   * review — a light poll of the draft list marks the decided ones. */
  const [pendingIds, setPendingIds] = useState(null);
  useEffect(() => {
    if (!generation || !drafts.length) return undefined;
    let alive = true;
    const load = () => api
      .get(`/questions?status=draft${tosId ? `&tos_id=${encodeURIComponent(tosId)}` : ''}`)
      .then((r) => { if (alive) setPendingIds(new Set((r.questions || []).map((q) => q.id))); })
      .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [generation, drafts.length, tosId]);
  const pendingCount = pendingIds ? drafts.filter((d) => pendingIds.has(d.id)).length : null;

  /* ── Theme-aware chart palette ── */
  const pal = {
    accent: cssVar('--accent', '#2383E2'), green: cssVar('--green-600', '#23A265'),
    amber: cssVar('--amber-600', '#B07D1E'), red: cssVar('--red-600', '#DC4445'),
    faint: cssVar('--ink-faint', '#959BA3'), grid: cssVar('--line', '#E8EBEF'),
    s3: cssVar('--surface-3', '#EDF0F4'), ink2: cssVar('--ink-2', '#4E545B'),
    teal: cssVar('--teal-600', '#0E9488'), purple: cssVar('--purple-600', '#7C5CD6'),
  };
  const chartTip = {
    backgroundColor: pal.ink2, titleFont: { weight: '700' }, bodyFont: { weight: '500' },
    padding: 10, cornerRadius: 8, displayColors: false,
  };

  /* ── Outcome mix (donut) — questions and cells labelled separately. ── */
  const outcomeData = {
    labels: ['Drafted questions', 'Reused questions', 'Covered cells', 'Missing questions'],
    datasets: [{
      data: [stats.drafted, stats.adopted, stats.coveredCells, stats.missingQuestions],
      backgroundColor: [pal.accent, pal.green, pal.faint, pal.red],
      borderWidth: 2, borderColor: cssVar('--surface', '#fff'),
    }],
  };
  const outcomeTotal = stats.drafted + stats.adopted + stats.coveredCells + stats.missingQuestions;

  /* ── Drafts by Bloom level (bars) ── */
  const bloomData = {
    labels: BLOOM_ORDER.map((k) => BLOOM_LABELS[k]),
    datasets: [{
      data: BLOOM_ORDER.map((k) => drafts.filter((d) => d.bloom === k).length),
      backgroundColor: pal.accent, borderRadius: 4, barPercentage: 0.7,
    }],
  };

  /* ── Writing pace — server timestamps only, never browser arrival time
   * (a historical replay is not writing activity). ── */
  const timeline = useMemo(() => draftTimeline(drafts, job?.started_at), [drafts, job?.started_at]);
  const paceData = {
    labels: timeline.points.map((point) => fmtClock(point.seconds * 1000)),
    datasets: [{
      data: timeline.points.map((point) => point.count), borderColor: pal.accent, fill: true, tension: 0.35,
      backgroundColor: 'rgba(35,131,226,.10)', pointRadius: 3, pointBackgroundColor: pal.accent,
    }],
  };

  /* ── Scanned blueprint, charted like a run's stats: planned items per
   * Bloom level (exact matrix when the server computed one, else the
   * blueprint's stated weights), plus topics and hours per period group. ── */
  const bpTopics = blueprintData?.topics || [];
  const bpGroups = syllabusTopicGroups(bpTopics);
  const bpTotalItems = Number(blueprintData?.tos?.total_items) || 0;
  const bpItems = BLOOM_ORDER.map((bloom, i) => {
    const planned = bpTopics.reduce((sum, t) => sum + (Number(blueprintData?.plan?.[t.id]?.[i]) || 0), 0);
    if (planned) return planned;
    return Math.round(((Number(blueprintData?.tos?.bloom_weights?.[bloom]) || 0) / 100) * bpTotalItems);
  });
  const bpItemsTotal = bpItems.reduce((a, b) => a + b, 0);
  const bpColors = [pal.accent, pal.green, pal.amber, pal.teal, pal.purple, pal.red];
  const bpMixData = {
    labels: BLOOM_ORDER.map((k) => BLOOM_LABELS[k]),
    datasets: [{ data: bpItems, backgroundColor: bpColors, borderWidth: 2, borderColor: cssVar('--surface', '#fff') }],
  };
  const bpTopicsData = {
    labels: bpGroups.map((g) => g.label),
    datasets: [{ data: bpGroups.map((g) => g.topics.length), backgroundColor: pal.accent, borderRadius: 4, barPercentage: 0.7 }],
  };
  const bpHoursData = {
    labels: bpGroups.map((g) => g.label),
    datasets: [{
      data: bpGroups.map((g) => g.topics.reduce((s, t) => s + (Number(t.instructional_hours) || 0), 0)),
      backgroundColor: pal.green, borderRadius: 4, barPercentage: 0.7,
    }],
  };

  /* ── Material chain — stage durations for tasks that never scanned a
   * blueprint (plain reads and indexes). ── */
  const taskSecs = (t) => (t.started_at && t.finished_at ? Math.max(0, (new Date(t.finished_at) - new Date(t.started_at)) / 1000) : null);
  const chainJobs = related.filter((t) => MATERIAL_TYPES.includes(t.type))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const timedChain = chainJobs.filter((t) => taskSecs(t) !== null);
  const chainData = {
    labels: timedChain.map((t) => LABELS[t.type] || t.type),
    datasets: [{ data: timedChain.map((t) => Math.round(taskSecs(t))), backgroundColor: pal.accent, borderRadius: 4, barPercentage: 0.7 }],
  };
  const barOpts = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: chartTip },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: pal.faint, font: { size: 9 } } },
      y: { grid: { color: pal.grid }, border: { display: false }, ticks: { color: pal.faint, font: { size: 9 }, precision: 0 } },
    },
  };

  /* ── The flow graph — rendered in the deck panel and, expanded, inside
   * the modal so it can be studied near-fullscreen. Same SVG both places. */
  const nodes = graphMaterial ? MATERIAL_NODES : QUESTION_NODES;
  const edges = graphMaterial ? MATERIAL_EDGES : QUESTION_EDGES;
  const stages = Object.fromEntries(related.map((task) => [task.type, task.status]).reverse());
  if (graphMaterial && job) stages[job.type] = status;
  const outcomes = { saved: stats.drafted, held: stats.missingQuestions, covered: stats.coveredCells, reused: stats.adopted };
  const graphTitle = graphMaterial ? 'Material flow' : 'Question flow';
  const flowGraph = (
    <svg className="pc-graph" viewBox="0 0 960 320" role="img" data-tour="pipe-graph"
      aria-label={graphMaterial
        ? 'Material processing pipeline: the file is read, then blueprint drafting and passage indexing run separately toward reviewed questions'
        : 'Question generation pipeline: blueprint and bank feed retrieve, draft, constraints, blind check, then drafted, shortfall, covered, or reused'}>
      <defs>
        <filter id="pc-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {edges.map(([a, b]) => {
        const key = `${a}|${b}`;
        const live = graphMaterial ? stages[b] === 'running' : running && LIVE_EDGES.has(key);
        const pulse = graphMaterial ? undefined : pulses[key];
        const tone = !graphMaterial && generation && outcomes[b] > 0 ? { saved: 'blue', reused: 'green', covered: 'slate', held: 'rose' }[b] : undefined;
        const d = `M ${rightX(nodes, a)} ${nodes[a].y} ${seg(nodes, a, b)}`;
        return (
          <g key={key}>
            <path className="pc-band" data-live={live || undefined} data-pulse={pulse || undefined} data-tone={tone} d={d} />
            <path className="pc-edge" data-live={live || undefined} data-pulse={pulse || undefined} data-tone={tone} d={d} />
          </g>
        );
      })}
      {/* Steady stream of dots along the working channel while live. */}
      {running && !graphMaterial && [...LIVE_EDGES].map((key) => {
        const [a, b] = key.split('|');
        const d = `M ${rightX(nodes, a)} ${nodes[a].y} ${seg(nodes, a, b)}`;
        return [0, 1, 2].map((i) => (
          <circle key={`${key}-${i}`} r="2.2" className="pc-stream">
            <animateMotion dur="1.5s" begin={`${i * 0.5}s`} repeatCount="indefinite" path={d} />
          </circle>
        ));
      })}
      {!graphMaterial && bursts.map((p) => (
        <circle key={p.id} r="3.6" style={{ fill: p.color }} filter="url(#pc-glow)">
          <animateMotion dur="1.7s" begin={`${p.delay}s`} path={p.path} fill="freeze" />
        </circle>
      ))}
      {Object.entries(nodes).map(([key, n]) => {
        const w = (QUESTION_OUTCOMES.has(key) || MATERIAL_OUTCOMES.has(key)) ? OUTCOME_W : NW;
        const count = !graphMaterial ? outcomes[key] : undefined;
        const stage = graphMaterial ? stages[key] : null;
        const hot = graphMaterial ? stage === 'running'
          : running && (key === 'retrieve' || key === 'draft' || key === 'review' || key === 'decide');
        const sub = graphMaterial ? (STATES[stage] || n.sub)
          : count !== undefined ? `${count} · ${n.sub}` : n.sub;
        return (
          <g key={key} className="pc-node" data-hot={hot ? 'true' : undefined} data-state={stage || undefined}
            data-count={(count ?? 0) > 0 ? 'true' : undefined}>
            <rect x={n.x - w / 2} y={n.y - 21} width={w} height="42" rx="10" />
            <text className="pc-node-label" x={n.x} y={n.y - 3} textAnchor="middle">{n.label}</text>
            <text className="pc-node-sub" x={n.x} y={n.y + 11} textAnchor="middle">{sub}</text>
          </g>
        );
      })}
    </svg>
  );

  async function stop() {
    setStopping(true);
    try { await cancelJob(job.id); await refresh(); toast.info('Stop requested. Finished work is kept.'); }
    catch (err) { toast.error(err.message); }
    finally { setStopping(false); }
  }

  const cols = graphMaterial ? ['File', 'Processing', 'Next steps'] : ['Inputs', 'Writing & checks', 'Outcomes'];
  const graphPanel = (
    <div className="pc-panel pc-panel--flow">
      <header className="pc-panel-head pc-panel-head--row">
        <div>
          <h3>{material ? 'Task pipeline' : 'Generation pipeline'}</h3>
          <p>{graphMaterial
            ? 'The file is read, then blueprint drafting and indexing run separately.'
            : 'Every question follows the same path — watch it move.'}</p>
        </div>
        <div className="pc-flow-actions">
          {material && <div className="pc-view-switch" role="group" aria-label="Pipeline view">
            <button aria-pressed={!showQuestions} onClick={() => setShowQuestions(false)}>Material</button>
            <button aria-pressed={showQuestions} onClick={() => setShowQuestions(true)}>Questions</button>
          </div>}
          <button type="button" className="pc-fs" onClick={() => setGraphOpen(true)} title="Expand" aria-label="View pipeline larger">
            <Maximize2 size={13} />
          </button>
        </div>
      </header>
      <div className="pc-cols" aria-hidden="true">{cols.map((c) => <span key={c}>{c}</span>)}</div>
      <div className="pc-graph-scroll">{flowGraph}</div>
      <p className="pc-scroll-hint">Scroll sideways to explore the full map.</p>
    </div>
  );

  const doneSummary = () => {
    if (generation) {
      if (!stats.drafted) return 'This run saved no new questions — check the reuse and coverage counts.';
      return pendingCount === 0
        ? `Done — all ${stats.drafted} draft${stats.drafted === 1 ? '' : 's'} reviewed.`
        : `Done — ${pendingCount ?? stats.drafted} new question${(pendingCount ?? stats.drafted) === 1 ? ' is' : 's are'} waiting for your review.`;
    }
    if (job?.type === 'extract') return `Done — ${Number(result.charCount || 0).toLocaleString()} characters extracted.`;
    if (job?.type === 'syllabus_tos') return result.topicCount != null ? `Done — ${counted(result.topicCount, 'topic')} in this scan.` : 'Done — the blueprint draft is ready for review.';
    if (job?.type === 'embed') return result.chunkCount != null ? `Done — ${counted(result.chunkCount, 'passage')} indexed for retrieval.` : 'Done — source passages are indexed.';
    return `Done — ${LABELS[job?.type] || 'task'} finished.`;
  };
  const doneAction = () => {
    if (generation) return pendingCount === 0
      ? <Link to="/questions" className="btn btn-primary btn-sm">Open question bank <ArrowRight size={14} /></Link>
      : <Link to={'/questions/review' + (job.subject_id ? '?subject_id=' + encodeURIComponent(job.subject_id) : '')} className="btn btn-primary btn-sm">Review them <ArrowRight size={14} /></Link>;
    if (job?.type === 'syllabus_tos' && tosId) return <Link to={'/tos/' + tosId} className="btn btn-primary btn-sm">Review blueprint <ArrowRight size={14} /></Link>;
    if (job?.type === 'extract' && result.tosJobId) return <button className="btn btn-primary btn-sm" onClick={() => setParams({ job: result.tosJobId })}>View blueprint scan <ArrowRight size={14} /></button>;
    return null;
  };

  return (
    <AppShell pageClass="pipeline" activeNav="pipeline" pageTitle="How AI works" wide>
      <section className="pc-deck" data-live={running ? 'true' : undefined} aria-label="Processing console" data-tour="pipe-result">
        <header className="pc-top">
          <span className={`pc-status pc-status--${running ? 'live' : 'idle'}`} data-state={status || 'idle'}>
            <i />{stateLabel}
          </span>
          <div className="pc-heading">
            <strong>{job ? (LABELS[job.type] || job.type) : 'Waiting for a task'}</strong>
            <span>{job ? `${context(job)} · ${date(job.created_at)}` : '—'}</span>
          </div>
          {others.map((o) => (
            <span key={o.label} className="pc-ambient">{o.label}{o.n > 1 ? ` ×${o.n}` : ''}</span>
          ))}
          <span className="pc-top-actions" data-tour="pipe-controls">
            {feed.connected === false && running && <span className="pc-conn" data-off="true">reconnecting…</span>}
            {jobs.length > 0 && (
              <Select
                value={job?.id || ''}
                onChange={(id) => setParams({ job: id })}
                label="Watch a different task"
                icon={History}
                searchable
                searchPlaceholder="Search tasks…"
                options={(job && !jobs.some((item) => item.id === job.id) ? [job, ...jobs] : jobs).map((item) => ({
                  value: item.id,
                  label: `${LABELS[item.type] || item.type} · ${item.subject_code || context(item)} · ${date(item.created_at)} · ${STATES[item.status] || item.status}`,
                }))}
              />
            )}
            {running && (
              <button type="button" className="pc-stop" onClick={stop} disabled={stopping}>
                <Square size={11} /> Stop
              </button>
            )}
          </span>
        </header>

        {/* ── KPI band ── */}
        <div className="pc-kpis" data-tour="pipe-kpis">
          {generation ? <>
            <div className="pc-kpi" data-tone="blue"><b>{stats.drafted}</b><span>drafted</span></div>
            <div className="pc-kpi" data-tone="green"><b>{stats.adopted}</b><span>reused</span></div>
            <div className="pc-kpi" data-tone="slate"><b>{stats.coveredCells}</b><span>covered</span></div>
            <div className="pc-kpi" data-tone="rose"><b>{stats.missingQuestions}</b><span>questions missing · {stats.failedSlots.length} cells</span></div>
            <div className="pc-kpi pc-kpi--wide">
              <b>{stats.doneCells ?? '—'}<em>/{stats.totalCells ?? '—'}</em></b><span>blueprint cells</span>
              <i className="pc-kpi-bar"><i style={{ width: stats.totalCells ? `${(stats.doneCells || 0) / stats.totalCells * 100}%` : (running ? '30%' : '0%') }} /></i>
            </div>
            <div className="pc-kpi"><b>{elapsed}</b><span>elapsed</span></div>
            {rate && <div className="pc-kpi"><b>{rate}</b><span>per minute</span></div>}
          </> : <>
            <div className="pc-kpi" data-tone="blue"><b>{
              job?.type === 'extract' ? Number(result.charCount || 0).toLocaleString()
              : job?.type === 'syllabus_tos' ? (result.topicCount ?? '—')
              : job?.type === 'embed' ? (result.chunkCount ?? '—')
              : (STATES[status] || '—')
            }</b><span>{
              job?.type === 'extract' ? 'characters read'
              : job?.type === 'syllabus_tos' ? 'topics in scan'
              : job?.type === 'embed' ? 'passages indexed'
              : 'status'
            }</span></div>
            <div className="pc-kpi"><b>{elapsed}</b><span>elapsed</span></div>
          </>}
        </div>

        {/* ── Flow graph + outcome panel ── */}
        <div className="pc-main">
          {graphPanel}
          {generation ? (
            <div className="pc-panel pc-panel--mix">
              <header className="pc-panel-head">
                <h3>Outcome mix</h3>
                <p>Where this run's questions and cells ended up.</p>
              </header>
              <div className="pc-mix">
                <div className="pc-donut">
                  <Doughnut
                    data={outcomeData}
                    options={{ cutout: '68%', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: chartTip } }}
                  />
                  <div className="pc-donut-center"><b>{outcomeTotal}</b><span>outcomes</span></div>
                </div>
                <ul className="pc-legend">
                  {[['Drafted', stats.drafted, pal.accent], ['Reused', stats.adopted, pal.green],
                    ['Covered cells', stats.coveredCells, pal.faint], ['Missing questions', stats.missingQuestions, pal.red]].map(([label, n, c]) => (
                    <li key={label}>
                      <i style={{ background: c }} />
                      <span>{label}</span>
                      <b>{outcomeTotal ? Math.round((n / outcomeTotal) * 100) : 0}%</b>
                      <em>{n}</em>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : bpTopics.length ? (
            <div className="pc-panel pc-panel--mix">
              <header className="pc-panel-head">
                <h3>Planned item mix</h3>
                <p>The Bloom split this blueprint plans.</p>
              </header>
              <div className="pc-mix">
                <div className="pc-donut">
                  <Doughnut
                    data={bpMixData}
                    options={{ cutout: '68%', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: chartTip } }}
                  />
                  <div className="pc-donut-center"><b>{bpItemsTotal}</b><span>items</span></div>
                </div>
                <ul className="pc-legend">
                  {BLOOM_ORDER.map((k, i) => (
                    <li key={k}>
                      <i style={{ background: bpColors[i] }} />
                      <span>{BLOOM_LABELS[k]}</span>
                      <b>{bpItemsTotal ? Math.round((bpItems[i] / bpItemsTotal) * 100) : 0}%</b>
                      <em>{bpItems[i]}</em>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="pc-panel pc-panel--mix">
              <header className="pc-panel-head">
                <h3>Recorded result</h3>
                <p>{graphMaterial ? 'Latest state of this task.' : 'Select a task to inspect it.'}</p>
              </header>
              <div className="pc-run-result">
                <Workflow size={28} />
                <strong>{STATES[status] || 'No task selected'}</strong>
                {status === 'done' && job?.type === 'syllabus_tos' && <><b>{result.topicCount ?? '—'}</b><span>topics in this scan</span></>}
                {status === 'done' && job?.type === 'extract' && <><b>{Number(result.charCount || 0).toLocaleString()}</b><span>characters read</span></>}
                {status === 'done' && job?.type === 'embed' && <><b>{result.chunkCount ?? '—'}</b><span>passages indexed</span></>}
              </div>
            </div>
          )}
        </div>

        {/* ── Breakdown panels ── */}
        {generation && (
          <div className="pc-row" data-tour="pipe-stats">
            <div className="pc-panel">
              <header className="pc-panel-head">
                <h3>Drafts by cognitive level</h3>
                <p>Bloom spread of questions written so far.</p>
              </header>
              <div className="pc-chart">
                <Bar
                  data={bloomData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: chartTip },
                    scales: {
                      x: { grid: { display: false }, border: { display: false }, ticks: { color: pal.faint, font: { size: 9 } } },
                      y: { grid: { color: pal.grid }, border: { display: false }, ticks: { color: pal.faint, font: { size: 9 }, precision: 0 } },
                    },
                  }}
                />
              </div>
            </div>
            <div className="pc-panel">
              <header className="pc-panel-head">
                <h3>Writing pace</h3>
                <p>{timeline.untimed > 0 ? `${timeline.untimed} drafts have no recorded timestamp and are not plotted.` : 'Drafts landing over the run.'}</p>
              </header>
              <div className="pc-chart">
                {timeline.timed > 0 ? (
                  <Line
                    data={paceData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: chartTip },
                      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: pal.faint, font: { size: 9 } } }, y: { grid: { color: pal.grid }, border: { display: false }, ticks: { color: pal.faint, font: { size: 9 }, precision: 0 } } },
                    }}
                  />
                ) : <div className="pc-chart-empty">{drafts.length ? 'Saved timestamps are not available for these drafts yet.' : 'No saved questions to plot.'}</div>}
              </div>
            </div>
            <div className="pc-panel">
              <header className="pc-panel-head">
                <h3>Latest questions</h3>
                <p>
                  {running
                    ? 'Newest drafts — all awaiting your review.'
                    : pendingCount === null ? 'Newest drafts from this run.'
                    : pendingCount === 0 ? 'Newest drafts — all reviewed.'
                    : `Newest drafts — ${pendingCount} still awaiting review.`}
                </p>
              </header>
              <ul className="pc-latest">
                {drafts.length === 0 && <li className="pc-latest-empty">Questions land here as they're written.</li>}
                {[...drafts].reverse().slice(0, 5).map((d) => {
                  const decided = pendingIds !== null && !pendingIds.has(d.id);
                  return (
                    <li key={d.id} data-decided={decided || undefined}>
                      <span className="pc-latest-stem">{clip(d.stem, 52)}</span>
                      <span className="pc-latest-meta">
                        {d.bloom ? BLOOM_LABELS[d.bloom] || d.bloom : '—'}
                        {decided && <em className="pc-latest-reviewed"><Check size={9} /> reviewed</em>}
                        <i className="pc-dot" data-kind={d.grounding === 'knowledge' ? 'knowledge' : 'grounded'} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* ── Material breakdown — the scan's blueprint, charted; or stage
         * timings when this file never produced one. ── */}
        {material && (bpTopics.length ? (
          <div className="pc-row" data-tour="pipe-stats">
            <div className="pc-panel">
              <header className="pc-panel-head">
                <h3>Topics by period</h3>
                <p>Where the scanned schedule puts its topics.</p>
              </header>
              <div className="pc-chart"><Bar data={bpTopicsData} options={barOpts} /></div>
            </div>
            <div className="pc-panel">
              <header className="pc-panel-head">
                <h3>Hours by period</h3>
                <p>Instructional hours per schedule group.</p>
              </header>
              <div className="pc-chart"><Bar data={bpHoursData} options={barOpts} /></div>
            </div>
            <div className="pc-panel">
              <header className="pc-panel-head">
                <h3>Scanned topics</h3>
                <p>{counted(bpTopics.length, 'topic')} found in the syllabus.</p>
              </header>
              <ul className="pc-latest">
                {bpTopics.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <span className="pc-latest-stem">{clip(t.title, 52)}</span>
                    <span className="pc-latest-meta">
                      {jobJson(t.schedule)?.label || '—'}
                      {Number(t.instructional_hours) ? ` · ${Number(t.instructional_hours)}h` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : chainJobs.length ? (
          <div className="pc-row" data-tour="pipe-stats">
            <div className="pc-panel">
              <header className="pc-panel-head">
                <h3>Stage duration</h3>
                <p>Seconds each step of this material's pipeline took.</p>
              </header>
              <div className="pc-chart">
                {timedChain.length
                  ? <Bar data={chainData} options={barOpts} />
                  : <div className="pc-chart-empty">Stage timings appear once a step finishes.</div>}
              </div>
            </div>
            <div className="pc-panel">
              <header className="pc-panel-head">
                <h3>Material chain</h3>
                <p>Every task that ran on this file.</p>
              </header>
              <ul className="pc-latest">
                {chainJobs.slice(-5).map((t) => (
                  <li key={t.id}>
                    <span className="pc-latest-stem">{LABELS[t.type] || t.type}</span>
                    <span className="pc-latest-meta">
                      {STATES[t.status] || t.status}
                      {taskSecs(t) !== null ? ` · ${Math.round(taskSecs(t))}s` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null)}

        {/* ── Recorded results ── */}
        {generation && stats.failedSlots.length > 0 && (
          <section className="pc-shortfalls"><h2>{stats.missingQuestions} {stats.missingQuestions === 1 ? 'question' : 'questions'} still missing from this run</h2>
            <ul>{stats.failedSlots.map((slot, i) => <li key={i}><strong>{slot.topic} · {BLOOM_LABELS[slot.bloom] || slot.bloom}</strong><p>{slot.generated || 0} of {slot.count} saved. {slot.reason}</p></li>)}</ul>
          </section>
        )}
        {error && <p className="pc-error" role="alert"><AlertTriangle size={18} />{error}</p>}

        {/* ── What it's doing right now ── */}
        <div className="pc-now" aria-live="polite" data-tour="pipe-now">
          {nowSlot ? (
            <>
              <span className="pc-now-tag">Now</span>
              <span className="pc-now-text">
                Writing cell {Math.min((stats.doneCells || 0) + 1, stats.totalCells || '…')}{stats.totalCells ? ` of ${stats.totalCells}` : ''}
                {` — ${nowSlot.topic}`}{nowSlot.bloom ? ` · ${BLOOM_LABELS[nowSlot.bloom] || nowSlot.bloom}` : ''}
              </span>
            </>
          ) : latestDraft ? (
            <>
              <span className="pc-now-tag" data-tone="done">Latest</span>
              <span className="pc-now-text">{clip(latestDraft.stem, 110)}</span>
              <span className="pc-chip" data-kind={latestDraft.grounding === 'knowledge' ? 'knowledge' : 'grounded'}>
                {latestDraft.grounding === 'knowledge' ? 'knowledge' : 'grounded'}
              </span>
            </>
          ) : (
            <span className="pc-now-text pc-now-idle">
              {running
                ? (job?.type === 'syllabus_tos'
                  ? 'Reading the syllabus — topics, outcomes, and time frames.'
                  : job?.type === 'extract' ? 'Reading the file — extracting its text.'
                  : job?.type === 'embed' ? 'Indexing source passages for retrieval.'
                  : 'Warming up — the AI is reading your blueprint…')
                : job ? 'This task has ended — its recorded result is on this page.'
                : 'Select a task with the picker, or start one from Materials or a finalized blueprint.'}
            </span>
          )}
        </div>

        {job && ['done'].includes(status) && (
          <footer className="pc-done">
            <span>{doneSummary()}</span>
            {doneAction()}
          </footer>
        )}
        {job && ['failed', 'cancelled'].includes(status) && (
          <footer className="pc-done">
            <span>This task {status === 'failed' ? 'failed' : 'was stopped'}. Any saved work remains available in its subject.</span>
            {generation && <Link to={'/questions/review' + (job.subject_id ? '?subject_id=' + encodeURIComponent(job.subject_id) : '')} className="btn btn-outline btn-sm">Review saved drafts <ArrowRight size={14} /></Link>}
          </footer>
        )}
        {!job && <p role="status">{pickedId ? (olderTask?.id === pickedId && olderTask.error ? olderTask.error : 'Loading selected task…') : 'No task selected — pick one from the picker above.'}</p>}
      </section>

      {loaded && jobs.length === 0 && (
        <p className="pc-empty">
          No tasks yet — upload a syllabus or lesson from <Link to="/materials">Materials</Link>, or open a finalized blueprint and choose <b>Generate questions</b>, then come back to watch the AI work.
        </p>
      )}

      <Modal
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        title={graphTitle}
        subtitle={graphMaterial ? 'Read, then blueprint and index in parallel — questions are a separate step.' : 'Every question follows the same path — watch it move.'}
        size="xl"
        icon={Workflow}
      >
        <div className="pc-cols" aria-hidden="true">{cols.map((c) => <span key={c}>{c}</span>)}</div>
        <div className="pc-graph-scroll">{flowGraph}</div>
      </Modal>
    </AppShell>
  );
}
