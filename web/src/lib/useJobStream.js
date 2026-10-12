/**
 * useJobStream — live feed of one AI job from GET /ai/jobs/:id/stream.
 *
 *   const feed = useJobStream(jobId);
 *   feed.status    // queued | running | done | failed | cancelled
 *   feed.progress  // { slotsDone, slotsTotal, drafted, lastSlot, … } — last known
 *   feed.drafts    // questions the run has stored so far, in arrival order
 *   feed.result    // final summary once the job ends
 *   feed.ended     // the server closed the stream on a terminal status
 *
 * A dropped connection (sleep, proxy restart) retries with backoff while the
 * job is still active; the server replays the run's stored drafts on every
 * connect, so nothing is missed. Auth failures and unknown jobs stop retrying.
 */
import { useEffect, useState } from 'react';
import api from './api.js';

const EMPTY = {
  status: null, progress: null, result: null, error: null,
  drafts: [], connected: false, ended: false,
};
const FATAL = new Set([401, 403, 404]);

/** Feed state for `jobId`, discarding anything left from a previous job. */
const forJob = (feed, jobId) => (feed.jobId === jobId ? feed : { ...EMPTY, jobId });

export default function useJobStream(jobId) {
  const [feed, setFeed] = useState(() => ({ ...EMPTY, jobId }));

  useEffect(() => {
    if (!jobId) return undefined;
    const controller = new AbortController();
    let attempt = 0;
    let ended = false;
    let timer = null;
    const update = (fn) => setFeed((f) => fn(forJob(f, jobId)));

    const connect = async () => {
      try {
        await api.stream(`/ai/jobs/${encodeURIComponent(jobId)}/stream`, {
          signal: controller.signal,
          onEvent: (event, data) => {
            attempt = 0;
            if (event === 'state') {
              // The row's progress clears when a run ends — keep the last
              // known one so a stopped run still shows how far it got.
              update((f) => ({ ...f, ...data, progress: data.progress || f.progress, connected: true }));
            } else if (event === 'drafts') {
              update((f) => {
                const seen = new Set(f.drafts.map((d) => d.id));
                const fresh = (data.items || []).filter((d) => !seen.has(d.id));
                return fresh.length ? { ...f, drafts: [...f.drafts, ...fresh] } : f;
              });
            } else if (event === 'end') {
              ended = true;
              update((f) => ({ ...f, ended: true, connected: false }));
            }
          },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (FATAL.has(err?.status)) {
          ended = true;
          update((f) => ({ ...f, ended: true, connected: false, error: err.message }));
          return;
        }
      }
      if (controller.signal.aborted || ended) return;
      attempt += 1;
      update((f) => ({ ...f, connected: false }));
      timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(attempt, 4)));
    };

    connect();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId]);

  return forJob(feed, jobId);
}
