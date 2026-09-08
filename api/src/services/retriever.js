/**
 * Retrieval service — the core of RAG.
 *
 * Given a query and a subject_id, retrieves the top-k most relevant
 * material chunks from that subject's vector index. This enforces the
 * scope's "exclusively instructor-uploaded materials" constraint —
 * retrieval is ALWAYS scoped to a single subject.
 */
import pool from '../config/db.js';
import { embed } from './aiProvider.js';

/**
 * Retrieve the top-k most similar chunks for a query, scoped to a subject.
 *
 * @param {string} query — search query (topic + bloom + outcomes)
 * @param {string} subjectId — scope to this subject only
 * @param {number} topK — number of chunks to return (default 5)
 * @returns {Promise<Array<{id, text, score, ordinal, materialId}>>}
 */
export async function retrieve(query, subjectId, topK = 5) {
  if (!query || !subjectId) return [];

  // Embed the query
  const { embedding: queryVec } = await embed(query);

  // Load all chunks for this subject (pilot scale — no ANN index needed)
  const [rows] = await pool.query(
    `SELECT id, material_id, ordinal, text, embedding
     FROM material_chunks
     WHERE subject_id = :subjectId
     ORDER BY ordinal ASC`,
    { subjectId }
  );

  if (!rows.length) return [];

  // Compute cosine similarity against each chunk
  const scored = rows
    .filter((r) => r.embedding) // skip chunks without embeddings
    .map((r) => {
      const chunkVec = JSON.parse(r.embedding);
      return {
        id: r.id,
        materialId: r.material_id,
        ordinal: r.ordinal,
        text: r.text,
        score: cosineSimilarity(queryVec, chunkVec),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * Retrieve chunks for multiple queries in one call (more efficient for
 * generating questions across multiple TOS slots).
 *
 * @param {Array<{query, topK}>} queries
 * @param {string} subjectId
 * @returns {Promise<Array<Array<{id, text, score, ordinal, materialId}>>>}
 */
export async function retrieveBatch(queries, subjectId) {
  // Load chunks once, reuse for all queries
  const [rows] = await pool.query(
    `SELECT id, material_id, ordinal, text, embedding
     FROM material_chunks
     WHERE subject_id = :subjectId
     ORDER BY ordinal ASC`,
    { subjectId }
  );

  if (!rows.length) return queries.map(() => []);

  const chunkVecs = rows
    .filter((r) => r.embedding)
    .map((r) => ({ ...r, vec: JSON.parse(r.embedding) }));

  const results = [];
  for (const { query, topK = 5 } of queries) {
    const { embedding: queryVec } = await embed(query);
    const scored = chunkVecs
      .map((r) => ({
        id: r.id,
        materialId: r.material_id,
        ordinal: r.ordinal,
        text: r.text,
        score: cosineSimilarity(queryVec, r.vec),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    results.push(scored);
  }

  return results;
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

export default { retrieve, retrieveBatch };
