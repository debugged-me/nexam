/**
 * GenerationStream — live panel for a question-generation run.
 *
 *   <GenerationStream jobId={id} reviewHref="/questions/review?subject_id=…"
 *                     onSettled={reload} onDismiss={() => setJobId(null)} />
 *
 * Follows the job over SSE (useJobStream): which matrix cell is being
 * drafted, how far through the blueprint the run is, and each draft the
 * moment the worker stores it. Drafts here are read-only previews; approval
 * happens in the Review Queue, where every grounding and similarity gate
 * still runs.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, Quote, Sparkles, Square, X } from 'lucide-react';
import useJobStream from '../lib/useJobStream.js';
import { cancelJob } from '../lib/useJobs.js';
import { BLOOM_LABELS } from '../lib/insights.js';
import { SPRING_SOFT } from '../lib/motion.js';
import Popover from './Popover.jsx';
import RichText from './RichText.jsx';

const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / False', matching: 'Matching', identification: 'Fill in the blank' };
const BLOOM_LEVEL = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };

/** Options often arrive as "A) text" — the list numbers them already. */
const optionText = (o) => String(o).replace(/^\s*[A-Za-z0-9][).:]\s+/, '');

const HEADLINE = {
  queued: 'Waiting for the AI worker…',
  running: 'Generating questions',
  done: 'Generation finished',
  cancelled: 'Generation stopped',
  failed: 'Generation failed',
};

function DraftPeek({ draft }) {
  const options = Array.isArray(draft.options) ? draft.options : [];
  return (
    <div className="gs-peek">
      <RichText as="p" className="gs-peek-stem" text={draft.stem} />
      {options.length > 0 && (
        <ol className="gs-peek-options" type={draft.type === 'matching' ? '1' : 'A'}>
          {options.map((o, i) => <li key={i}><RichText text={optionText(o)} /></li>)}
        </ol>
      )}
      {draft.answer && <p className="gs-peek-answer"><strong>Answer:</strong> {draft.answer}</p>}
      {draft.evidence && (
        <blockquote className="gs-peek-evidence">
          <Quote size={11} aria-hidden="true" /> {draft.evidence}
        </blockquote>
      )}
      <p className="gs-peek-note">
        {draft.grounding === 'knowledge'
          ? 'Draft from AI knowledge, not your materials — confirm the answer when you approve it in the Review Queue.'
          : 'Draft — approve or edit it in the Review Queue.'}
      </p>
    </div>
  );
}

export default function GenerationStream({ jobId, reviewHref, onSettled, onDismiss }) {
  const feed = useJobStream(jobId);
  const { status, progress, result, drafts } = feed;
  const active = status === 'queued' || status === 'running' || (!status && !feed.ended);

  // Tell the page once the run settles so its matrix counts refresh.
  const settledRef = useRef(false);
  useEffect(() => {
    if (feed.ended && !settledRef.current) {
      settledRef.current = true;
      onSettled?.(status);
    }
  }, [feed.ended, status, onSettled]);

  const total = Number(progress?.slotsTotal) || 0;
  const done = status === 'done' ? total : Number(progress?.slotsDone) || 0;
  const pct = status === 'done' ? 100 : total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const slot = progress?.lastSlot;
  const failedSlots = Array.isArray(result?.failedSlots) ? result.failedSlots : [];

  const knowledgeDrafts = Number(result?.knowledgeDrafted) || drafts.filter((d) => d.grounding === 'knowledge').length;
  const counts = [
    drafts.length && `${drafts.length} drafted`,
    knowledgeDrafts > 0 && `${knowledgeDrafts} from AI knowledge — confirm their answers`,
    Number(progress?.adopted ?? result?.adopted) > 0 && `${progress?.adopted ?? result?.adopted} reused from the bank`,
    Number(progress?.skipped ?? result?.skippedCells) > 0 && `${progress?.skipped ?? result?.skippedCells} cells already covered`,
  ].filter(Boolean);

  return (
    <section className="gs card" data-status={status || 'connecting'} aria-label="Question generation">
      <header className="gs-head">
        <span className="gs-icon" aria-hidden="true">
          {status === 'done' ? <CheckCircle2 size={18} />
            : status === 'failed' || status === 'cancelled' ? <AlertTriangle size={18} />
            : <Sparkles size={18} />}
        </span>
        <div className="gs-title">
          <strong>{HEADLINE[status] || 'Connecting…'}</strong>
          <span className="gs-sub" aria-live="polite">
            {active && slot
              ? <>Drafting <b>{slot.topic}</b> · {BLOOM_LABELS[slot.bloom] || slot.bloom}{total ? ` · cell ${Math.min(done + 1, total)} of ${total}` : ''}</>
              : active ? 'Preparing the blueprint matrix…'
              : status === 'failed' ? (feed.error || 'The run stopped with an error. Drafts already stored are kept.')
              : counts.length ? counts.join(' · ')
              : failedSlots.length ? `No drafts saved — ${failedSlots.length} cell${failedSlots.length === 1 ? '' : 's'} could not be supported. See why below.`
              : 'No new drafts were needed.'}
          </span>
        </div>
        <div className="gs-actions">
          {active ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => cancelJob(jobId).catch(() => {})}>
              <Square size={13} /> Stop
            </button>
          ) : (
            <button type="button" className="gs-close" onClick={onDismiss} aria-label="Dismiss generation panel">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      <div
        className="gs-bar"
        role="progressbar"
        aria-label="Blueprint cells processed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        data-indeterminate={active && !total ? 'true' : undefined}
      >
        <i style={{ width: `${active && !total ? 30 : pct}%` }} />
      </div>
      {active && counts.length > 0 && <p className="gs-counts">{counts.join(' · ')}</p>}

      {drafts.length > 0 && (
        <ol className="gs-list">
          <AnimatePresence initial={false}>
            {[...drafts].reverse().map((d) => (
              <motion.li
                key={d.id}
                className="gs-item"
                layout="position"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING_SOFT}
              >
                <div className="gs-item-meta">
                  <span className="gs-chip">{TYPE_LABELS[d.type] || d.type}</span>
                  {d.bloom && <span className="g-bloom" data-level={BLOOM_LEVEL[d.bloom] || 1}>{BLOOM_LABELS[d.bloom] || d.bloom}</span>}
                  {d.topic && <span className="gs-topic">{d.topic}</span>}
                </div>
                <RichText as="p" className="gs-stem" text={d.stem} />
                <Popover
                  label="Draft preview"
                  align="end"
                  className="gs-pop"
                  trigger={(
                    <button type="button" className="gs-peek-btn" aria-label="Preview this draft">
                      <Eye size={15} />
                    </button>
                  )}
                >
                  <DraftPeek draft={d} />
                </Popover>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}

      {!active && failedSlots.length > 0 && (
        <details className="gs-failed" open={!drafts.length}>
          <summary>{failedSlots.length} cell{failedSlots.length === 1 ? '' : 's'} could not be filled</summary>
          <ul>
            {failedSlots.map((f, i) => (
              <li key={i}><b>{f.topic}</b> · {BLOOM_LABELS[f.bloom] || f.bloom} — {f.reason}</li>
            ))}
          </ul>
        </details>
      )}

      {drafts.length > 0 && reviewHref && (
        <footer className="gs-foot">
          <span>Drafts stay unapproved until you review them.</span>
          <Link to={reviewHref} className="btn btn-primary btn-sm">
            Review {drafts.length} draft{drafts.length === 1 ? '' : 's'} <ArrowRight size={14} />
          </Link>
        </footer>
      )}
    </section>
  );
}
