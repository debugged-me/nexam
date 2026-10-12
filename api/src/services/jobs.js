/**
 * Async job queue backed by the `ai_jobs` MySQL table.
 *
 * PHP enqueues jobs (extract, embed, generate, similarity, syllabus_tos);
 * the Node worker polls and claims them. Using the shared DB as the queue
 * means no extra infra (Redis/BullMQ) is needed for the pilot.
 */
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';
import { publishJobEvent } from './jobEvents.js';

/**
 * Enqueue a job.
 *
 * @param {object} params
 * @param {string} params.type — extract|embed|generate|similarity|syllabus_tos
 * @param {object} params.payload — JSON-serializable job parameters
 * @param {string} [params.userId]
 * @param {string} [params.subjectId]
 * @param {number} [params.priority] — lower runs first (default 0)
 * @returns {Promise<string>} job id
 */
export async function enqueue({ type, payload, userId = null, subjectId = null, priority = 0 }) {
  const id = uuid();
  await pool.query(
    `INSERT INTO ai_jobs (id, type, status, priority, payload, user_id, subject_id)
     VALUES (:id, :type, 'queued', :priority, :payload, :userId, :subjectId)`,
    {
      id,
      type,
      payload: JSON.stringify(payload || {}),
      priority,
      userId,
      subjectId,
    }
  );
  return id;
}

/**
 * Atomically claim the next queued job.
 * Uses UPDATE ... SET status='running' WHERE status='queued' to claim
 * a job without SKIP LOCKED (not supported by MariaDB/MySQL < 8.0).
 * Marks it 'running' and returns its row.
 *
 * @returns {Promise<object|null>}
 */
