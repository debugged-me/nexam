/**
 * Phase 2 — Chunking + embedding handler.
 *
 * Receives a job with payload { materialId } and:
 *   1. Loads processed material text.
 *   2. Splits into token-aware chunks.
 *   3. Embeds each chunk via Gemini.
 *   4. Stores chunks + embeddings in material_chunks.
 *
 * Implemented in Phase 2.
 */
export default async function embedHandler(job) {
  throw new Error('embed handler not implemented yet (Phase 2)');
}
