/**
 * Phase 3 — Syllabus → TOS auto-generation handler.
 *
 * Receives a job with payload { materialId, userId } and:
 *   1. Loads the syllabus material text.
 *   2. Calls LLM to extract topics, instructional hours, learning outcomes.
 *   3. Computes item weights proportionally.
 *   4. Creates a draft TOS + tos_topics rows for instructor review.
 *
 * Implemented in Phase 3.
 */
export default async function syllabusTosHandler(job) {
  throw new Error('syllabus_tos handler not implemented yet (Phase 3)');
}