export async function claimNext() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id FROM ai_jobs
       WHERE status = 'queued'
       ORDER BY priority ASC, created_at ASC
       LIMIT 1
       FOR UPDATE`
    );
    if (!rows.length) {
      await conn.commit();
      return null;
    }
    const jobId = rows[0].id;
    await conn.query(
      `UPDATE ai_jobs SET status = 'running', started_at = NOW() WHERE id = :id`,
      { id: jobId }
    );
    await conn.commit();

    // Fetch the full row outside the transaction (no lock needed).
    const [full] = await pool.query(`SELECT * FROM ai_jobs WHERE id = :id`, { id: jobId });
    return full[0] || null;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Live progress blob written by a running handler (e.g. which slot of the
 * blueprint matrix is being drafted). Read by the UI's jobs feed so an
 * instructor can see what the system is doing, not just that it is busy.
 */
export async function updateProgress(jobId, progress) {
  await pool.query(
    `UPDATE ai_jobs SET progress = :progress WHERE id = :id AND status = 'running'`,
    { id: jobId, progress: JSON.stringify(progress) }
  );
  publishJobEvent(jobId, { kind: 'progress', progress });
}

/**
 * Mark a job done with an optional result payload.
 * Only fires while the row is still 'running' — a job cancelled mid-run keeps
 * its 'cancelled' status instead of being flipped to 'done'.
 */
export async function markDone(jobId, result = null) {
  await pool.query(
    `UPDATE ai_jobs
     SET status = 'done', result = :result, progress = NULL, finished_at = NOW()
     WHERE id = :id AND status = 'running'`,
    { id: jobId, result: result ? JSON.stringify(result) : null }
  );
  publishJobEvent(jobId, { kind: 'status' });
}

/** Mark a job failed with an error message; bump retries. */
export async function markFailed(jobId, error) {
  await pool.query(
    `UPDATE ai_jobs
     SET status = CASE WHEN retries >= max_retries - 1 THEN 'failed' ELSE 'queued' END,
         error = :error,
         progress = NULL,
         retries = retries + 1,
         finished_at = CASE WHEN retries >= max_retries - 1 THEN NOW() ELSE finished_at END
     WHERE id = :id AND status IN ('queued', 'running')`,
    { id: jobId, error: String(error).slice(0, 2000) }
  );
  publishJobEvent(jobId, { kind: 'status' });
}

/** True once a user has cancelled the job (status = 'cancelled'). */
export async function isCancelled(jobId) {
  const [rows] = await pool.query(
    `SELECT status FROM ai_jobs WHERE id = :id`,
    { id: jobId }
  );
  return rows[0]?.status === 'cancelled';
}

/**
 * Persist a partial result on a cancelled job — markDone is a no-op there by
 * design, so a cooperative handler that stops early saves its own summary.
 */
export async function markStopped(jobId, result = null) {
  await pool.query(
    `UPDATE ai_jobs SET result = :result WHERE id = :id AND status = 'cancelled'`,
    { id: jobId, result: result ? JSON.stringify(result) : null }
  );
  publishJobEvent(jobId, { kind: 'status' });
}

/**
 * Translate a raw worker/provider error into something an instructor can act
 * on. The raw text stays in ai_jobs.error for debugging — this only runs when
 * a job is read back out for the client.
 */
/** Human phrasing for a remaining wait duration. */
function formatWait(ms) {
  if (ms < 60e3) return 'under a minute';
  const mins = Math.ceil(ms / 60e3);
  if (mins < 60) return `about ${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem
    ? `about ${hours} hour${hours === 1 ? '' : 's'} ${rem} minute${rem === 1 ? '' : 's'}`
    : `about ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function friendlyJobError(raw, anchorTime) {
  const msg = String(raw || '').trim();
  if (!msg) return 'The task failed — please try again.';

  // Provider errors often arrive as "<status> {json}" — extract the JSON body.
  let providerMsg = '';
  const jsonMatch = msg.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { providerMsg = String(JSON.parse(jsonMatch[0])?.error?.message || ''); }
    catch { /* keep raw */ }
  }
  const hay = `${msg} ${providerMsg}`;

  if (/\b429\b|rate.?limit|tokens per|requests per|\bTPD\b|\bTPM\b/i.test(hay)) {
    // The provider embeds a retry window measured from when the call failed.
    // Anchor it to the job's failure timestamp so the message counts down on
    // each poll instead of repeating the stale window forever.
    let waitMs = null;
    const retry = providerMsg.match(
      /try again in\s+(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?)?/i
    );
    if (retry && (retry[1] || retry[2] || retry[3])) {
      waitMs = Number(retry[1] || 0) * 3600e3
        + Number(retry[2] || 0) * 60e3
        + Number(retry[3] || 0) * 1e3;
    }

    let wait = waitMs != null ? formatWait(waitMs) : 'a few minutes';
    if (waitMs != null && anchorTime) {
      const anchor = new Date(anchorTime).getTime();
      if (Number.isFinite(anchor)) {
        const remaining = anchor + waitMs - Date.now();
        if (remaining <= 0) {
          return 'The AI service hit its usage limit — the wait is over, you can try again now. Anything already generated was saved, so re-running only fills what is missing.';
        }
        wait = formatWait(remaining);
      }
    }
    return `The AI service hit its usage limit — try again in ${wait}. Anything already generated was saved, so re-running only fills what is missing.`;
  }
  if (/invalid_api_key|incorrect api key|unauthorized|forbidden|\b401\b|\b403\b/i.test(hay)) {
    return 'The AI provider rejected the configured credentials — ask an administrator to check the AI settings.';
  }
  if (/context.?length|maximum context|too many tokens|reduce the length/i.test(hay)) {
    return 'A section of material was too large for the AI model — try smaller source files.';
  }
  if (/timeout|timed out|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENETUNREACH|fetch failed|socket hang|\b50[234]\b/i.test(hay)) {
    return 'The AI service could not be reached — check the connection and try again shortly.';
  }
  // Short, plain-language errors are safe to show as-is.
  if (msg.length <= 160 && !/[{}]|https?:\/\/|org_/.test(msg)) return msg.split('\n')[0];
  return 'Something went wrong while running this task — please try again.';
}

/** Sanitize the user-facing error field on a job row in place. */
function withFriendlyError(job) {
  if (!job || !job.error) return job;
  const anchor = job.finished_at || job.started_at || job.created_at;
  return { ...job, error: friendlyJobError(job.error, anchor) };
}

/** Get a single job by id. */
export async function getById(jobId) {
  const [rows] = await pool.query(
    `SELECT * FROM ai_jobs WHERE id = :id`,
    { id: jobId }
  );
  return withFriendlyError(rows[0]) || null;
}

/** Recent jobs for a user (for status polling from the UI). */
export async function recentByUser(userId, limit = 20) {
  const [rows] = await pool.query(
    `SELECT j.id, j.type, j.status, j.error, j.result, j.payload, j.progress, j.subject_id,
            j.created_at, j.started_at, j.finished_at,
            s.name AS subject_name, s.code AS subject_code,
            t.title AS tos_title,
            m.title AS material_title
     FROM ai_jobs j
     LEFT JOIN subjects s ON s.id = j.subject_id
     LEFT JOIN tos t ON t.id = CASE WHEN JSON_VALID(j.payload)
       THEN JSON_UNQUOTE(JSON_EXTRACT(j.payload, '$.tosId')) END
     LEFT JOIN materials m ON m.id = CASE WHEN JSON_VALID(j.payload)
       THEN JSON_UNQUOTE(JSON_EXTRACT(j.payload, '$.materialId')) END
     WHERE j.user_id = :userId
     ORDER BY j.created_at DESC
     LIMIT :limit`,
    { userId, limit }
  );
  return rows.map(withFriendlyError);
}

/**
 * Jobs still waiting on or held by the worker. The recent list above is a
 * window — a finished generation can enqueue dozens of similarity jobs and
 * push still-active work past it — so the badge count is queried separately.
 */
export async function countActive(userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM ai_jobs
     WHERE user_id = :userId AND status IN ('queued', 'running')`,
    { userId }
  );
  return Number(rows[0]?.n || 0);
}

/**
 * True when a job of `type` whose payload satisfies `match` is queued or
 * running. Used to refuse a second generation run for the same blueprint —
 * two identical runs would just produce two parallel batches of duplicates.
 */
export async function hasActiveJob(type, match) {
  const [rows] = await pool.query(
    `SELECT payload FROM ai_jobs WHERE type = :type AND status IN ('queued', 'running')`,
    { type }
  );
  return rows.some((r) => {
    try {
      const p = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
      return match(p || {});
    } catch {
      return false;
    }
  });
}

/** Return orphaned running jobs to the queue after an interrupted worker. */
export async function requeueStaleRunning(maxAgeMinutes = 15) {
  const [result] = await pool.query(
    `UPDATE ai_jobs SET status = 'queued', started_at = NULL
     WHERE status = 'running'
       AND TIMESTAMPDIFF(MINUTE, started_at, NOW()) >= :minutes`,
    { minutes: Math.max(1, Number(maxAgeMinutes) || 15) }
  );
  return result.affectedRows;
}

export default { enqueue, claimNext, markDone, markFailed, getById, recentByUser, countActive, hasActiveJob, updateProgress, isCancelled, markStopped, requeueStaleRunning, friendlyJobError };
