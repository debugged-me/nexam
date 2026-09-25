/**
 * Phase 6 — Semantic similarity checking handler.
 *
 * Receives a job with payload { questionId, userId } and:
 *   1. Loads the question (must be owned by the user).
 *   2. Builds the embed text (stem + options for MCQ + answer).
 *   3. Embeds the text and searches the subject's question vector index.
 *
 * The index only contains ACTIVE (approved) questions — drafts are checked
 * AGAINST the index but are not themselves indexed (they enter the index on
 * approval, via indexQuestionIfActive() in questionIndex.js). Candidates are
 * re-validated in SQL so deleted/draft/rejected vectors can never produce a
 * match even if they linger in the index.
 *
 *   4. If score >= similarity_threshold, flags the question and writes
 *      similarity_results rows for instructor review (routing aid only —
 *      the instructor decides keep/reject).
 *   5. Prunes similarity_results rows that no longer meet the threshold so
 *      stale/contradictory matches don't persist.
 */
import pool from '../../config/db.js';
import { v4 as uuid } from 'uuid';
import { embedQuery, searchQuestionsByVector } from '../../services/vectorStore.js';
import { getNumber } from '../../services/settings.js';

export default async function similarityHandler(job) {
  const { questionId, userId } = job.payload;
  if (!questionId) throw new Error('questionId is required.');

  // Load the question with ownership check
  const [rows] = await pool.query(
    `SELECT * FROM questions WHERE id = :id AND created_by = :userId`,
    { id: questionId, userId }
  );
  const question = rows[0];
  if (!question) throw new Error(`Question ${questionId} not found or not owned.`);

  await pool.query(
    `UPDATE questions SET similarity_checked_at = NULL, similarity_error = NULL WHERE id = :id`,
    { id: questionId }
  );

  // Rejected questions are out of circulation — nothing to check.
  if (question.status === 'rejected') {
    return { questionId, flag: 'rejected', skipped: true };
  }

  // Build the text to embed (stem + options for MCQ + answer)
  let embedText = question.stem;
  if (question.type === 'mcq' && question.options) {
    try {
      const opts = JSON.parse(question.options);
      if (Array.isArray(opts)) embedText += ' ' + opts.join(' ');
    } catch { /* ignore parse errors */ }
  }
  if (question.answer) embedText += ' ' + question.answer;

  // Get the similarity threshold from settings
  const threshold = await getNumber('similarity_threshold', 0.85);

  // Embed the query text (does NOT add the draft to the index) and search
  // the index of active questions.
  const vector = await embedQuery(embedText);
  const rawCandidates = await searchQuestionsByVector(
    question.subject_id,
    vector,
    10,
    questionId
  );

  // SQL-filter: candidates must be real, active questions owned by this user.
  // This drops stale vectors from deleted/draft/rejected questions.
  let candidates = [];
  if (rawCandidates.length) {
    const ids = rawCandidates.map((c) => c.id);
    const [validRows] = await pool.query(
      `SELECT id FROM questions
       WHERE id IN (:ids) AND status = 'active' AND created_by = :userId`,
      { ids, userId }
    );
    const validIds = new Set(validRows.map((r) => r.id));
    candidates = rawCandidates.filter((c) => validIds.has(c.id));
  }

  if (candidates.length === 0) {
    // Nothing to compare against — clear flag + stale results.
    await pool.query(
      `DELETE FROM similarity_results WHERE question_id = :qid`,
      { qid: questionId }
    );
    await pool.query(
      `UPDATE questions SET similarity_flag = 'none', similarity_score = NULL,
                            similarity_checked_at = NOW(), similarity_error = NULL
       WHERE id = :id`,
      { id: questionId }
    );
    return { questionId, flag: 'none', comparisons: 0 };
  }

  // Filter candidates by threshold
  let maxScore = 0;
  const similarPairs = [];

  for (const candidate of candidates) {
    if (candidate.score > maxScore) maxScore = candidate.score;
    if (candidate.score >= threshold) {
      similarPairs.push({
        candidateId: candidate.id,
        score: parseFloat(candidate.score.toFixed(4)),
      });
    }
  }

  // Prune results that are no longer over threshold (stale/contradictory).
  const keepIds = similarPairs.map((p) => p.candidateId);
  if (keepIds.length) {
    await pool.query(
      `DELETE FROM similarity_results
       WHERE question_id = :qid AND similar_question_id NOT IN (:keepIds)`,
      { qid: questionId, keepIds }
    );
  } else {
    await pool.query(
      `DELETE FROM similarity_results WHERE question_id = :qid`,
      { qid: questionId }
    );
  }

  if (similarPairs.length > 0) {
    await pool.query(
      `UPDATE questions SET similarity_flag = 'flagged', similarity_score = :score,
                            similarity_checked_at = NOW(), similarity_error = NULL
       WHERE id = :id`,
      { id: questionId, score: maxScore.toFixed(4) }
    );

    // Write similarity_results rows (unique key on the pair makes this
    // idempotent across re-runs).
    for (const pair of similarPairs) {
      await pool.query(
        `INSERT INTO similarity_results (id, question_id, similar_question_id, score)
         VALUES (:id, :questionId, :candidateId, :score)
         ON DUPLICATE KEY UPDATE score = :score`,
        {
          id: uuid(),
          questionId,
          candidateId: pair.candidateId,
          score: pair.score,
        }
      );
    }

    return {
      questionId,
      flag: 'flagged',
      maxScore: parseFloat(maxScore.toFixed(4)),
      similarCount: similarPairs.length,
    };
  }

  await pool.query(
    `UPDATE questions SET similarity_flag = 'none', similarity_score = :score,
                          similarity_checked_at = NOW(), similarity_error = NULL
     WHERE id = :id`,
    { id: questionId, score: maxScore.toFixed(4) }
  );
  return {
    questionId,
    flag: 'none',
    maxScore: parseFloat(maxScore.toFixed(4)),
    comparisons: candidates.length,
  };
}
