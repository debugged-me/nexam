/**
 * Phase 2 — Chunking + embedding handler.
 *
 * Receives a job with payload { materialId } and:
 *   1. Loads the processed material text.
 *   2. Splits into token-aware chunks (chunker.js).
 *   3. Embeds each chunk and stores it in the HNSWLib vector index
 *      via LangChain (vectorStore.js).
 *   4. Stores chunk text + metadata in MySQL material_chunks (the
 *      relational record; the embedding vector lives in the vector store).
 *   5. Updates materials.chunk_count + sets processed_at.
 *
 * This is the "R" of RAG — the searchable vector index scoped per subject.
 */
import { v4 as uuid } from 'uuid';
import pool from '../../config/db.js';
import { chunk } from '../../services/chunker.js';
import { addMissingChunks } from '../../services/vectorStore.js';
import { getNumber } from '../../services/settings.js';

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

  // Chunk the text — sizes come from the `settings` table so the admin can
  // tune chunking without redeploying (falls back to 500/50 like before).
  const chunks = chunk(material.content, {
    chunkSizeTokens: await getNumber('chunk_size_tokens', 500),
    overlapTokens: await getNumber('chunk_overlap_tokens', 50),
  });

  if (chunks.length === 0) {
    throw new Error('Chunking produced no chunks — material text may be empty.');
  }

  const [existing] = await pool.query(`SELECT id, ordinal, text FROM material_chunks WHERE material_id = :id ORDER BY ordinal`, { id: materialId });
  const unchanged = existing.length === chunks.length && existing.every((c, i) => c.text === chunks[i].text && c.ordinal === chunks[i].ordinal);

  // Store chunk text + metadata in MySQL (relational record)
  const chunkRecords = chunks.map((c) => ({
    id: unchanged ? existing[c.ordinal].id : uuid(),
    materialId,
    subjectId: material.subject_id,
    ordinal: c.ordinal,
    text: c.text,
    tokenCount: c.tokenCount,
  }));

  const values = chunkRecords.map((c) => [
    c.id,
    c.materialId,
    c.subjectId,
    c.ordinal,
    c.text,
    c.tokenCount,
  ]);

  if (!unchanged) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`SELECT id FROM materials WHERE id = :id FOR UPDATE`, { id: materialId });
      await conn.query(`DELETE FROM material_chunks WHERE material_id = :id`, { id: materialId });
      await conn.query(`INSERT INTO material_chunks (id, material_id, subject_id, ordinal, text, token_count) VALUES ?`, [values]);
      await conn.commit();
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
  }

  // Embed this material's chunks into the subject's HNSWLib index via
  // LangChain. Only chunks a provider space lacks are embedded, so a retry
  // never duplicates entries and an upload never re-embeds other materials.
  // Entries of replaced chunks are inert — retrieval is filtered to current
  // SQL ids — and the reconcile sweep rebuilds a drifted index.
  try {
    await addMissingChunks(material.subject_id, chunkRecords.map((c) => ({
      id: c.id, text: c.text, materialId: c.materialId, ordinal: c.ordinal,
    })));
  } catch {
    throw new Error('Material indexing is unavailable. Retry indexing; syllabus blueprint extraction remains independent.');
  }

  // Update material with chunk count
  await pool.query(
    `UPDATE materials SET chunk_count = :count WHERE id = :id`,
    { count: chunks.length, id: materialId }
  );

  return { materialId, chunkCount: chunks.length };
}
