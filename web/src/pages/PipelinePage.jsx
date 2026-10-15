import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Square, History, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import AppShell from '../components/AppShell.jsx';
import Select from '../components/Select.jsx';
import PipelineVisuals from '../components/PipelineVisuals.jsx';
import PipelineChecks from '../components/PipelineChecks.jsx';
import { useToast } from '../components/Toast.jsx';
import useJobs, { cancelJob } from '../lib/useJobs.js';
import useJobStream from '../lib/useJobStream.js';
import { generationSummary, jobJson, selectPipelineJob, syllabusTopicGroups } from '../lib/pipelineRun.js';
import api from '../lib/api.js';
import { BLOOM_LABELS } from '../lib/insights.js';
import '../styles/pipeline.css';

const LABELS = { extract: 'Read material', syllabus_tos: 'Draft blueprint', embed: 'Index passages', generate: 'Generate questions', similarity: 'Check duplicates', lexicon: 'Prepare terminology' };
const STATES = { queued: 'Queued', running: 'Running', done: 'Finished', failed: 'Failed', cancelled: 'Stopped' };
const context = (job) => job?.tos_title || job?.material_title || job?.subject_name || 'Task';
const date = (value) => value ? new Date(value).toLocaleString() : '—';

function BlueprintResult({ tosId }) {
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!tosId) return undefined;
    let alive = true;
    api.get('/tos/' + tosId).then((data) => { if (alive) setSnapshot({ id: tosId, data }); })
      .catch((error) => { if (alive) setSnapshot({ id: tosId, error: error.message }); });
    return () => { alive = false; };
  }, [tosId]);
  if (!tosId) return null;
  if (snapshot?.id !== tosId) return <p role="status">Loading blueprint result…</p>;
  if (snapshot.error) return <p role="status">This scan's blueprint is unavailable: {snapshot.error}</p>;
  const { tos, topics = [] } = snapshot.data;
  const meta = jobJson(tos.source_meta);
  const groups = syllabusTopicGroups(topics);
  return <section className="pc-result" aria-label="Syllabus scan result">
    <div className="pc-result-head"><div><h2>{tos.title}</h2><p>{topics.length} topics · {groups.length} schedule groups · {tos.status === 'finalized' ? 'Finalized' : 'Draft for instructor review'}</p></div>
      <Link className="btn btn-primary btn-sm" to={'/tos/' + tos.id}>Review blueprint <ArrowRight size={15} /></Link></div>
    <div className="pc-periods">{groups.map((group) => <details key={group.key}>
      <summary>{group.label}{group.weekStart ? ' · Weeks ' + group.weekStart + '–' + group.weekEnd : ' · weeks not stated'} <span>{group.topics.length} topics</span></summary>
      <ol>{group.topics.map((topic) => <li key={topic.id}>{topic.title}</li>)}</ol>
    </details>)}</div>
    <details className="pc-notes"><summary>Source & planning notes{meta.warnings?.length ? ` · ${meta.warnings.length} to review` : ''}</summary>
      <p>The syllabus supplies the course plan, not answer evidence. Period headings come from the source; topic hours and Bloom percentages may be proposed allocations. Upload supporting lessons for factual questions.</p>
      {meta.warnings?.length > 0 && <ul>{meta.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
    </details>
  </section>;
}

export default function PipelinePage() {
  const { jobs, loaded, activeCount, refresh } = useJobs({ activeInterval: 3000, idleInterval: 10000 });
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
  const toast = useToast();
  const [stopping, setStopping] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const elapsed = job?.started_at && (job.finished_at || running)
    ? Math.max(0, Math.floor(((job.finished_at ? new Date(job.finished_at).getTime() : now) - new Date(job.started_at).getTime()) / 1000)) : null;
  const tosId = result.tosId || payload.tosId;
  const related = jobs.filter((j) => payload.materialId && jobJson(j.payload).materialId === payload.materialId);
  const latestStage = (type) => related.find((j) => j.type === type);
  async function stop() {
    setStopping(true);
    try { await cancelJob(job.id); await refresh(); toast.info('Stop requested. Finished work is kept.'); }
    catch (err) { toast.error(err.message); }
    finally { setStopping(false); }
  }
  return <AppShell pageClass="pipeline" activeNav="pipeline" pageTitle="How AI works" wide>
    <div className="pc-workspace">
      <section className="pc-deck" aria-label="Selected processing task" data-tour="pipe-result">
        {!job ? <><p role="status">{pickedId ? (olderTask?.id === pickedId && olderTask.error ? olderTask.error : 'Loading selected task…') : 'Select a task to see its recorded result.'}</p>
          <PipelineVisuals stats={stats} /></> : <>
          <header className="pc-top">
            <span className={'pc-status pc-status--' + (running ? 'live' : 'idle')} data-state={status}><i />{STATES[status] || status}</span>
            <div className="pc-heading"><strong>{LABELS[job.type] || job.type}</strong><span>{context(job)}</span></div>
            <div className="pc-top-actions" data-tour="pipe-controls">
              {jobs.length > 0 && <Select value={job.id} onChange={(id) => setParams({ job: id })} label="Watch a different task" icon={History}
                options={(jobs.some((item) => item.id === job.id) ? jobs : [job, ...jobs]).map((item) => ({ value: item.id,
                  label: `${LABELS[item.type] || item.type} · ${item.subject_code || context(item)} · ${date(item.created_at)} · ${STATES[item.status] || item.status}` }))} />}
              {running && <button className="pc-stop" onClick={stop} disabled={stopping}><Square size={13} /> Stop</button>}
            </div>
          </header>
          <p className="pc-task-time">Started {date(job.started_at)}{elapsed !== null ? ' · ' + Math.floor(elapsed / 60) + 'm ' + elapsed % 60 + 's elapsed' : ''}{running && !feed.connected ? ' · Reconnecting to live updates…' : ''}</p>
          {error && <p className="pc-error" role="alert"><AlertTriangle size={18} />{error}</p>}
          {job.type === 'generate' && <div className="pc-kpis" data-tour="pipe-kpis">
            <div className="pc-kpi" data-tone="blue"><b>{stats.drafted}</b><span>questions drafted</span></div>
            <div className="pc-kpi" data-tone="green"><b>{stats.adopted}</b><span>questions reused</span></div>
            <div className="pc-kpi" data-tone="slate"><b>{stats.coveredCells}</b><span>cells already covered</span></div>
            <div className="pc-kpi" data-tone="rose"><b>{stats.failedSlots.length}</b><span>cells with a shortfall</span></div>
            <div className="pc-kpi"><b>{stats.doneCells ?? '—'} / {stats.totalCells ?? '—'}</b><span>cells processed</span></div>
          </div>}
          {payload.materialId && <>
            <ol className="pc-material-stages" aria-label="Material processing stages">{['extract', 'syllabus_tos', 'embed'].map((type) => {
              const stage = latestStage(type);
              const Icon = stage?.status === 'done' ? CheckCircle2 : stage?.status === 'failed' ? AlertTriangle : Clock;
              return <li key={type}><button disabled={!stage} aria-pressed={stage?.id === job.id} onClick={() => setParams({ job: stage.id })}>
                <Icon size={15} /><strong>{LABELS[type]}</strong><span>{stage ? STATES[stage.status] : 'Not recorded'}</span></button></li>;
            })}</ol>
          </>}
          <PipelineVisuals key={job.id} job={job} status={status} stats={stats} result={result} related={related} drafts={feed.drafts}>
            <PipelineChecks job={job} drafts={feed.drafts} drafted={stats.drafted} />
          </PipelineVisuals>
          {job.type === 'syllabus_tos' && running && <p role="status">Reading the syllabus topics, outcomes, and time frames. The blueprint result appears here when the scan finishes.</p>}
          {job.type === 'extract' && status === 'done' && <p>{Number(result.charCount || 0).toLocaleString()} characters extracted.{result.tosJobId && <> <button className="btn btn-outline btn-sm" onClick={() => setParams({ job: result.tosJobId })}>View blueprint scan <ArrowRight size={14} /></button></>}</p>}
          {job.type === 'embed' && status === 'done' && <p>{Number(result.chunkCount || 0)} source passages indexed for retrieval.</p>}
          {job.type === 'syllabus_tos' && tosId && <BlueprintResult tosId={tosId} />}
          {job.type === 'generate' && <>
            {running && progress.lastSlot && <p role="status">Processing: {progress.lastSlot.topic} · {BLOOM_LABELS[progress.lastSlot.bloom] || progress.lastSlot.bloom}</p>}
            {status === 'done' && !stats.drafted && <p className="pc-error">This run saved no new questions.{stats.failedSlots.length > 0 ? ' Review the unfilled cells below.' : ' Check the reuse and coverage counts.'}</p>}
            {stats.failedSlots.length > 0 && <section className="pc-shortfalls"><h2>{stats.missingQuestions} {stats.missingQuestions === 1 ? 'question' : 'questions'} still missing from this run</h2><ul>{stats.failedSlots.map((slot, i) => <li key={i}><strong>{slot.topic} · {BLOOM_LABELS[slot.bloom] || slot.bloom}</strong><p>{slot.generated || 0} of {slot.count} saved. {slot.reason}</p></li>)}</ul></section>}
            <div className="pc-result-head">{tosId && <Link className="btn btn-outline btn-sm" to={'/tos/' + tosId}>Open blueprint</Link>}<Link className="btn btn-primary btn-sm" to={'/questions/review' + (job.subject_id ? '?subject_id=' + job.subject_id : '')}>Review drafts <ArrowRight size={15} /></Link></div>
          </>}
          {['failed', 'cancelled'].includes(status) && <p>This task {status === 'failed' ? 'failed' : 'was stopped'}. Any saved work remains available in its subject.</p>}
          {!['generate', 'syllabus_tos', 'extract', 'embed'].includes(job.type) && <p>{LABELS[job.type] || job.type}: {STATES[status] || status}. <Link to="/questions">Open question bank</Link></p>}
          <details className="pc-notes" data-tour="pipe-explanation"><summary>About this run</summary><p>Material reading, blueprint drafting and indexing are separate tasks; related stages show the latest recorded work. A syllabus does not automatically approve a blueprint or create an exam. Each generation cell is one topic and Bloom level and may need several questions. Completion and animation are not accuracy or approval.</p></details>
        </>}
      </section>
      <details className="pc-history" aria-label="Recent processing tasks" data-tour="pipe-history">
        <summary>Recent work <span>{activeCount} active · {jobs.length} recent tasks</span></summary>
        {!loaded && <p role="status">Loading tasks…</p>}
        {loaded && jobs.length === 0 && <p>No tasks yet. <Link to="/materials">Upload a syllabus</Link> to begin.</p>}
        <ol>{jobs.map((item) => <li key={item.id}><button className="pc-history-item" aria-pressed={job?.id === item.id} onClick={() => setParams({ job: item.id })}>
          <span><strong>{LABELS[item.type] || item.type}</strong><em>{STATES[item.status] || item.status}</em></span>
          <span>{item.subject_code || item.subject_name}</span><small>{context(item)}</small><small>{date(item.created_at)}</small>
        </button></li>)}</ol>
      </details>
    </div>
  </AppShell>;
}
