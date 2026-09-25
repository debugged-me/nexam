import pool from '../src/config/db.js';
import { enqueue } from '../src/services/jobs.js';

const [questions] = await pool.query(
  `SELECT id, subject_id, created_by FROM questions
   WHERE status = 'draft' AND type IN ('mcq','true_false','matching','identification')
     AND similarity_checked_at IS NULL`
);
const [pendingJobs] = await pool.query(
  `SELECT payload FROM ai_jobs WHERE type = 'similarity' AND status IN ('queued','running')`
);
const pendingIds = new Set();
for (const job of pendingJobs) {
  try {
    const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
    if (payload?.questionId) pendingIds.add(payload.questionId);
  } catch { /* malformed historical job cannot cover a question */ }
}

let queued = 0;
for (const question of questions) {
  if (pendingIds.has(question.id)) continue;
  await pool.query(
    `UPDATE questions SET similarity_error = NULL, similarity_flag = 'none' WHERE id = :id`,
    { id: question.id }
  );
  await enqueue({
    type: 'similarity',
    payload: { questionId: question.id, userId: question.created_by },
    userId: question.created_by,
    subjectId: question.subject_id,
  });
  queued++;
}

console.log(JSON.stringify({ uncheckedDrafts: questions.length, alreadyPending: pendingIds.size, queued }, null, 2));
await pool.end();
