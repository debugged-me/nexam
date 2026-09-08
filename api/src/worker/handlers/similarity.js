/**
 * Phase 6 — Semantic similarity checking handler.
 *
 * Receives a job with payload { questionId, userId } and:
 *   1. Loads the question (must be owned by the user).
 *   2. Embeds the question stem (+ options for MCQ).
 *   3. Compares cosine similarity vs all status='active' questions in
 *      the same subject.
 *   4. If score >= similarity_threshold, flags the question and writes
 *      similarity_results rows for instructor review.
 *   5. Stores the embedding on the question row for future comparisons.
 */
import pool from '../../config/db.js';
import { embed } from '../../services/aiProvider.js';

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

  // Build the text to embed (stem + options for MCQ)
  let embedText = question.stem;
  if (question.type === 'mcq' && question.options) {
    try {
      const opts = JSON.parse(question.options);
      if (Array.isArray(opts)) embedText += ' ' + opts.join(' ');
    } catch { /* ignore parse errors */ }
  }
  if (question.answer) embedText += ' ' + question.answer;

  // Embed the question
  const { embedding } = await embed(embedText);

  // Store the embedding on the question
  await pool.query(
    `UPDATE questions SET embedding = :embedding WHERE id = :id`,
    { id: questionId, embedding: JSON.stringify(embedding) }
  );

  // Get the similarity threshold from settings
  const [settings] = await pool.query(
    `SELECT setting_value FROM settings WHERE setting_key = 'similarity_threshold'`
  );
  const threshold = settings.length ? parseFloat(settings[0].setting_value) : 0.85;

  // Load all active questions in the same subject (excluding this one)
  const [candidates] = await pool.query(
    `SELECT id, stem, options, answer, embedding
     FROM questions
     WHERE subject_id = :subjectId
       AND status = 'active'
       AND id != :questionId
       AND embedding IS NOT NULL`,
    { subjectId: question.subject_id, questionId }
  );

  if (candidates.length === 0) {
    // No active questions to compare against — clear any flag
    await pool.query(
      `UPDATE questions SET similarity_flag = 'none', similarity_score = NULL WHERE id = :id`,
      { id: questionId }
    );
    return { questionId, flag: 'none', comparisons: 0 };
  }

  // Compute cosine similarity against each candidate
  let maxScore = 0;
  let similarPairs = [];

  for (const candidate of candidates) {
    let candidateVec;
    try {
      candidateVec = JSON.parse(candidate.embedding);
    } catch {
      continue; // skip invalid embeddings
    }

    const score = cosineSimilarity(embedding, candidateVec);
    if (score > maxScore) maxScore = score;
    if (score >= threshold) {
      similarPairs.push({
        candidateId: candidate.id,
        score: parseFloat(score.toFixed(4)),
      });
    }
  }

  // Flag the question if any similar pairs found
  if (similarPairs.length > 0) {
    await pool.query(
      `UPDATE questions SET similarity_flag = 'flagged', similarity_score = :score WHERE id = :id`,
      { id: questionId, score: maxScore.toFixed(4) }
    );

    // Write similarity_results rows
    for (const pair of similarPairs) {
      await pool.query(
        `INSERT INTO similarity_results (question_id, similar_question_id, score)
         VALUES (:questionId, :candidateId, :score)
         ON DUPLICATE KEY UPDATE score = :score`,
        {
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
  } else {
    await pool.query(
      `UPDATE questions SET similarity_flag = 'none', similarity_score = :score WHERE id = :id`,
      { id: questionId, score: maxScore.toFixed(4) }
    );
    return {
      questionId,
      flag: 'none',
      maxScore: parseFloat(maxScore.toFixed(4)),
      comparisons: candidates.length,
    };
  }
}

/** Cosine similarity between two vectors. */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
