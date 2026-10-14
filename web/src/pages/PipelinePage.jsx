/**
 * PipelinePage — "How AI works": a live view of the question-writing run.
 *
 * An SVG flow graph whose edges flow while a run is active and whose nodes
 * light up stage by stage, particles traveling to the outcome nodes as
 * questions land, a KPI band, and a one-line caption of what it's doing.
 *
 * Real-time comes from the existing SSE stream (useJobStream) — every
 * `progress` event moves the counters, every `drafts` event spawns a
 * particle DRAFT → REVIEW → DECIDE → QUEUED.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, History, Maximize2, Square, Workflow } from 'lucide-react';
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
import useJobs, { cancelJob, isActiveJob, jobPayload } from '../lib/useJobs.js';
import useJobStream from '../lib/useJobStream.js';
import api from '../lib/api.js';
import { BLOOM_LABELS, BLOOM_ORDER } from '../lib/insights.js';
import '../styles/pipeline.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Filler, Tooltip);

/** Resolve a design token so charts follow the active theme + accent. */
const cssVar = (name, fallback) =>
  (typeof window !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

const JOB_LABELS = {
  generate: 'generate', syllabus_tos: 'blueprint', embed: 'index',
  extract: 'extract', similarity: 'similarity', lexicon: 'lexicon',
};

/* ── Flow graph geometry ──────────────────────────────────────── */
const NW = 120; // node width
const NODES = {
  blueprint: { x: 90,  y: 76,  label: 'BLUEPRINT', sub: 'your TOS matrix' },
  bank:      { x: 90,  y: 244, label: 'BANK',      sub: 'approved questions' },
  retrieve:  { x: 260, y: 160, label: 'RETRIEVE',  sub: 'reads your lessons' },
  draft:     { x: 424, y: 160, label: 'DRAFT',     sub: 'writes questions' },
  review:    { x: 588, y: 160, label: 'REVIEW',    sub: 'checks the evidence' },
  decide:    { x: 736, y: 160, label: 'DECIDE',    sub: 'second opinion' },
  queued:    { x: 888, y: 60,  label: 'QUEUED',    sub: 'for your review' },
  refused:   { x: 888, y: 132, label: 'HELD',      sub: 'not enough proof' },
  skipped:   { x: 888, y: 204, label: 'COVERED',   sub: 'already covered' },
  adopted:   { x: 888, y: 276, label: 'REUSED',    sub: 'from your bank' },
};
const OUTCOME_W = 116; // outcome nodes are slightly narrower
const OUTCOMES = new Set(['queued', 'adopted', 'skipped', 'refused']);

const rightX = (k) => NODES[k].x + (OUTCOMES.has(k) ? OUTCOME_W : NW) / 2;
const leftX = (k) => NODES[k].x - (OUTCOMES.has(k) ? OUTCOME_W : NW) / 2;

/** Sankey-style smooth stream: horizontal tangents both ends so the band
 *  reads as a flowing channel, not a wire. */
function seg(a, b) {
  const ax = rightX(a); const ay = NODES[a].y;
  const bx = leftX(b); const by = NODES[b].y;
  const dx = Math.max(30, Math.abs(bx - ax) * 0.5);
  return `C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}`;
}
function chain(keys) {
  let d = `M ${rightX(keys[0])} ${NODES[keys[0]].y}`;
  for (let i = 1; i < keys.length; i += 1) d += ` ${seg(keys[i - 1], keys[i])}`;
  return d;
}

const EDGES = [
  ['blueprint', 'retrieve'], ['retrieve', 'draft'], ['draft', 'review'],
  ['review', 'decide'], ['decide', 'queued'], ['decide', 'refused'],
  ['bank', 'skipped'], ['bank', 'adopted'],
];
// Edges that stay lit for the whole run — the writing channel.
const LIVE_EDGES = new Set(['blueprint|retrieve', 'retrieve|draft', 'draft|review', 'review|decide']);
// Edge path each outcome flashes as its particle travels it.
const JOURNEYS = {
  draft: { path: chain(['draft', 'review', 'decide', 'queued']), edges: ['draft|review', 'review|decide', 'decide|queued'], tone: 'blue' },
  adopt: { path: chain(['bank', 'adopted']), edges: ['bank|adopted'], tone: 'green' },
  skip: { path: chain(['bank', 'skipped']), edges: ['bank|skipped'], tone: 'slate' },
  refuse: { path: chain(['decide', 'refused']), edges: ['decide|refused'], tone: 'rose' },
};

function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
const clip = (s, n = 64) => (String(s || '').length > n ? `${String(s).slice(0, n)}…` : String(s || ''));

/** Friendly run label — "PE 3 · Physical Activities Toward Health and
 *  Fitness 3" — falling back to the short run id when names are missing. */
const runLabel = (j) => {
  const name = [j.subject_code || j.subject_name, j.tos_title].filter(Boolean).join(' · ');
  return name || `run #${String(j.id).slice(0, 6)}`;
};
const runWhen = (j) => (j.created_at
  ? new Date(j.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '');

export default function PipelinePage() {
  const { jobs, loaded } = useJobs({ activeInterval: 3000, idleInterval: 15000 });

  // The console follows generate runs — newest active first, else most recent.
  const genJobs = useMemo(() => jobs.filter((j) => j.type === 'generate'), [jobs]);
  const [pickedId, setPickedId] = useState(null);
  const pickedValid = pickedId && genJobs.some((j) => j.id === pickedId);
  const selectedId = (pickedValid ? pickedId : (genJobs.find(isActiveJob) || genJobs[0]))?.id ?? null;

  const job = jobs.find((j) => j.id === selectedId) || null;
  const feed = useJobStream(selectedId);
  const { status, progress, result, drafts } = feed;
  const running = status === 'running' || status === 'queued' || (job && isActiveJob(job));

  // Other in-flight work (embed, extract, similarity…) as ambient activity,
  // grouped by type so eight similarity checks read as "similarity ×8".
  const others = jobs.filter((j) => isActiveJob(j) && j.id !== selectedId)
    .reduce((acc, j) => {
      const label = JOB_LABELS[j.type] || j.type;
      const found = acc.find((a) => a.label === label);
      if (found) found.n += 1; else acc.push({ label, n: 1 });
      return acc;
    }, []);

  /* ── KPI numbers ── */
  const total = Number(progress?.slotsTotal) || 0;
  const doneCells = status === 'done' ? total : Number(progress?.slotsDone) || 0;
  const adopted = Number(progress?.adopted ?? result?.adopted) || 0;
  const skipped = Number(progress?.skipped ?? result?.skippedCells) || 0;
  const failedSlots = Array.isArray(result?.failedSlots) ? result.failedSlots : [];
  const drafted = drafts.length || Number(result?.drafted ?? progress?.drafted) || 0;

  /* ── Elapsed clock ── */
  const startedAt = job?.started_at || job?.created_at;
  const finishedAt = job?.finished_at;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const elapsed = startedAt ? fmtClock(new Date(finishedAt || now) - new Date(startedAt)) : '—';
  const rate = drafted && startedAt ? (drafted / Math.max(1, (new Date(finishedAt || now) - new Date(startedAt)) / 60000)).toFixed(1) : null;

  /* ── Particle bursts + edge pulses as outcomes land ── */
  const [bursts, setBursts] = useState([]);
  const [draftTimes, setDraftTimes] = useState([]); // seconds-since-start per draft
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

  // Reset when the watched run changes.
  useEffect(() => {
    if (prev.current.jobId === selectedId) return;
    prev.current = { adopted: 0, skipped: 0, drafted: 0, refused: 0, jobId: selectedId };
    setBursts([]);
    setPulses({});
    setDraftTimes([]);
  }, [selectedId]);

  useEffect(() => {
    const p = prev.current;
    if (!p.jobId) return;
    const prog = progress || {};
    const ad = Number(prog.adopted) || 0;
    if (ad > p.adopted) spawn(JOURNEYS.adopt, 'var(--green-600)', ad - p.adopted);
    const sk = Number(prog.skipped) || 0;
    if (sk > p.skipped) spawn(JOURNEYS.skip, 'var(--ink-faint)', sk - p.skipped);
    if (failedSlots.length > p.refused) {
      spawn(JOURNEYS.refuse, 'var(--red-600)', Math.min(6, failedSlots.length - p.refused));
    }
    p.adopted = ad; p.skipped = sk; p.refused = failedSlots.length;
  }, [feed, status, progress, result]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draft events → a particle per stored question.
  useEffect(() => {
    const p = prev.current;
    if (drafts.length > p.drafted) {
      const fresh = drafts.slice(p.drafted);
      const startMs = startedAt ? new Date(startedAt).getTime() : Date.now();
      setDraftTimes((t) => [...t, ...fresh.map(() => Math.max(0, (Date.now() - startMs) / 1000))]);
      fresh.forEach((d, i) => {
        const knowledge = d.grounding === 'knowledge';
        setTimeout(() => spawn(JOURNEYS.draft, knowledge ? 'var(--amber-600)' : 'var(--accent)', 1, knowledge ? 'amber' : 'blue'), i * 120);
      });
      p.drafted = drafts.length;
    }
  }, [drafts]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateLabel = running ? (status === 'queued' ? 'QUEUED' : 'LIVE') : (status || 'IDLE').toUpperCase();
  const nowSlot = status === 'running' ? progress?.lastSlot : null;
  const latestDraft = drafts.length ? drafts[drafts.length - 1] : null;

  /* ── Expanded pipeline graph (modal) ── */
  const [graphOpen, setGraphOpen] = useState(false);

  /* ── Which of this run's drafts are still in the review queue?
   * The stream replays stored drafts, so the list keeps its content after
   * review — a light poll of the draft list marks the decided ones. */
  const tosId = jobPayload(job)?.tosId;
  const [pendingIds, setPendingIds] = useState(null);
  useEffect(() => {
    if (!drafts.length) return undefined;
    let alive = true;
    const load = () => api
      .get(`/questions?status=draft${tosId ? `&tos_id=${encodeURIComponent(tosId)}` : ''}`)
      .then((r) => { if (alive) setPendingIds(new Set((r.questions || []).map((q) => q.id))); })
      .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [drafts.length, tosId]);
  const pendingCount = pendingIds ? drafts.filter((d) => pendingIds.has(d.id)).length : null;

  /* ── Theme-aware chart palette ── */
  const pal = {
    accent: cssVar('--accent', '#2383E2'), green: cssVar('--green-600', '#23A265'),
    amber: cssVar('--amber-600', '#B07D1E'), red: cssVar('--red-600', '#DC4445'),
    faint: cssVar('--ink-faint', '#959BA3'), grid: cssVar('--line', '#E8EBEF'),
    s3: cssVar('--surface-3', '#EDF0F4'), ink2: cssVar('--ink-2', '#4E545B'),
  };
  const chartTip = {
    backgroundColor: pal.ink2, titleFont: { weight: '700' }, bodyFont: { weight: '500' },
    padding: 10, cornerRadius: 8, displayColors: false,
  };

  /* ── Outcome mix (donut) ── */
  const outcomeData = {
    labels: ['Queued', 'Reused', 'Covered', 'Held'],
    datasets: [{
      data: [drafted, adopted, skipped, failedSlots.length],
      backgroundColor: [pal.accent, pal.green, pal.faint, pal.red],
      borderWidth: 2, borderColor: cssVar('--surface', '#fff'),
    }],
  };
  const outcomeTotal = drafted + adopted + skipped + failedSlots.length;

  /* ── Drafts by Bloom level (bars) ── */
  const bloomData = {
    labels: BLOOM_ORDER.map((k) => BLOOM_LABELS[k]),
    datasets: [{
      data: BLOOM_ORDER.map((k) => drafts.filter((d) => d.bloom === k).length),
      backgroundColor: pal.accent, borderRadius: 4, barPercentage: 0.7,
    }],
  };

  /* ── Writing pace (cumulative drafts over elapsed time) ── */
  const paceMinutes = Math.max(1, Math.ceil((startedAt ? Math.max(1, ((finishedAt ? new Date(finishedAt) : new Date(now)) - new Date(startedAt)) / 1000) : 1) / 60));
  const paceLabels = Array.from({ length: paceMinutes + 1 }, (_, i) => `${i}m`);
  const pacePoints = paceLabels.map((_, i) => draftTimes.filter((t) => t <= i * 60).length);
  const paceData = {
    labels: paceLabels,
    datasets: [{
      data: pacePoints, borderColor: pal.accent, fill: true, tension: 0.35,
      backgroundColor: 'rgba(35,131,226,.10)', pointRadius: 3, pointBackgroundColor: pal.accent,
    }],
  };

  /* ── The flow graph — rendered in the deck panel and, expanded, inside
   * the modal so it can be studied near-fullscreen. Same SVG both places. */
  const flowGraph = (
    <svg className="pc-graph" viewBox="0 0 960 320" role="img" data-tour="pipe-graph"
      aria-label="Question generation pipeline: blueprint and bank feed retrieve, draft, review, decide, then queue, adopt, skip, or refuse">
      <defs>
        <filter id="pc-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {EDGES.map(([a, b]) => {
        const key = `${a}|${b}`;
        const live = running && LIVE_EDGES.has(key);
        const pulse = pulses[key];
        const d = `M ${rightX(a)} ${NODES[a].y} ${seg(a, b)}`;
        return (
          <g key={key}>
            {/* wide soft band — the conduit */}
            <path className="pc-band" data-live={live || undefined} data-pulse={pulse || undefined} d={d} />
            {/* thin animated core — the flow */}
            <path className="pc-edge" data-live={live || undefined} data-pulse={pulse || undefined} d={d} />
          </g>
        );
      })}
      {/* Steady stream of dots along the working channel while live. */}
      {running && [...LIVE_EDGES].map((key) => {
        const [a, b] = key.split('|');
        const d = `M ${rightX(a)} ${NODES[a].y} ${seg(a, b)}`;
        return [0, 1, 2].map((i) => (
          <circle key={`${key}-${i}`} r="2.2" className="pc-stream">
            <animateMotion dur="1.5s" begin={`${i * 0.5}s`} repeatCount="indefinite" path={d} />
          </circle>
        ));
      })}
      {bursts.map((p) => (
        <circle key={p.id} r="3.6" style={{ fill: p.color }} filter="url(#pc-glow)">
          <animateMotion dur="1.7s" begin={`${p.delay}s`} path={p.path} fill="freeze" />
        </circle>
      ))}
      {Object.entries(NODES).map(([key, n]) => {
        const w = OUTCOMES.has(key) ? OUTCOME_W : NW;
        const counts = { queued: drafted, adopted, skipped, refused: failedSlots.length };
        const hot = running && (key === 'retrieve' || key === 'draft' || key === 'review' || key === 'decide');
        return (
          <g key={key} className="pc-node" data-hot={hot ? 'true' : undefined} data-count={(counts[key] ?? 0) > 0 ? 'true' : undefined}>
            <rect x={n.x - w / 2} y={n.y - 21} width={w} height="42" rx="10" />
            <text className="pc-node-label" x={n.x} y={n.y - 3} textAnchor="middle">{n.label}</text>
            <text className="pc-node-sub" x={n.x} y={n.y + 11} textAnchor="middle">
              {counts[key] !== undefined ? `${counts[key]} · ${n.sub}` : n.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );

  return (
    <AppShell pageClass="pipeline" activeNav="pipeline" pageTitle="How AI works" wide>
      <section className="pc-deck" data-live={running ? 'true' : undefined} aria-label="Live generation console">
        <header className="pc-top">
          <span className={`pc-status pc-status--${running ? 'live' : 'idle'}`} data-state={status || 'idle'}>
            <i />{stateLabel}
          </span>
          <div className="pc-heading">
            <strong>{job ? 'Writing questions' : 'Waiting for a run'}</strong>
            <span>{job ? `${runLabel(job)} · ${runWhen(job)}` : '—'}</span>
          </div>
          {others.map((o) => (
            <span key={o.label} className="pc-ambient">{o.label}{o.n > 1 ? ` ×${o.n}` : ''}</span>
          ))}
          <span className="pc-top-actions" data-tour="pipe-controls">
            {feed.connected === false && running && <span className="pc-conn" data-off="true">reconnecting…</span>}
            {genJobs.length > 1 && (
              <Select
                value={selectedId}
                onChange={setPickedId}
                label="Watch a different run"
                icon={History}
                options={genJobs.slice(0, 12).map((j) => ({
                  value: j.id,
                  label: `${runLabel(j)} · ${runWhen(j)} · ${j.status}${isActiveJob(j) ? ' · live' : ''}`,
                }))}
              />
            )}
            {running && (
              <button type="button" className="pc-stop" onClick={() => cancelJob(selectedId).catch(() => {})}>
                <Square size={11} /> Stop
              </button>
            )}
          </span>
        </header>

        {/* ── KPI band ── */}
        <div className="pc-kpis" data-tour="pipe-kpis">
          <div className="pc-kpi" data-tone="blue"><b>{drafted}</b><span>drafted</span></div>
          <div className="pc-kpi" data-tone="green"><b>{adopted}</b><span>reused</span></div>
          <div className="pc-kpi" data-tone="slate"><b>{skipped}</b><span>covered</span></div>
          <div className="pc-kpi" data-tone="rose"><b>{failedSlots.length}</b><span>held back</span></div>
          <div className="pc-kpi pc-kpi--wide">
            <b>{doneCells}<em>/{total || '—'}</em></b><span>blueprint cells</span>
            <i className="pc-kpi-bar"><i style={{ width: total ? `${(doneCells / total) * 100}%` : (running ? '30%' : '0%') }} /></i>
          </div>
          <div className="pc-kpi"><b>{elapsed}</b><span>elapsed</span></div>
          {rate && <div className="pc-kpi"><b>{rate}</b><span>per minute</span></div>}
        </div>

        {/* ── Flow graph + outcome mix ── */}
        <div className="pc-main">
          <div className="pc-panel pc-panel--flow">
            <header className="pc-panel-head pc-panel-head--row">
              <div>
                <h3>Generation pipeline</h3>
                <p>Every question follows the same path — watch it move.</p>
              </div>
              <button
                type="button" className="pc-fs" onClick={() => setGraphOpen(true)}
                title="Expand"
                aria-label="View pipeline larger"
              >
                <Maximize2 size={13} />
              </button>
            </header>
            <div className="pc-cols" aria-hidden="true">
              <span>Inputs</span><span>Writing &amp; checks</span><span>Outcomes</span>
            </div>
            {flowGraph}
          </div>

          {/* ── Outcome mix ── */}
          <div className="pc-panel pc-panel--mix">
            <header className="pc-panel-head">
              <h3>Outcome mix</h3>
              <p>Where blueprint cells ended up.</p>
            </header>
            <div className="pc-mix">
              <div className="pc-donut">
                <Doughnut
                  data={outcomeData}
                  options={{
                    cutout: '68%', maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: chartTip },
                  }}
                />
                <div className="pc-donut-center">
                  <b>{outcomeTotal}</b><span>cells</span>
                </div>
              </div>
              <ul className="pc-legend">
                {[['Queued', drafted, pal.accent], ['Reused', adopted, pal.green],
                  ['Covered', skipped, pal.faint], ['Held', failedSlots.length, pal.red]].map(([label, n, c]) => (
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
        </div>

        {/* ── Breakdown panels ── */}
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
              <p>Drafts landing over the run.</p>
            </header>
            <div className="pc-chart">
              <Line
                data={paceData}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: chartTip },
                  scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: pal.faint, font: { size: 9 } } }, y: { grid: { color: pal.grid }, border: { display: false }, ticks: { color: pal.faint, font: { size: 9 }, precision: 0 } } },
                }}
              />
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

        {/* ── What it's doing right now ── */}
        <div className="pc-now" aria-live="polite" data-tour="pipe-now">
          {nowSlot ? (
            <>
              <span className="pc-now-tag">Now</span>
              <span className="pc-now-text">
                Writing cell {Math.min((Number(progress?.slotsDone) || 0) + 1, total || '…')}{total ? ` of ${total}` : ''}
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
              {running ? 'Warming up — the AI is reading your blueprint…' : 'Start a run from a blueprint and each stage lights up as the AI works through it.'}
            </span>
          )}
        </div>

        {!running && drafts.length > 0 && (
          <footer className="pc-done">
            <span>
              {pendingCount === 0
                ? `Done — all ${drafted} draft${drafted === 1 ? '' : 's'} reviewed.`
                : `Done — ${pendingCount ?? drafted} new question${(pendingCount ?? drafted) === 1 ? ' is' : 's are'} waiting for your review.`}
            </span>
            {pendingCount === 0 ? (
              <Link to="/questions" className="btn btn-primary btn-sm">Open question bank <ArrowRight size={14} /></Link>
            ) : (
              <Link to="/questions/review" className="btn btn-primary btn-sm">Review them <ArrowRight size={14} /></Link>
            )}
          </footer>
        )}
      </section>

      <Modal
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        title="Generation pipeline"
        subtitle="Every question follows the same path — watch it move."
        size="xl"
        icon={Workflow}
      >
        <div className="pc-cols" aria-hidden="true">
          <span>Inputs</span><span>Writing &amp; checks</span><span>Outcomes</span>
        </div>
        {flowGraph}
      </Modal>

      {loaded && genJobs.length === 0 && (
        <p className="pc-empty">
          No runs yet — open a finalized blueprint and choose <b>Generate questions</b>, then come back to watch the AI work.
        </p>
      )}

    </AppShell>
  );
}
