/**
 * Phase 4 — RAG question generation handler.
 *
 * Receives a job with payload { tosId, userId } and:
 *   1. Loads the TOS + topics + bloom allocation.
 *   2. For each (topic, bloom, count) slot, retrieves top-k chunks from
 *      material_chunks WHERE subject_id = tos.subject_id (RAG grounding).
 *   3. Calls LLM to generate questions grounded ONLY in retrieved chunks.
 *   4. Stores draft questions with status='draft', source='ai', tos_id,
 *      and generation_meta (chunk ids, model, prompt hash).
 *   5. Enqueues a similarity job for each new question.
 *
 * Implemented in Phase 4.
 */
export default async function generateHandler(job) {
  throw new Error('generate handler not implemented yet (Phase 4)');
}
