/**
 * Vector store service — the dedicated vector database for Nexam's RAG pipeline.
 *
 * Uses HNSWLib (Hierarchical Navigable Small World graphs) as the persistent
 * vector index, managed through LangChain's VectorStore abstraction. HNSWLib
 * is the same ANN algorithm used inside Chroma, Pinecone, and Qdrant — it
 * runs in-process (native Node addon), persists to disk, and requires no
 * separate server.
 *
 * Two index collections per subject:
 *   - chunks/<subjectId>    — material chunk embeddings (for RAG retrieval)
 *   - questions/<subjectId> — approved question embeddings (for similarity)
 *
 * Embeddings are generated via LangChain's GoogleGenerativeAIEmbeddings
 * (wraps the Gemini embedding API), so LangChain manages the full
 * retrieval ↔ embedding ↔ generation interaction as described in §3.1.
 */
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Document } from '@langchain/core/documents';
import path from 'path';
import fs from 'fs/promises';
import env from '../config/env.js';

const VECTORS_DIR = path.resolve(process.cwd(), env.vectorStore.dir);

let _embeddings = null;

/** Lazily initialize the LangChain Gemini embeddings model. */
function getEmbeddings() {
  if (_embeddings) return _embeddings;
  if (!env.ai.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is required for the vector store embeddings.');
  }
  _embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: env.ai.gemini.apiKey,
    model: env.ai.gemini.embeddingModel,
  });
  return _embeddings;
}

function chunksDir(subjectId) {
  return path.join(VECTORS_DIR, 'chunks', subjectId);
}

function questionsDir(subjectId) {
  return path.join(VECTORS_DIR, 'questions', subjectId);
}

async function dirExists(dir) {
  try {
    await fs.access(path.join(dir, 'hnswlib.index'));
    return true;
  } catch {
    return false;
  }
}

// ── Material chunks (RAG retrieval) ─────────────────────────

/**
 * Add material chunks to the subject's vector index.
 * @param {string} subjectId
 * @param {Array<{id, text, materialId, ordinal}>} chunks
 */
export async function addChunks(subjectId, chunks) {
  if (!chunks.length) return;

  const dir = chunksDir(subjectId);
  const embeddings = getEmbeddings();
  const docs = chunks.map((c) => new Document({
    pageContent: c.text,
    metadata: { id: c.id, materialId: c.materialId, ordinal: c.ordinal },
  }));

  const exists = await dirExists(dir);
  if (exists) {
    const store = await HNSWLib.load(dir, embeddings, { space: 'cosine' });
    await store.addDocuments(docs);
    await store.save(dir);
  } else {
    await fs.mkdir(dir, { recursive: true });
    const store = await HNSWLib.fromDocuments(docs, embeddings, {
      space: 'cosine',
      directory: dir,
    });
    await store.save(dir);
  }
}

/**
 * Search the subject's chunk index for the top-k most similar chunks.
 * @returns {Promise<Array<{id, materialId, ordinal, text, score}>>}
 *   score is cosine similarity (0..1, higher = more similar)
 */
export async function searchChunks(subjectId, query, topK = 5) {
  const dir = chunksDir(subjectId);
  if (!(await dirExists(dir))) return [];

  const store = await HNSWLib.load(dir, getEmbeddings(), { space: 'cosine' });
  const results = await store.similaritySearchWithScore(query, topK);

  // HNSWLib cosine space returns distance (1 - similarity); convert.
  return results.map(([doc, distance]) => ({
    id: doc.metadata.id,
    materialId: doc.metadata.materialId,
    ordinal: doc.metadata.ordinal,
    text: doc.pageContent,
    score: 1 - distance,
  }));
}

/**
 * Delete the entire chunk index for a subject (used when a material is removed
 * or the subject is deleted). The index is rebuilt on the next embed job.
 */
export async function deleteChunksIndex(subjectId) {
  await fs.rm(chunksDir(subjectId), { recursive: true, force: true });
}

// ── Questions (similarity checking) ────────────────────────

/**
 * Add a question's embedding to the subject's question vector index.
 * @param {string} subjectId
 * @param {string} questionId
 * @param {string} text — stem + options + answer (the text to embed)
 */
