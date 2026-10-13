/**
 * Retrieval service — the core of RAG.
 *
 * Given a query and a subject_id, retrieves the top-k most relevant
 * material chunks from that subject's vector index via LangChain's
 * HNSWLib vector store. This enforces the scope's "exclusively
 * instructor-uploaded materials" constraint — retrieval is ALWAYS
 * scoped to a single subject.
 *
 * LangChain manages the embedding of the query and the similarity
 * search against the persistent HNSWLib index (see vectorStore.js).
 */
import pool from '../config/db.js';
import { searchChunks } from './vectorStore.js';

/**
 * Retrieve the top-k most similar chunks for a query, scoped to a subject.
 *
 * @param {string} query — search query (topic + bloom + outcomes)
 * @param {string} subjectId — scope to this subject only
 * @param {number} topK — number of chunks to return (default 5)
 * @param {object} opts — { lessonsOnly } searches non-syllabus materials only
 * @returns {Promise<Array<{id, text, sourceText, score, ordinal, materialId, fromSyllabus}>>}
 */
export async function retrieve(query, subjectId, topK = 5, scopedChunks = null, { lessonsOnly = false } = {}) {
  if (!query || !subjectId) return [];

  const [current] = await pool.query(
    `SELECT c.id, c.text, m.is_syllabus FROM material_chunks c JOIN materials m ON m.id = c.material_id
     WHERE c.subject_id = :sid AND m.status = 'processed'`, { sid: subjectId });
  const currentById = new Map(current.map((c) => [c.id, c.text]));
  // A syllabus plans coverage; it is not answer evidence. Callers use the flag
  // to keep its outline text out of grounded question prompts.
  const syllabusIds = new Set(current.filter((c) => Number(c.is_syllabus)).map((c) => c.id));
  const allowed = (scopedChunks ? scopedChunks.filter((c) => currentById.has(c.id)).map((c) => c.id) : current.map((c) => c.id))
    .filter((id) => !lessonsOnly || !syllabusIds.has(id));
  if (!allowed.length) return [];
  const hits = await searchChunks(subjectId, query, topK, allowed);
  const results = hits.filter((c) => currentById.get(c.id) === c.text)
    .map((c) => ({ ...c, sourceText: currentById.get(c.id), fromSyllabus: syllabusIds.has(c.id) }));
  // Only instructor-confirmed excerpts enter the prompt, including when the
  // indexed chunk spans two teaching periods. No unscoped fallback is allowed.
  const excerpts = scopedChunks ? new Map(scopedChunks.map((c) => [c.id, c.text])) : null;
  const scoped = excerpts ? results.filter((c) => excerpts.has(c.id)).map((c) => ({ ...c, text: excerpts.get(c.id) })) : results;

  // Sort by score descending (highest similarity first)
  return scoped.sort((a, b) => b.score - a.score);
}

/**
 * Retrieve chunks for multiple queries in one call.
 *
 * @param {Array<{query, topK}>} queries
 * @param {string} subjectId
 * @returns {Promise<Array<Array<{id, text, score, ordinal, materialId}>>>}
 */
export async function retrieveBatch(queries, subjectId) {
  const results = [];
  for (const { query, topK = 5 } of queries) {
    const chunks = await retrieve(query, subjectId, topK);
    results.push(chunks);
  }
  return results;
}

export default { retrieve, retrieveBatch };
