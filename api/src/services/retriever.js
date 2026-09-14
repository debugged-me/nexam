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
import { searchChunks } from './vectorStore.js';

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

  const results = await searchChunks(subjectId, query, topK);

  // Sort by score descending (highest similarity first)
  return results.sort((a, b) => b.score - a.score);
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