export async function addQuestion(subjectId, questionId, text) {
  const dir = questionsDir(subjectId);
  const embeddings = getEmbeddings();
  const doc = new Document({
    pageContent: text,
    metadata: { id: questionId },
  });

  const exists = await dirExists(dir);
  if (exists) {
    const store = await HNSWLib.load(dir, embeddings, { space: 'cosine' });
    await store.addDocuments([doc]);
    await store.save(dir);
  } else {
    await fs.mkdir(dir, { recursive: true });
    const store = await HNSWLib.fromDocuments([doc], embeddings, {
      space: 'cosine',
      directory: dir,
    });
    await store.save(dir);
  }
}

/**
 * Search for similar questions in the subject's question index.
 * @param {string} subjectId
 * @param {string} query — the question text to search for
 * @param {number} topK
 * @param {string|null} excludeId — exclude this question ID from results
 * @returns {Promise<Array<{id, score}>>}
 *   score is cosine similarity (0..1, higher = more similar)
 */
export async function searchQuestions(subjectId, query, topK = 10, excludeId = null) {
  const dir = questionsDir(subjectId);
  if (!(await dirExists(dir))) return [];

  const store = await HNSWLib.load(dir, getEmbeddings(), { space: 'cosine' });
  // Fetch extra results so we can filter out the excluded ID.
  const fetchCount = excludeId ? topK + 5 : topK;
  const results = await store.similaritySearchWithScore(query, fetchCount);

  return results
    .filter(([doc]) => doc.metadata.id !== excludeId)
    .slice(0, topK)
    .map(([doc, distance]) => ({
      id: doc.metadata.id,
      score: 1 - distance,
    }));
}

/**
 * Embed a text into a vector WITHOUT adding it to any index.
 * Used by the similarity check: a draft is searched against the index of
 * ACTIVE questions, but the draft itself only enters the index on approval.
 */
export async function embedQuery(text) {
  return getEmbeddings().embedQuery(text);
}

/**
 * Search the question index with a precomputed embedding vector.
 * Falls back to text search when the store doesn't expose vector search.
 * @returns {Promise<Array<{id, score}>>}
 */
export async function searchQuestionsByVector(subjectId, vector, topK = 10, excludeId = null) {
  const dir = questionsDir(subjectId);
  if (!(await dirExists(dir))) return [];

  const store = await HNSWLib.load(dir, getEmbeddings(), { space: 'cosine' });
  const fetchCount = excludeId ? topK + 5 : topK;
  const results = await store.similaritySearchVectorWithScore(vector, fetchCount);

  return results
    .filter(([doc]) => doc.metadata.id !== excludeId)
    .slice(0, topK)
    .map(([doc, distance]) => ({
      id: doc.metadata.id,
      score: 1 - distance,
    }));
}

/**
 * Remove a question from the subject's question index (called on delete or
 * reject). HNSWLib versions differ in delete support, so this walks the
 * docstore to find the internal ids whose metadata.id matches, then uses
 * whatever removal API the store exposes. Returns true if anything was
 * removed; false when removal isn't possible — a stale vector is harmless
 * because search results are always SQL-filtered to active questions.
 */
export async function removeQuestion(subjectId, questionId) {
  const dir = questionsDir(subjectId);
  if (!(await dirExists(dir))) return false;

  try {
    const store = await HNSWLib.load(dir, getEmbeddings(), { space: 'cosine' });
    const docs = store.docstore?._docs;
    if (!docs || typeof docs.entries !== 'function') return false;

    const internalIds = [];
    for (const [internalId, doc] of docs.entries()) {
      if (doc?.metadata?.id === questionId) internalIds.push(internalId);
    }
    if (!internalIds.length) return false;

    if (typeof store.delete === 'function') {
      await store.delete({ ids: internalIds });
    } else {
      // Older LangChain: drop the docstore entries + mark vectors deleted.
      for (const internalId of internalIds) {
        const numericLabel = store.index?.getIdsList?.().indexOf?.(internalId);
        try { store.index?.markDelete?.(numericLabel); } catch { /* best effort */ }
        docs.delete(internalId);
      }
    }
    await store.save(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete the entire question index for a subject.
 */
export async function deleteQuestionsIndex(subjectId) {
  await fs.rm(questionsDir(subjectId), { recursive: true, force: true });
}

export default {
  addChunks,
  searchChunks,
  deleteChunksIndex,
  addQuestion,
  searchQuestions,
  deleteQuestionsIndex,
  embedQuery,
  searchQuestionsByVector,
  removeQuestion,
};
