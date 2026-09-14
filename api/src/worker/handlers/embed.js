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
import { addChunks } from '../../services/vectorStore.js';
import { enqueue } from '../../services/jobs.js';

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

  // Store chunk text + metadata in MySQL (relational record)
  const chunkRecords = chunks.map((c) => ({
    id: uuid(),
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

  await pool.query(
    `INSERT INTO material_chunks
       (id, material_id, subject_id, ordinal, text, token_count)
     VALUES ?`,
    [values]
  );

  // Embed chunks and store vectors in the HNSWLib vector index via LangChain.
  // The embedding model (GoogleGenerativeAIEmbeddings) is invoked internally
  // by LangChain's HNSWLib addDocuments — no manual embed call needed.
  await addChunks(material.subject_id, chunkRecords.map((c) => ({
    id: c.id,
    text: c.text,
    materialId: c.materialId,
    ordinal: c.ordinal,
  })));

  // Update material with chunk count
  await pool.query(
    `UPDATE materials SET chunk_count = :count WHERE id = :id`,
    { count: chunks.length, id: materialId }
  );

  // Auto-chain: if this is a syllabus, auto-enqueue TOS generation
  if (material.is_syllabus) {
    const tosJobId = await enqueue({
      type: 'syllabus_tos',
      payload: { materialId, userId: material.created_by },
      userId: material.created_by,
      subjectId: material.subject_id,
    });
    console.log(`[worker] Auto-chained syllabus_tos job ${tosJobId} for material ${materialId}`);
  }

  return { materialId, chunkCount: chunks.length, autoChainedTos: !!material.is_syllabus };
}
