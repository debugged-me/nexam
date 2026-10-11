import '../styles/jobs.css';
/**
 * JobsIndicator — topbar window into the background worker.
 *
 * AI work (material reading, indexing, blueprint drafting, question
 * generation, duplicate checks) runs asynchronously through ai_jobs; before
 * this, the only trace was the "Generation queued" toast and the instructor
 * had no way to tell whether the system was still working or had silently
 * failed. The badge counts live work; the dropdown explains each recent job
 * in plain language, including failures. Rows come from JobsList.jsx so the
 * same feed can render inline on pages.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Loader2 } from 'lucide-react';
import useJobs, { isActiveJob } from '../lib/useJobs.js';
import { JobsRows } from './JobsList.jsx';
import { useToast } from './Toast.jsx';

const TYPE_WORD = {
  generate: 'Generation',
  extract: 'Material processing',
  embed: 'Indexing',
  syllabus_tos: 'Blueprint drafting',
};

function parseResult(result) {
  try { return typeof result === 'string' ? JSON.parse(result) : (result || {}); } catch { return {}; }
}

function subjectOf(job) {
  const s = job.subject_code || job.subject_name;
  return s ? ` for ${s}` : '';
}

/** One toast per finished type+status group — three concurrent generation
 *  runs produce one message, not three. */
function announce(status, type, list, toast) {
  const many = list.length > 1;
  const at = subjectOf(list[0]);
  if (status === 'failed') {
    toast.error(many
      ? `${list.length} ${(TYPE_WORD[type] || 'background').toLowerCase()} tasks failed — open Background work for details.`
      : `${TYPE_WORD[type] || 'Background task'} failed${at}: ${list[0].error || 'the worker reported an error.'}`);
    return;
  }
  if (type === 'generate') {
    const drafted = list.reduce((n, j) => n + (Number(parseResult(j.result).generated) || 0), 0);
    const short = list.reduce((n, j) => n + ((parseResult(j.result).failedSlots || []).length), 0);
    toast.success(
      `${many ? `${list.length} generation runs finished` : 'Generation finished'}${at} — ` +
      `${drafted} question${drafted === 1 ? '' : 's'} drafted${short ? `, ${short} slot${short === 1 ? '' : 's'} unfilled` : ''}. ` +
      `Open Review drafts to approve them.`,
      6500
    );
  } else if (type === 'syllabus_tos') {
    toast.success(`Blueprint draft ready${at} — review and finalize it to generate questions.`, 6000);
  } else if (type === 'extract') {
    toast.success(`Material processed${at}.`);
  } else if (type === 'embed') {
    toast.success(`Material indexed${at} — retrieval is ready.`);
  } else {
    toast.info(`Background task finished${at}.`);
  }
}

export default function JobsIndicator() {
  const { jobs, activeCount, refresh } = useJobs();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const toast = useToast();
  // Toast context is rebuilt each provider render — keep it behind a ref so
  // the watcher effect doesn't re-run on every toast.
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });

  // Completion watcher — the reason multitasking works: a job that was active
  // on the last poll and is done/failed now announces itself wherever the
  // instructor happens to be, not just on the page that queued it. The first
  // snapshot only seeds history (no toasts for work finished before login).
  const seenRef = useRef(null);
  useEffect(() => {
    const now = new Map(jobs.map((j) => [j.id, j]));
    const prev = seenRef.current;
    seenRef.current = now;
    if (!prev) return;

    const finished = [];
    let simWasActive = false;
    let simActive = false;
    prev.forEach((before) => {
      if (before.type === 'similarity' && isActiveJob(before)) simWasActive = true;
    });
    now.forEach((cur) => {
      const before = prev.get(cur.id);
      if (before && isActiveJob(before) && !isActiveJob(cur) && cur.type !== 'similarity') {
        finished.push(cur);
      }
      if (cur.type === 'similarity' && isActiveJob(cur)) simActive = true;
    });

    const groups = new Map();
    for (const job of finished) {
      const key = `${job.type}:${job.status}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(job);
    }
    for (const [key, list] of groups) {
      const [type, status] = key.split(':');
      announce(status, type, list, toastRef.current);
    }

    if (simWasActive && !simActive) {
      const failed = jobs.filter((j) => j.type === 'similarity' && j.status === 'failed').length;
      if (failed) {
        toastRef.current.warning(`Duplicate checks finished — ${failed} could not complete; retry them from the review queue.`);
      } else {
        toastRef.current.success('Duplicate checks finished — new drafts are ready for review.');
      }
    }
  }, [jobs]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('button')?.focus();
      }
    }
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const running = jobs.some((j) => j.status === 'running');

  return (
    <div className="jobs-menu" ref={ref}>
      <button
        className={`jobs-trigger${activeCount > 0 ? ' is-live' : ''}`}
        type="button"
        data-tour="shell-jobs"
        aria-label={activeCount > 0 ? `Background work — ${activeCount} task${activeCount === 1 ? '' : 's'} in progress` : 'Background work'}
        aria-expanded={open}
        title="Background work"
        onClick={() => setOpen((v) => !v)}
      >
        {running ? <Loader2 size={15} className="jobs-spin" /> : <Activity size={15} />}
        {activeCount > 0 && <span className="jobs-badge">{activeCount > 9 ? '9+' : activeCount}</span>}
      </button>
      {open && (
        <div className="jobs-dropdown" role="menu" aria-label="Background work">
          <div className="jobs-dropdown-head">
            <strong>Background work</strong>
            {activeCount > 0 && (
              <span className="jobs-active-note">
                <Loader2 size={12} className="jobs-spin" /> {activeCount} in progress
              </span>
            )}
          </div>
          {jobs.length === 0 ? (
            <p className="jobs-empty">
              Nothing queued. When the system reads materials, drafts questions, or runs duplicate
              checks, each task shows up here while it works.
            </p>
          ) : (
            <JobsRows jobs={jobs} onRefresh={refresh} />
          )}
          <div className="jobs-dropdown-foot">
            <Link to="/questions/review" className="jobs-foot-link" onClick={() => setOpen(false)}>
              Open review queue
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
