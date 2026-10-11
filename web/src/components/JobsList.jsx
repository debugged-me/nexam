/**
 * JobsList — shared rendering for ai_jobs rows, used by the topbar
 * JobsIndicator dropdown and by the inline JobsActivityPanel on pages. The
 * panel also ticks a clock so elapsed times visibly move — the point of the
 * feature is that the instructor can watch the system work.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Ban, CircleCheck, Clock, Loader2, Square } from 'lucide-react';
import { cancelJob, isActiveJob } from '../lib/useJobs.js';
import { useToast } from './Toast.jsx';

const TYPE_LABELS = {
  extract: 'Reading material',
  embed: 'Indexing material',
  syllabus_tos: 'Drafting blueprint',
  generate: 'Generating questions',
  similarity: 'Duplicate checks',
};

const STATUS_META = {
  queued: { label: 'Queued', Icon: Clock, cls: 'is-queued' },
  running: { label: 'Working', Icon: Loader2, cls: 'is-running' },
  done: { label: 'Done', Icon: CircleCheck, cls: 'is-done' },
  failed: { label: 'Failed', Icon: AlertTriangle, cls: 'is-failed' },
  cancelled: { label: 'Stopped', Icon: Ban, cls: 'is-cancelled' },
};

function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Unknown', Icon: Clock, cls: 'is-queued' };
}

/** Human summary of a finished job's result payload, where one exists. */
function resultSummary(job) {
  if (!job || job.status !== 'done' || !job.result) return '';
  try {
    const r = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
    if (job.type === 'generate') {
      const parts = [];
      if (Number.isFinite(r?.generated)) parts.push(`${r.generated} drafted`);
      const skipped = Number(r?.skippedCells || 0);
      if (skipped) parts.push(`${skipped} cell${skipped === 1 ? '' : 's'} already filled`);
      const short = Array.isArray(r?.failedSlots) ? r.failedSlots.length : 0;
      if (short) parts.push(`${short} slot${short === 1 ? '' : 's'} unfilled`);
      return parts.join(' · ');
    }
  } catch { /* fall through to no summary */ }
  return '';
}

