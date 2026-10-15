import { useId, useState } from 'react';
import { Maximize2, Workflow } from 'lucide-react';
import Modal from './Modal.jsx';
import { BLOOM_LABELS, BLOOM_ORDER } from '../lib/insights.js';
import { draftTimeline } from '../lib/pipelineRun.js';

// Original Sankey-style geometry: inputs at left, work in the middle, and
// branching outcomes at right. The picture is a flow map, not stage telemetry.
const QUESTION_NODES = [
  { id: 'blueprint', x: 90, y: 76, label: 'BLUEPRINT', sub: 'your TOS matrix' },
  { id: 'bank', x: 90, y: 244, label: 'BANK', sub: 'existing questions' },
  { id: 'retrieve', x: 260, y: 160, label: 'RETRIEVE', sub: 'uploaded lessons' },
  { id: 'draft', x: 424, y: 160, label: 'DRAFT', sub: 'writes questions' },
  { id: 'review', x: 588, y: 160, label: 'CONSTRAINTS', sub: 'source · format · Bloom' },
  { id: 'decide', x: 736, y: 160, label: 'BLIND CHECK', sub: 'independent solver' },
  { id: 'saved', x: 888, y: 60, label: 'DRAFTED', tone: 'blue' },
  { id: 'held', x: 888, y: 132, label: 'SHORTFALL', tone: 'rose' },
  { id: 'covered', x: 888, y: 204, label: 'COVERED', tone: 'slate' },
  { id: 'reused', x: 888, y: 276, label: 'REUSED', tone: 'green' },
];
const QUESTION_EDGES = [
  ['blueprint', 'retrieve'], ['retrieve', 'draft'], ['draft', 'review'], ['review', 'decide'],
  ['decide', 'saved'], ['decide', 'held'], ['bank', 'covered'], ['bank', 'reused'],
];
const MATERIAL_NODES = [
  { id: 'file', x: 90, y: 160, label: 'MATERIAL', sub: 'your uploaded file' },
  { id: 'extract', x: 270, y: 160, label: 'READ', sub: 'extract the text' },
  { id: 'syllabus_tos', x: 470, y: 76, label: 'BLUEPRINT', sub: 'topics & periods' },
  { id: 'embed', x: 470, y: 244, label: 'INDEX', sub: 'source passages' },
  { id: 'plan', x: 680, y: 76, label: 'DRAFT PLAN', sub: 'instructor reviews' },
  { id: 'source', x: 680, y: 244, label: 'SOURCES', sub: 'lessons for answers' },
  { id: 'questions', x: 888, y: 160, label: 'QUESTIONS', sub: 'separate next step' },
];
const MATERIAL_EDGES = [
  ['file', 'extract'], ['extract', 'syllabus_tos'], ['extract', 'embed'],
  ['syllabus_tos', 'plan'], ['embed', 'source'], ['plan', 'questions'], ['source', 'questions'],
];
const STATES = { queued: 'Queued', running: 'Running', done: 'Finished', failed: 'Failed', cancelled: 'Stopped' };
const counted = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function FlowGraph({ material, job, status, stats, related }) {
  const titleId = useId();
  const descId = useId();
  const nodes = material ? MATERIAL_NODES : QUESTION_NODES;
  const edges = material ? MATERIAL_EDGES : QUESTION_EDGES;
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const stages = Object.fromEntries(related.map((task) => [task.type, task.status]).reverse());
  if (material && job) stages[job.type] = status;
  const recorded = {
    saved: { count: stats.drafted, sub: `${counted(stats.drafted, 'question')} saved` },
    held: { count: stats.failedSlots.length, sub: `${counted(stats.failedSlots.length, 'cell')} with gaps` },
    covered: { count: stats.coveredCells, sub: `${counted(stats.coveredCells, 'cell')} filled` },
    reused: { count: stats.adopted, sub: `${counted(stats.adopted, 'question')} linked` },
  };
  const hasRun = job?.type === 'generate';
  return <svg className="pc-graph" viewBox="0 0 960 320" role="img" aria-labelledby={`${titleId} ${descId}`}>
    <title id={titleId}>{material ? 'Material processing flow' : 'Question generation flow'}</title>
    <desc id={descId}>{material
      ? 'The file is read, then blueprint drafting and passage indexing run separately. Instructor review and lesson evidence are needed before questions.'
      : 'Blueprint and question bank feed retrieval, drafting and independent checks. Outcome numbers come from the selected run; intermediate stages are schematic.'}</desc>
    {edges.map(([from, to]) => {
      const a = byId[from]; const b = byId[to];
      const start = a.x + 60; const end = b.x - 60;
      const bend = Math.max(30, Math.abs(end - start) * .5);
      const path = `M ${start} ${a.y} C ${start + bend} ${a.y}, ${end - bend} ${b.y}, ${end} ${b.y}`;
      const active = material ? stages[to] === 'running'
        : hasRun && status === 'running' && ['retrieve', 'draft', 'review', 'decide'].includes(to);
      const tone = !material && hasRun && recorded[to]?.count > 0 ? b.tone : undefined;
      return <g key={`${from}-${to}`}>
        <path className="pc-band" d={path} data-live={active || undefined} data-tone={tone} />
        <path className="pc-edge" d={path} data-live={active || undefined} data-tone={tone} />
      </g>;
    })}
    {nodes.map((node) => {
      const outcome = recorded[node.id];
      const stage = material ? stages[node.id] : null;
      const sub = material ? (STATES[stage] || node.sub)
        : outcome ? (hasRun ? outcome.sub : '— not recorded') : node.sub;
      return <g key={node.id} className="pc-node" data-state={stage}
        data-tone={hasRun && outcome?.count > 0 ? node.tone : undefined}>
        <rect x={node.x - 60} y={node.y - 23} width="120" height="46" rx="10" />
        <text className="pc-node-label" x={node.x} y={node.y - 3} textAnchor="middle">{node.label}</text>
        <text className="pc-node-sub" x={node.x} y={node.y + 12} textAnchor="middle">{sub}</text>
      </g>;
    })}
  </svg>;
}

