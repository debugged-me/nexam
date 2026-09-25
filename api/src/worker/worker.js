/**
 * Async job worker — polls the ai_jobs queue and dispatches to handlers.
 *
 * Runs as a background loop started from server.js. Concurrency is
 * configurable via WORKER_CONCURRENCY. Each iteration claims a job with
 * FOR UPDATE SKIP LOCKED, runs the handler, and marks done/failed.
 *
 * If a handler throws, the job is retried up to max_retries, then marked
 * 'failed' permanently. Retries are re-queued (status flips back to 'queued').
 */
import env from '../config/env.js';
import { claimNext, markDone, markFailed, requeueStaleRunning } from '../services/jobs.js';
import { getHandler } from './handlers.js';
import pool from '../config/db.js';

let running = false;

/** Process a single job. */
async function processJob(job) {
  const handler = getHandler(job.type);
  if (!handler) {
    throw new Error(`No handler registered for job type "${job.type}".`);
  }

  const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
  return handler({ ...job, payload });
}

/** One poll iteration — claim and run up to `concurrency` jobs. */
async function tick() {
  const tasks = [];
  for (let i = 0; i < env.ai.worker.concurrency; i++) {
    tasks.push(
      (async () => {
        const job = await claimNext();
        if (!job) return;
        try {
          const result = await processJob(job);
          await markDone(job.id, result);
        } catch (err) {
          console.error(`[worker] Job ${job.id} (${job.type}) failed:`, err.message);
          if (job.type === 'similarity') {
            try {
              const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
              if (payload?.questionId) {
                await pool.query(
                  `UPDATE questions SET similarity_checked_at = NULL, similarity_error = :error
                   WHERE id = :id`,
                  { id: payload.questionId, error: String(err.message || err).slice(0, 2000) }
                );
              }
            } catch (recordErr) {
              console.error('[worker] Could not record similarity failure:', recordErr.message);
            }
          }
          await markFailed(job.id, err.message);
        }
      })()
    );
  }
  await Promise.allSettled(tasks);
}

/** Main loop — runs until stop() is called. */
async function loop() {
  running = true;
  const recovered = await requeueStaleRunning(15);
  if (recovered) console.warn(`[worker] Re-queued ${recovered} stale interrupted job(s).`);
  console.log(`[worker] Started (poll every ${env.ai.worker.pollInterval}ms, concurrency ${env.ai.worker.concurrency})`);
  while (running) {
    try {
      await tick();
    } catch (err) {
      console.error('[worker] tick error:', err.message);
    }
    await new Promise((r) => setTimeout(r, env.ai.worker.pollInterval));
  }
  console.log('[worker] Stopped.');
}

/** Start the worker loop in the background. */
export function start() {
  if (running) return;
  loop().catch((err) => console.error('[worker] fatal:', err));
}

/** Stop the worker loop (graceful — finishes current tick). */
export function stop() {
  running = false;
}

export default { start, stop };
