/**
 * useJobs — polls GET /api/ai/jobs so the interface can show what the
 * background worker is doing (material extraction, indexing, blueprint
 * drafting, question generation, duplicate checks) instead of letting jobs
 * vanish behind a toast.
 *
 * Polls on a short interval while anything is queued or running and a slow
 * one when idle, with `quiet` requests so the topbar busy spinner is not
 * churned by background polling. `activeCount` comes from the server — a
 * finished generation can enqueue enough similarity jobs to push still-active
 * work past the returned window, so the row list alone is not a safe count.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import api from './api.js';

const ACTIVE_STATUSES = new Set(['queued', 'running']);
const JOBS_PATH = '/ai/jobs';

export function isActiveJob(job) {
  return !!job && ACTIVE_STATUSES.has(job.status);
}

/** Parsed payload of a job row (`payload` crosses the wire as a JSON string). */
export function jobPayload(job) {
  try {
    return typeof job?.payload === 'string' ? JSON.parse(job.payload) : (job?.payload || {});
  } catch {
    return {};
  }
}

/** Ask the worker to stop a queued or running job. */
export function cancelJob(jobId) {
  return api.post(`/ai/jobs/${jobId}/cancel`);
}

export default function useJobs({ activeInterval = 4000, idleInterval = 20000, enabled = true } = {}) {
  const [snapshot, setSnapshot] = useState(() => {
    const cached = api.peek(JOBS_PATH);
    return {
      jobs: cached?.jobs ?? [],
      activeCount: Number(cached?.activeCount ?? 0),
      loaded: !!cached,
    };
  });
  // Latest known active count, kept so a failed poll still schedules the
  // next one at the right cadence. Written inside callbacks, never in render.
  const activeRef = useRef(snapshot.activeCount);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get(JOBS_PATH, { quiet: true });
      const jobs = data?.jobs || [];
      const activeCount = Number.isFinite(data?.activeCount)
        ? Number(data.activeCount)
        : jobs.filter(isActiveJob).length;
      activeRef.current = activeCount;
      setSnapshot({ jobs, activeCount, loaded: true });
      return { jobs, activeCount };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    let stopped = false;
    const tick = async () => {
      const next = await refresh();
      if (stopped) return;
      const active = next ? next.activeCount > 0 : activeRef.current > 0;
      timer = setTimeout(tick, active ? activeInterval : idleInterval);
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, activeInterval, idleInterval, refresh]);

  return { ...snapshot, refresh };
}
