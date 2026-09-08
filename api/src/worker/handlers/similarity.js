/**
 * Phase 6 — Semantic similarity checking handler.
 *
 * Receives a job with payload { questionId, userId } and:
 *   1. Embeds the question stem (+ options).
 *   2. Compares cosine similarity vs all status='active' questions in
 *      the same subject.
 *   3. If score >= similarity_threshold, flags the question and writes
 *      similarity_results rows for instructor review.
 *
 * Implemented in Phase 6.
 */
export default async function similarityHandler(job) {
  throw new Error('similarity handler not implemented yet (Phase 6)');
}
