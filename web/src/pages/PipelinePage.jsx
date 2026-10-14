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
import { ArrowRight, History, Square } from 'lucide-react';
import AppShell from '../components/AppShell.jsx';
import Select from '../components/Select.jsx';
import useJobs, { cancelJob, isActiveJob, jobPayload } from '../lib/useJobs.js';
import useJobStream from '../lib/useJobStream.js';
import { BLOOM_LABELS } from '../lib/insights.js';
import '../styles/pipeline.css';

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

/** Rounded elbow: right out of node a, vertical jog at the midpoint,
 *  then right into node b — flowchart routing, no sagging diagonals. */
function seg(a, b, r = 12) {
  const ax = rightX(a); const ay = NODES[a].y;
  const bx = leftX(b); const by = NODES[b].y;
  if (ay === by) return `L ${bx} ${by}`;
  const mx = ax + (bx - ax) / 2;
  const dy = Math.sign(by - ay);
  const rr = Math.max(2, Math.min(r, Math.abs(bx - ax) / 2 - 1, Math.abs(by - ay) / 2 - 1));
  return `L ${mx - rr} ${ay} Q ${mx} ${ay} ${mx} ${ay + dy * rr} ` +
         `L ${mx} ${by - dy * rr} Q ${mx} ${by} ${mx + rr} ${by} L ${bx} ${by}`;
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
  const [pulses, setPulses] = useState({}); // edgeKey -> tone
  const prev = useRef({ adopted: 0, skipped: 0, drafted: 0, refused: 0, jobId: null });
  const burstSeq = useRef(0);

  const spawn = (journey, color, n = 1) => {
    const items = Array.from({ length: n }, (_, i) => ({ id: ++burstSeq.current, path: journey.path, color, delay: i * 0.18 }));
    setBursts((b) => [...b, ...items]);
    setTimeout(() => setBursts((b) => b.filter((p) => !items.some((it) => it.id === p.id))), 2600);
    // Light this journey's edges while the particle rides them.
    setPulses((h) => { const next = { ...h }; journey.edges.forEach((k) => { next[k] = journey.tone; }); return next; });
    setTimeout(() => setPulses((h) => {
      const next = { ...h };
      journey.edges.forEach((k) => { if (next[k] === journey.tone) delete next[k]; });
      return next;
    }), 2400);
  };

  // Reset when the watched run changes.
  useEffect(() => {
    if (prev.current.jobId === selectedId) return;
    prev.current = { adopted: 0, skipped: 0, drafted: 0, refused: 0, jobId: selectedId };
    setBursts([]);
    setPulses({});
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
      drafts.slice(p.drafted).forEach((d, i) => {
        setTimeout(() => spawn(JOURNEYS.draft, d.grounding === 'knowledge' ? 'var(--amber-600)' : 'var(--accent)'), i * 120);
      });
      p.drafted = drafts.length;
    }
  }, [drafts]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateLabel = running ? (status === 'queued' ? 'QUEUED' : 'LIVE') : (status || 'IDLE').toUpperCase();
  const nowSlot = status === 'running' ? progress?.lastSlot : null;
  const latestDraft = drafts.length ? drafts[drafts.length - 1] : null;

  return (
    <AppShell pageClass="pipeline" activeNav="pipeline" pageTitle="How AI works" wide>
      <section className="pc-deck" data-live={running ? 'true' : undefined} aria-label="Live generation console">
        <header className="pc-top">
          <span className={`pc-status pc-status--${running ? 'live' : 'idle'}`} data-state={status || 'idle'}>
            <i />{stateLabel}
          </span>
          <div className="pc-heading">
            <strong>{job ? 'Writing questions' : 'Waiting for a run'}</strong>
            <span>
              run #{job ? String(job.id).slice(0, 6) : '—'}
              {jobPayload(job)?.tosId ? ` · blueprint ${String(jobPayload(job).tosId).slice(0, 8)}` : ''}
            </span>
          </div>
          {others.map((o) => (
            <span key={o.label} className="pc-ambient">{o.label}{o.n > 1 ? ` ×${o.n}` : ''}</span>
          ))}
          <span className="pc-top-actions">
            {feed.connected === false && running && <span className="pc-conn" data-off="true">reconnecting…</span>}
            {genJobs.length > 1 && (
              <Select
                value={selectedId}
                onChange={setPickedId}
                label="Watch a different run"
                icon={History}
                options={genJobs.slice(0, 12).map((j) => ({
                  value: j.id,
                  label: `run #${String(j.id).slice(0, 6)} · ${j.status}${isActiveJob(j) ? ' · live' : ''}`,
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
        <div className="pc-kpis">
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

        {/* ── Flow graph ── */}
        <svg className="pc-graph" viewBox="0 0 960 320" role="img"
          aria-label="Question generation pipeline: blueprint and bank feed retrieve, draft, review, decide, then queue, adopt, skip, or refuse">
          <defs>
            <filter id="pc-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker id="pc-arrow" viewBox="0 0 8 8" refX="7" refY="4"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 7 4 L 0 7" className="pc-arrowhead" />
            </marker>
          </defs>
          {EDGES.map(([a, b]) => {
            const key = `${a}|${b}`;
            const live = running && LIVE_EDGES.has(key);
            const pulse = pulses[key];
            return (
              <path key={key} className="pc-edge" markerEnd="url(#pc-arrow)"
                data-live={live || undefined} data-pulse={pulse || undefined}
                d={`M ${rightX(a)} ${NODES[a].y} ${seg(a, b)}`} />
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

        {/* ── What it's doing right now ── */}
        <div className="pc-now" aria-live="polite">
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
            <span>Done — {drafted} new question{drafted === 1 ? ' is' : 's are'} waiting for your review.</span>
            <Link to="/questions/review" className="btn btn-primary btn-sm">Review them <ArrowRight size={14} /></Link>
          </footer>
        )}
      </section>

      {loaded && genJobs.length === 0 && (
        <p className="pc-empty">
          No runs yet — open a finalized blueprint and choose <b>Generate questions</b>, then come back to watch the AI work.
        </p>
      )}

    </AppShell>
  );
}