function timeAgo(value, now) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.max(0, Math.round(((now ?? Date.now()) - d.getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function subjectLabel(job) {
  return job.subject_code || job.subject_name || '';
}

/** What the job is working on — blueprint title, material title, or subject. */
function contextOf(job) {
  return job.tos_title || job.material_title || subjectLabel(job);
}

/** Live progress blob the worker writes while status='running' (generate). */
function progressOf(job) {
  if (!job || job.status !== 'running' || !job.progress) return null;
  try {
    const p = typeof job.progress === 'string' ? JSON.parse(job.progress) : job.progress;
    if (p && Number.isFinite(p.slotsDone) && Number.isFinite(p.slotsTotal)) return p;
  } catch { /* malformed progress — treat as none */ }
  return null;
}

function cap(s) {
  const v = String(s || '');
  return v ? v[0].toUpperCase() + v.slice(1) : v;
}

/** The "what it is doing" line under each row. */
function detailOf(job, now) {
  if (job.status === 'failed') return job.error || 'The worker reported an error.';
  const ctx = contextOf(job);
  const prog = progressOf(job);
  if (prog) {
    const slot = prog.phase === 'saving'
      ? `saving ${prog.drafted ?? 0} drafts…`
      : [
          `slot ${Math.min(prog.slotsDone + 1, prog.slotsTotal)} of ${prog.slotsTotal}`,
          prog.lastSlot?.topic
            ? `${prog.lastSlot.topic}${prog.lastSlot.bloom ? ` (${cap(prog.lastSlot.bloom)})` : ''}`
            : null,
          `${prog.drafted ?? 0} drafted so far`,
        ].filter(Boolean).join(' — ');
    return [ctx, slot, `started ${timeAgo(job.started_at, now)}`].filter(Boolean).join(' · ');
  }
  if (job.status === 'running') {
    return [ctx, `started ${timeAgo(job.started_at, now)}`].filter(Boolean).join(' · ');
  }
  if (job.status === 'queued') {
    return [ctx, `queued ${timeAgo(job.created_at, now)}`].filter(Boolean).join(' · ');
  }
  return [ctx, resultSummary(job), timeAgo(job.finished_at, now)].filter(Boolean).join(' · ');
}

/**
 * Rows for display. Generation enqueues one similarity job per draft, so
 * listing them raw would bury the meaningful rows — they collapse into a
 * single aggregate row at the position of the newest one.
 */
function buildJobRows(jobs) {
  const rows = [];
  let similarityRow = null;
  for (const job of jobs) {
    if (job.type === 'similarity') {
      if (!similarityRow) {
        similarityRow = { kind: 'similarity', jobs: [] };
        rows.push(similarityRow);
      }
      similarityRow.jobs.push(job);
    } else {
      rows.push({ kind: 'job', job });
    }
  }
  return rows;
}

function JobRow({ job, now, onRefresh }) {
  const meta = statusMeta(job.status);
  const Icon = meta.Icon;
  const toast = useToast();
  const [stopping, setStopping] = useState(false);
  const prog = progressOf(job);
  const pct = prog && prog.slotsTotal ? Math.min(100, Math.round((prog.slotsDone / prog.slotsTotal) * 100)) : 0;

  async function stop() {
    if (stopping) return;
    setStopping(true);
    try {
      await cancelJob(job.id);
      toast.info('Task stopped — anything it already finished is kept.');
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Could not stop that task.');
    } finally {
      setStopping(false);
    }
  }

  return (
    <li className={`jobs-row ${meta.cls}`}>
      <span className="jobs-row-icon"><Icon size={15} className={job.status === 'running' ? 'jobs-spin' : ''} /></span>
      <span className="jobs-row-main">
        <span className="jobs-row-title">
          {TYPE_LABELS[job.type] || job.type}
          <em className={`jobs-status ${meta.cls}`}>{meta.label}</em>
        </span>
        <span className="jobs-row-detail">{detailOf(job, now)}</span>
        {prog && (
          <span className="jobs-row-bar" role="progressbar" aria-valuemin={0} aria-valuemax={prog.slotsTotal} aria-valuenow={prog.slotsDone}>
            <span style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>
      {isActiveJob(job) && (
        <button
          type="button"
          className="jobs-stop"
          onClick={stop}
          disabled={stopping}
          title="Stop this task — finished work is kept"
          aria-label="Stop this task"
        >
          <Square size={12} />
        </button>
      )}
    </li>
  );
}

function SimilarityRow({ jobs }) {
  const active = jobs.filter(isActiveJob).length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const meta = active ? statusMeta('running') : failed ? statusMeta('failed') : statusMeta('done');
  const Icon = meta.Icon;
  const detail = active
    ? `${active} in progress — new drafts unlock as each check finishes`
    : failed
      ? `${failed} check${failed === 1 ? '' : 's'} failed — drafts can be retried from the review queue`
      : 'All checks finished';
  return (
    <li className={`jobs-row ${meta.cls}`}>
      <span className="jobs-row-icon"><Icon size={15} className={active ? 'jobs-spin' : ''} /></span>
      <span className="jobs-row-main">
        <span className="jobs-row-title">
          {TYPE_LABELS.similarity}
          <em className={`jobs-status ${meta.cls}`}>{meta.label}</em>
        </span>
        <span className="jobs-row-detail">{detail}</span>
      </span>
    </li>
  );
}

/** Row list shared by the dropdown and the inline panel. */
export function JobsRows({ jobs, limit = 10, now, onRefresh }) {
  const rows = buildJobRows(jobs).slice(0, limit);
  return (
    <ul className="jobs-list">
      {rows.map((row) => row.kind === 'similarity'
        ? <SimilarityRow key="similarity" jobs={row.jobs} />
        : <JobRow key={row.job.id} job={row.job} now={now} onRefresh={onRefresh} />)}
    </ul>
  );
}

/**
 * Inline "live preview" card for pages — the same worker feed the topbar
 * dropdown shows, rendered in place so an empty screen can explain that the
 * system is mid-task. `now` ticks every few seconds so elapsed times move.
 */
export function JobsActivityPanel({ jobs, activeCount, title, onRefresh, children }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="jobs-panel" aria-label="Background work in progress">
      <div className="jobs-panel-head">
        <span className="jobs-panel-live"><span className="jobs-live-dot" aria-hidden="true" /> Live</span>
        <div className="jobs-panel-heading">
          <strong>{title || 'Working in the background'}</strong>
          <span>
            {activeCount} task{activeCount === 1 ? '' : 's'} in progress — this page updates on its own.
          </span>
        </div>
      </div>
      <JobsRows jobs={jobs} now={now} onRefresh={onRefresh} />
      {children && <div className="jobs-panel-actions">{children}</div>}
    </section>
  );
}
