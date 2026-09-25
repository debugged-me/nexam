/**
 * Async job queue backed by the `ai_jobs` MySQL table.
 *
 * PHP enqueues jobs (extract, embed, generate, similarity, syllabus_tos);
 * the Node worker polls and claims them. Using the shared DB as the queue
 * means no extra infra (Redis/BullMQ) is needed for the pilot.
 */
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';

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

/** Mark a job done with an optional result payload. */
export async function markDone(jobId, result = null) {
  await pool.query(
    `UPDATE ai_jobs
     SET status = 'done', result = :result, finished_at = NOW()
     WHERE id = :id`,
    { id: jobId, result: result ? JSON.stringify(result) : null }
  );
}

/** Mark a job failed with an error message; bump retries. */
export async function markFailed(jobId, error) {
  await pool.query(
    `UPDATE ai_jobs
     SET status = CASE WHEN retries >= max_retries - 1 THEN 'failed' ELSE 'queued' END,
         error = :error,
         retries = retries + 1,
         finished_at = CASE WHEN retries >= max_retries - 1 THEN NOW() ELSE finished_at END
     WHERE id = :id`,
    { id: jobId, error: String(error).slice(0, 2000) }
  );
}

/** Get a single job by id. */
export async function getById(jobId) {
  const [rows] = await pool.query(
    `SELECT * FROM ai_jobs WHERE id = :id`,
    { id: jobId }
  );
  return rows[0] || null;
}

/** Recent jobs for a user (for status polling from the UI). */
export async function recentByUser(userId, limit = 20) {
  const [rows] = await pool.query(
    `SELECT id, type, status, error, created_at, started_at, finished_at
     FROM ai_jobs
     WHERE user_id = :userId
     ORDER BY created_at DESC
     LIMIT :limit`,
    { userId, limit }
  );
  return rows;
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

export default { enqueue, claimNext, markDone, markFailed, getById, recentByUser, requeueStaleRunning };
