/**
 * Phase 2 — Chunking + embedding handler.
 *
 * Receives a job with payload { materialId } and:
 *   1. Loads the processed material text.
 *   2. Splits into token-aware chunks (chunker.js).
 *   3. Embeds each chunk via Gemini (aiProvider.embedBatch).
 *   4. Stores chunks + embeddings in material_chunks.
 *   5. Updates materials.chunk_count + sets processed_at.
 *
 * This is the "R" of RAG — the searchable vector index scoped per subject.
 */
import { v4 as uuid } from 'uuid';
import pool from '../../config/db.js';
import { chunk } from '../../services/chunker.js';
import { embedBatch } from '../../services/aiProvider.js';

export default async function embedHandler(job) {
  const { materialId } = job.payload;
  if (!materialId) throw new Error('materialId is required.');

  // Load the material
  const [rows] = await pool.query(
    `SELECT * FROM materials WHERE id = :id`,
    { id: materialId }
  );
  const material = rows[0];
  if (!material) throw new Error(`Material ${materialId} not found.`);
  if (material.status !== 'processed') {
    throw new Error(`Material ${materialId} is not processed (status: ${material.status}).`);
  }
  if (!material.content || !material.content.trim()) {
    throw new Error(`Material ${materialId} has no extracted text to embed.`);
  }

  // Chunk the text
  const chunks = chunk(material.content, {
    chunkSizeTokens: 500,
    overlapTokens: 50,
  });

  if (chunks.length === 0) {
    throw new Error('Chunking produced no chunks — material text may be empty.');
  }

  // Embed all chunks in batches (Gemini handles parallel calls well)
  const BATCH_SIZE = 10;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.text);

    let embeddings;
    try {
      const result = await embedBatch(texts);
      embeddings = result.embeddings;
    } catch (err) {
      throw new Error(`Embedding failed for batch ${i / BATCH_SIZE}: ${err.message}`);
    }

    // Store chunks with embeddings
    const values = batch.map((c, j) => [
      uuid(),
      materialId,
      material.subject_id,
      c.ordinal,
      c.text,
      JSON.stringify(embeddings[j]),
      c.tokenCount,
    ]);

    await pool.query(
      `INSERT INTO material_chunks
         (id, material_id, subject_id, ordinal, text, embedding, token_count)
       VALUES ?`,
      [values]
    );
  }

  // Update material with chunk count
  await pool.query(
    `UPDATE materials SET chunk_count = :count WHERE id = :id`,
    { count: chunks.length, id: materialId }
  );

  return { materialId, chunkCount: chunks.length };
}
