/**
 * Phase 6 — Semantic similarity checking handler.
 *
 * Receives a job with payload { questionId, userId } and:
 *   1. Loads the question (must be owned by the user).
 *   2. Builds the embed text (stem + options for MCQ + answer).
 *   3. Adds the question embedding to the subject's question vector
 *      index via LangChain's HNSWLib vector store.
 *   4. Searches the vector index for similar approved questions.
 *   5. If score >= similarity_threshold, flags the question and writes
 *      similarity_results rows for instructor review.
 *
 * The embedding and similarity search are managed by LangChain through
 * the HNSWLib vector store (see vectorStore.js) — no in-memory cosine
 * computation needed.
 */
import pool from '../../config/db.js';
import { addQuestion, searchQuestions } from '../../services/vectorStore.js';

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

  // Build the text to embed (stem + options for MCQ + answer)
  let embedText = question.stem;
  if (question.type === 'mcq' && question.options) {
    try {
      const opts = JSON.parse(question.options);
      if (Array.isArray(opts)) embedText += ' ' + opts.join(' ');
    } catch { /* ignore parse errors */ }
  }
  if (question.answer) embedText += ' ' + question.answer;

  // Add the question embedding to the vector index (LangChain handles embedding)
  await addQuestion(question.subject_id, questionId, embedText);

  // Get the similarity threshold from settings
  const [settings] = await pool.query(
    `SELECT setting_value FROM settings WHERE setting_key = 'similarity_threshold'`
  );
  const threshold = settings.length ? parseFloat(settings[0].setting_value) : 0.85;

  // Search the vector index for similar active questions (excluding this one)
  const candidates = await searchQuestions(
    question.subject_id,
    embedText,
    10,
    questionId
  );

  if (candidates.length === 0) {
    // No other questions in the index — clear any flag
    await pool.query(
      `UPDATE questions SET similarity_flag = 'none', similarity_score = NULL WHERE id = :id`,
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