function QuestionMix({ stats }) {
  const total = stats.drafted + stats.adopted;
  const fraction = total ? stats.drafted / total * 100 : 0;
  return <div className="pc-panel pc-panel--mix">
    <header className="pc-panel-head"><h3>Question output</h3></header>
    <div className="pc-mix">
      <div className="pc-donut">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${stats.drafted} new questions and ${stats.adopted} reused questions`}>
          <circle className="pc-ring-track" cx="60" cy="60" r="47" />
          {total > 0 && <><circle className="pc-ring-reused" cx="60" cy="60" r="47" />
            <circle className="pc-ring-drafted" cx="60" cy="60" r="47" pathLength="100" strokeDasharray={`${fraction} ${100 - fraction}`} transform="rotate(-90 60 60)" /></>}
        </svg>
        <div className="pc-donut-center"><b>{total}</b><span>questions</span></div>
      </div>
      <ul className="pc-legend"><li data-tone="blue"><i /><span>New drafts</span><b>{stats.drafted}</b></li>
        <li data-tone="green"><i /><span>Reused</span><b>{stats.adopted}</b></li></ul>
      <p className="pc-chart-note">{counted(stats.failedSlots.length, 'cell')} with a shortfall · {counted(stats.missingQuestions, 'question')} missing</p>
    </div>
  </div>;
}

function DraftCharts({ drafts, startedAt }) {
  const timeline = draftTimeline(drafts, startedAt);
  const maximum = Math.max(1, ...BLOOM_ORDER.map((level) => drafts.filter((draft) => draft.bloom === level).length));
  const seconds = Math.max(1, timeline.points.at(-1)?.seconds || 0);
  const xy = timeline.points.map((point) => `${26 + point.seconds / seconds * 268},${118 - point.count / Math.max(1, timeline.timed) * 98}`);
  return <div className="pc-row" data-tour="pipe-stats">
    <section className="pc-panel"><header className="pc-panel-head"><h3>Drafts by cognitive level</h3></header>
      <div className="pc-bloom">{BLOOM_ORDER.map((level) => {
        const count = drafts.filter((draft) => draft.bloom === level).length;
        return <div key={level}><span>{BLOOM_LABELS[level]}</span><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" rx="4" className="pc-bar-track" /><rect width={count / maximum * 100} height="8" rx="4" className="pc-bar-fill" /></svg><b>{count}</b></div>;
      })}</div>
    </section>
    <section className="pc-panel"><header className="pc-panel-head"><h3>Writing timeline</h3></header>
      {timeline.timed > 0 ? <svg className="pc-timeline" viewBox="0 0 320 150" role="img" aria-label={`${timeline.timed} timestamped drafts saved over ${Math.round(seconds)} seconds`}>
        <path className="pc-axis" d="M26 14 V118 H294" />
        <polygon className="pc-timeline-fill" points={`26,118 ${xy.join(' ')} 294,118`} />
        <polyline className="pc-timeline-line" points={xy.join(' ')} />
        <text x="16" y="121" textAnchor="end">0</text><text x="16" y="24" textAnchor="end">{timeline.timed}</text>
        <text x="26" y="140">0m</text><text x="294" y="140" textAnchor="end">{(seconds / 60).toFixed(1)}m</text>
      </svg> : <div className="pc-chart-empty">{drafts.length ? 'Saved timestamps are not available for these drafts yet.' : 'No saved questions to plot.'}</div>}
      {timeline.untimed > 0 && <p className="pc-chart-note">{timeline.untimed} drafts have no recorded timestamp and are not plotted.</p>}
    </section>
    <section className="pc-panel"><header className="pc-panel-head"><h3>Latest questions</h3></header>
      <ul className="pc-latest">{drafts.length ? [...drafts].reverse().slice(0, 5).map((draft) => <li key={draft.id}><span>{draft.stem}</span><small>{BLOOM_LABELS[draft.bloom] || draft.bloom}</small></li>) : <li>No saved questions for this run.</li>}</ul>
    </section>
  </div>;
}

export default function PipelineVisuals({ job, status, stats, result = {}, related = [], drafts = [], children }) {
  const [expanded, setExpanded] = useState(false);
  const material = ['extract', 'syllabus_tos', 'embed'].includes(job?.type);
  const [showQuestions, setShowQuestions] = useState(false);
  const generation = job?.type === 'generate';
  const title = material && !showQuestions ? 'Material flow' : 'Question flow';
  const graph = <FlowGraph material={material && !showQuestions} job={job} status={status} stats={stats} related={related} />;
  const note = material ? (showQuestions ? 'Next stage · finalized blueprint + supporting lessons required' : 'Blueprint and index run separately · question checks come next')
    : 'Recorded outcomes · flow is schematic, not stage timing';
  return <>
    <div className="pc-main" data-tour="pipe-graph">
      <section className="pc-panel pc-panel--flow"><header className="pc-panel-head pc-panel-head--row">
        {material ? <div className="pc-view-switch" role="group" aria-label="Pipeline view">
          <button aria-pressed={!showQuestions} onClick={() => setShowQuestions(false)}>Material</button>
          <button aria-pressed={showQuestions} onClick={() => setShowQuestions(true)}>Questions & checks</button>
        </div> : <h3>{title}</h3>}
        <button className="pc-fs" onClick={() => setExpanded(true)} aria-label="View pipeline larger"><Maximize2 size={15} /><span>Expand</span></button>
      </header><div className="pc-graph-scroll" tabIndex={0} role="region" aria-label="Scrollable pipeline flow map">{graph}</div><p className="pc-scroll-hint">Scroll sideways to explore the full map.</p><p className="pc-chart-note">{note}</p></section>
      {generation ? <QuestionMix stats={stats} /> : <section className="pc-panel pc-panel--mix"><header className="pc-panel-head"><h3>Recorded result</h3></header>
        <div className="pc-run-result"><Workflow size={28} /><strong>{STATES[status] || 'No task selected'}</strong>
          {status === 'done' && job?.type === 'syllabus_tos' && <><b>{result.topicCount ?? '—'}</b><span>topics in this scan</span></>}
          {status === 'done' && job?.type === 'extract' && <><b>{Number(result.charCount || 0).toLocaleString()}</b><span>characters read</span></>}
          {status === 'done' && job?.type === 'embed' && <><b>{result.chunkCount ?? '—'}</b><span>passages indexed</span></>}
        </div></section>}
    </div>
    {children}
    {generation && <DraftCharts drafts={drafts} startedAt={job.started_at} />}
    <Modal open={expanded} onClose={() => setExpanded(false)} title={title} subtitle="Connected flow map with recorded results" size="xl" icon={Workflow}>
      <div className="pc-graph-scroll" tabIndex={0} role="region" aria-label="Expanded pipeline flow map">{graph}</div><p className="pc-scroll-hint">Scroll sideways to explore the full map.</p><p className="pc-chart-note">{note}</p>
    </Modal>
  </>;
}
