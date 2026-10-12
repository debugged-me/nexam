/**
 * Vector store service — the dedicated vector database for Nexam's RAG pipeline.
 *
 * Uses HNSWLib (Hierarchical Navigable Small World graphs) as the persistent
 * vector index, managed through LangChain's VectorStore abstraction. HNSWLib
 * is the same ANN algorithm used inside Chroma, Pinecone, and Qdrant — it
 * runs in-process (native Node addon), persists to disk, and requires no
 * separate server.
 *
 * Index collections (each exists in two provider spaces):
 *   - chunks/<subjectId>          — private material chunks for RAG retrieval
 *   - questions/_institution      — all approved questions for school-wide
 *                                   duplicate screening
 *
 * Provider model — "shadow mirror":
 *   'gemini' is the primary space (dir as-is); 'local' is a mirror written to
 *   a sibling `<dir>-local` index using the in-process MiniLM embedder
 *   (localEmbeddings.js). Embedding models produce incompatible vector spaces,
 *   so a query embedded by one provider can only search that provider's
 *   index — the mirror exists so similarity checks and retrieval keep working
 *   when Gemini is down, not to mix vectors.
 *
 *   Writes go to BOTH spaces when possible (local is free CPU); reads prefer
 *   Gemini and fall back to the mirror. A write during a Gemini outage lands
 *   mirror-only — rebuild/reindex paths reconcile the primary later.
 */
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Document } from '@langchain/core/documents';
import path from 'path';
import fs from 'fs/promises';
import env from '../config/env.js';
import { getAiConfig } from './aiConfig.js';
import { getLocalEmbeddings } from './localEmbeddings.js';

const VECTORS_DIR = path.resolve(process.cwd(), env.vectorStore.dir);
const PROVIDERS = ['gemini', 'local'];

let _embeddings = null;

/**
 * HNSWLib writes three files per index. Concurrent save/load operations can
 * expose a half-written docstore, so every access uses a small cross-process
 * lock file. This protects the API process and the background worker alike.
 */
async function withIndexLock(dir, action, timeoutMs = 30000) {
  const lockPath = `${dir}.lock`;
  await fs.mkdir(path.dirname(dir), { recursive: true });
  const started = Date.now();
  let handle;
  while (!handle) {
    try {
      handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(`${process.pid} ${Date.now()}\n`);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > 60000) {
          await fs.unlink(lockPath);
          continue;
        }
      } catch (statErr) {
        if (statErr.code !== 'ENOENT') throw statErr;
      }
      if (Date.now() - started >= timeoutMs) {
        throw new Error(`Timed out waiting for vector index lock: ${path.basename(dir)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 75));
    }
  }
  try {
    return await action();
  } finally {
    try { await handle.close(); } catch { /* already closed */ }
    try { await fs.unlink(lockPath); } catch { /* lock already cleared */ }
  }
}

/** Lazily initialize the LangChain Gemini embeddings model. Rebuilt
 *  automatically when the superadmin changes the key/model in settings. */
async function getEmbeddings() {
  const cfg = await getAiConfig();
  const sig = `${cfg.gemini.apiKey}|${cfg.gemini.embeddingModel}`;
  if (_embeddings?.sig === sig) return _embeddings.client;
  if (!cfg.gemini.apiKey) {
    throw new Error('A Gemini API key is required for the vector store embeddings.');
  }
  _embeddings = {
    sig,
    client: new GoogleGenerativeAIEmbeddings({
      apiKey: cfg.gemini.apiKey,
      model: cfg.gemini.embeddingModel,
    }),
  };
  return _embeddings.client;
}

/** Resolve the embeddings client for a provider space. */
async function embeddingsFor(provider) {
  return provider === 'local' ? getLocalEmbeddings() : getEmbeddings();
}

/**
 * Wrap an embeddings client so silent empty-vector results become throws.
 * LangChain's Gemini embedDocuments resolves with empty arrays on API failure
 * (unlike embedQuery, which throws) — unvalidated, that poisons a new index
 * with 0-dimensional vectors that every future query crashes on.
 */
function checkedEmbeddings(embeddings) {
  return {
    embedQuery: async (text) => {
      const v = await embeddings.embedQuery(text);
      if (!Array.isArray(v) || !v.length) {
        throw new Error(`${embeddings.modelName || 'provider'} returned an empty query vector.`);
      }
      return v;
    },
    embedDocuments: async (texts) => {
      const vs = await embeddings.embedDocuments(texts);
      const bad = !Array.isArray(vs) || vs.length !== texts.length
        || vs.some((v) => !Array.isArray(v) || !v.length);
      if (bad) {
        throw new Error(`${embeddings.modelName || 'provider'} returned empty document vectors.`);
      }
      return vs;
    },
  };
}

/** Embed text with a specific provider (no fallback). */
async function embedWithProvider(text, provider) {
  return checkedEmbeddings(await embeddingsFor(provider)).embedQuery(text);
}

/**
 * Embed text with Gemini first, falling back to the local MiniLM model.
 * Returns { vector, provider } — callers must search the index of the SAME
 * provider, since the two spaces are not comparable.
 */
async function embedWithFallback(text) {
  try {
    return { vector: await embedWithProvider(text, 'gemini'), provider: 'gemini' };
  } catch (err) {
    console.warn(`[vectorStore] Gemini embed failed (${err.message}) — using local embeddings.`);
    return { vector: await embedWithProvider(text, 'local'), provider: 'local' };
  }
}

function providerDir(base, provider) {
  return provider === 'local' ? `${base}-local` : base;
}

function chunksDir(subjectId, provider = 'gemini') {
  return providerDir(path.join(VECTORS_DIR, 'chunks', subjectId), provider);
}

function questionsDir(subjectId, provider = 'gemini') {
  return providerDir(path.join(VECTORS_DIR, 'questions', subjectId), provider);
}

async function dirExists(dir) {
  try {
    await fs.access(path.join(dir, 'hnswlib.index'));
    return true;
  } catch {
    return false;
  }
}

/** Append docs to an index dir (create it when absent) under the lock. */
async function writeDocs(dir, docs, embeddings) {
  const emb = checkedEmbeddings(embeddings);
  await withIndexLock(dir, async () => {
    const existed = await dirExists(dir);
    try {
      if (existed) {
        const store = await HNSWLib.load(dir, emb, { space: 'cosine' });
        await store.addDocuments(docs);
        await store.save(dir);
      } else {
        await fs.mkdir(dir, { recursive: true });
        const store = await HNSWLib.fromDocuments(docs, emb, {
          space: 'cosine', directory: dir,
        });
        await store.save(dir);
      }
    } catch (err) {
      // HNSWLib.fromDocuments writes index files eagerly — a failed first write
      // leaves a numDimensions:0 index on disk that dirExists() would treat as
      // real and every future query would crash on. Remove the half-made dir.
      if (!existed) await fs.rm(dir, { recursive: true, force: true });
      throw err;
    }
  });
}

/**
 * Write docs to the primary index, then the local mirror. Either may fail
 * independently (provider outage, missing model): the other still lands, so
 * nothing is lost — the caller only sees an error when BOTH writes fail.
 */
async function dualWrite(dirs, docs) {
  let primaryErr = null;
  try {
    await writeDocs(dirs.gemini, docs, await embeddingsFor('gemini'));
  } catch (err) {
    primaryErr = err;
    console.warn(`[vectorStore] primary index write failed: ${err.message}`);
  }
  try {
    await writeDocs(dirs.local, docs, await embeddingsFor('local'));
  } catch (err) {
    console.warn(`[vectorStore] local mirror write failed: ${err.message}`);
    if (primaryErr) throw primaryErr;
  }
}

/**
 * Vector-search one index dir. Returns null when the dir has no index file —
 * distinct from [], so callers can try the other provider space.
 */
async function searchDir(dir, vector, provider, topK, excludeId, mapDoc) {
  if (!(await dirExists(dir))) return null;
  return withIndexLock(dir, async () => {
    const store = await HNSWLib.load(dir, await embeddingsFor(provider), { space: 'cosine' });
    const fetchCount = excludeId ? topK + 5 : topK;
    const results = await store.similaritySearchVectorWithScore(vector, fetchCount);
    return results
      .filter(([doc]) => doc.metadata.id !== excludeId)
      .slice(0, topK)
      .map(mapDoc);
  });
}

/**
 * Text-query search across provider spaces: embed once with the fallback
 * chain, search that provider's index, and when that index doesn't exist try
 * the other space (re-embeds — the rare cold-mirror case).
 */
async function searchWithFallback(dirs, query, topK, mapDoc) {
  const first = await embedWithFallback(query);
  let hit = null;
  try {
    hit = await searchDir(dirs[first.provider], first.vector, first.provider, topK, null, mapDoc);
  } catch (err) {
    console.warn(`[vectorStore] ${first.provider} index search failed (${err.message}) — trying mirror.`);
  }
  if (hit !== null) return hit;
  const other = first.provider === 'gemini' ? 'local' : 'gemini';
  const vec = await embedWithProvider(query, other);
  const hit2 = await searchDir(dirs[other], vec, other, topK, null, mapDoc);
  return hit2 ?? [];
}

const mapChunk = ([doc, distance]) => ({
  id: doc.metadata.id,
  materialId: doc.metadata.materialId,
  ordinal: doc.metadata.ordinal,
  text: doc.pageContent,
  score: 1 - distance,
});

const mapQuestion = ([doc, distance]) => ({ id: doc.metadata.id, score: 1 - distance });

/** Atomic per-dir rebuild used by rebuildQuestionsIndex / rebuildChunksIndex. */
async function rebuildDir(dir, docs, embeddings) {
  const emb = checkedEmbeddings(embeddings);
  return withIndexLock(dir, async () => {
    const stamp = Date.now();
    const tempDir = `${dir}.rebuild-${stamp}`;
    const backupDir = `${dir}.backup-${stamp}`;
    if (docs.length) {
      try {
        await fs.mkdir(tempDir, { recursive: true });
        const store = await HNSWLib.fromDocuments(docs, emb, {
          space: 'cosine', directory: tempDir,
        });
        await store.save(tempDir);
      } catch (err) {
        await fs.rm(tempDir, { recursive: true, force: true });
        throw err;
      }
    }
    let backupCreated = false;
    try {
      await fs.rename(dir, backupDir);
      backupCreated = true;
    } catch (err) { if (err.code !== 'ENOENT') throw err; }
    if (docs.length) await fs.rename(tempDir, dir);
    return { indexed: docs.length, backupDir: backupCreated ? backupDir : null, backupCreated };
  });
}

/** Rebuild an index in one or both provider spaces; returns per-provider results. */
async function rebuildFor(dirs, docs, provider) {
  const out = {};
  for (const p of PROVIDERS.filter((p) => provider === 'both' || provider === p)) {
    try {
      out[p] = await rebuildDir(dirs[p], docs, await embeddingsFor(p));
    } catch (err) {
      out[p] = { error: err.message };
      console.warn(`[vectorStore] ${p} index rebuild failed: ${err.message}`);
    }
  }
  return out;
}

// ── Material chunks (RAG retrieval) ─────────────────────────

/**
 * Add material chunks to the subject's vector index (both provider spaces).
 * @param {string} subjectId
 * @param {Array<{id, text, materialId, ordinal}>} chunks
 */
export async function addChunks(subjectId, chunks) {
  if (!chunks.length) return;

  const docs = chunks.map((c) => new Document({
    pageContent: c.text,
    metadata: { id: c.id, materialId: c.materialId, ordinal: c.ordinal },
  }));

  await dualWrite({ gemini: chunksDir(subjectId), local: chunksDir(subjectId, 'local') }, docs);
}

/**
 * Search the subject's chunk index for the top-k most similar chunks.
 * Prefers the Gemini index; falls back to the local mirror when Gemini
 * embeddings are unavailable (or only the mirror exists).
 * @returns {Promise<Array<{id, materialId, ordinal, text, score}>>}
 *   score is cosine similarity (0..1, higher = more similar)
 */
export async function searchChunks(subjectId, query, topK = 5) {
  return searchWithFallback(
    { gemini: chunksDir(subjectId), local: chunksDir(subjectId, 'local') },
    query, topK, mapChunk
  );
}

/**
 * Delete the entire chunk index for a subject (used when a material is removed
 * or the subject is deleted). Both provider spaces go — a mirror keeping stale
 * chunks would leak them into retrieval during an outage.
 */
export async function deleteChunksIndex(subjectId) {
  await fs.rm(chunksDir(subjectId), { recursive: true, force: true });
  await fs.rm(chunksDir(subjectId, 'local'), { recursive: true, force: true });
}

/**
 * Atomically rebuild a subject's chunk index (used by the backfill script).
 * @param {string} provider — 'gemini' | 'local' | 'both' (default)
 */
export async function rebuildChunksIndex(subjectId, chunks, provider = 'both') {
  const docs = (chunks || []).map((c) => new Document({
    pageContent: c.text,
    metadata: { id: c.id, materialId: c.materialId, ordinal: c.ordinal },
  }));
  return rebuildFor(
    { gemini: chunksDir(subjectId), local: chunksDir(subjectId, 'local') },
    docs, provider
  );
}

// ── Questions (similarity checking) ────────────────────────

/**
 * Add questions' embeddings to a question vector index in one pass — a single
 * lock, one index load, batched embedding calls, one save, per provider space.
 * Bulk approvals route through this; per-question indexing would re-load and
 * re-save the whole index for every row and outlive the request timeout.
 * @param {string} subjectId
 * @param {Array<{id: string, text: string}>} items
 */
export async function addQuestions(subjectId, items) {
  if (!items.length) return;

  const docs = items.map((item) => new Document({
    pageContent: item.text,
    metadata: { id: item.id },
  }));

  await dualWrite({ gemini: questionsDir(subjectId), local: questionsDir(subjectId, 'local') }, docs);
}

/**
 * Add a question's embedding to the subject's question vector index.
 * @param {string} subjectId
 * @param {string} questionId
 * @param {string} text — stem + options + answer (the text to embed)
 */
export async function addQuestion(subjectId, questionId, text) {
  return addQuestions(subjectId, [{ id: questionId, text }]);
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
  const first = await embedWithFallback(query);
  const dirs = { gemini: questionsDir(subjectId), local: questionsDir(subjectId, 'local') };
  let hit = null;
  try {
    hit = await searchDir(dirs[first.provider], first.vector, first.provider, topK, excludeId, mapQuestion);
  } catch (err) {
    console.warn(`[vectorStore] ${first.provider} question index search failed (${err.message}) — trying mirror.`);
  }
  if (hit !== null) return hit;
  const other = first.provider === 'gemini' ? 'local' : 'gemini';
  const vec = await embedWithProvider(query, other);
  const hit2 = await searchDir(dirs[other], vec, other, topK, excludeId, mapQuestion);
  return hit2 ?? [];
}

/**
 * Embed a text into a vector WITHOUT adding it to any index.
 * Used by the similarity check: a draft is searched against the index of
 * ACTIVE questions, but the draft itself only enters the index on approval.
 * Falls back to the local embedder when Gemini is unavailable.
 * @returns {Promise<{vector: number[], provider: 'gemini'|'local'}>}
 */
export async function embedQuery(text) {
  return embedWithFallback(text);
}

/**
 * Search the question index with a precomputed embedding vector.
 * @param {'gemini'|'local'} provider — must be the provider that produced the
 *   vector; the two index spaces are not comparable.
 * @param {string|null} fallbackText — when the provider's index is missing OR
 *   corrupt (e.g. a write that failed partway), re-embed this text with the
 *   other provider and search its index instead.
 * @returns {Promise<{hits: Array<{id, score}>, provider: string}>} — provider
 *   is the space actually searched, so callers apply the right threshold.
 */
export async function searchQuestionsByVector(subjectId, vector, topK = 10, excludeId = null, provider = 'gemini', fallbackText = null) {
  let hit = null;
  try {
    hit = await searchDir(questionsDir(subjectId, provider), vector, provider, topK, excludeId, mapQuestion);
  } catch (err) {
    console.warn(`[vectorStore] ${provider} question index search failed (${err.message}) — trying mirror.`);
  }
  if (hit !== null) return { hits: hit, provider };
  if (!fallbackText) return { hits: [], provider };
  const other = provider === 'gemini' ? 'local' : 'gemini';
  const vec = await embedWithProvider(fallbackText, other);
  const hit2 = await searchDir(questionsDir(subjectId, other), vec, other, topK, excludeId, mapQuestion);
  return hit2 === null ? { hits: [], provider } : { hits: hit2, provider: other };
}

/**
 * Replace one subject's question index atomically, preserving the old index.
 * @param {string} provider — 'gemini' | 'local' | 'both' (default)
 */
export async function rebuildQuestionsIndex(subjectId, questions, provider = 'both') {
  const docs = questions.map((q) => new Document({
    pageContent: q.text,
    metadata: { id: q.id },
  }));
  return rebuildFor(
    { gemini: questionsDir(subjectId), local: questionsDir(subjectId, 'local') },
    docs, provider
  );
}

/**
 * Remove a question from the subject's question index (called on delete or
 * reject) in BOTH provider spaces. HNSWLib versions differ in delete support,
 * so this walks the docstore to find the internal ids whose metadata.id
 * matches, then uses whatever removal API the store exposes. Returns true if
 * anything was removed; false when removal isn't possible — a stale vector is
 * harmless because search results are always SQL-filtered to active questions.
 */
export async function removeQuestion(subjectId, questionId) {
  const removeFrom = async (dir, provider) => {
    if (!(await dirExists(dir))) return false;
    try {
      return await withIndexLock(dir, async () => {
        const store = await HNSWLib.load(dir, await embeddingsFor(provider), { space: 'cosine' });
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
          for (const internalId of internalIds) {
            const numericLabel = store.index?.getIdsList?.().indexOf?.(internalId);
            try { store.index?.markDelete?.(numericLabel); } catch { /* best effort */ }
            docs.delete(internalId);
          }
        }
        await store.save(dir);
        return true;
      });
    } catch {
      return false;
    }
  };

  const results = await Promise.all([
    removeFrom(questionsDir(subjectId), 'gemini'),
    removeFrom(questionsDir(subjectId, 'local'), 'local'),
  ]);
  return results.some(Boolean);
}

/**
 * Delete the entire question index for a subject (both provider spaces).
 */
export async function deleteQuestionsIndex(subjectId) {
  await fs.rm(questionsDir(subjectId), { recursive: true, force: true });
  await fs.rm(questionsDir(subjectId, 'local'), { recursive: true, force: true });
}

export default {
  addChunks,
  searchChunks,
  deleteChunksIndex,
  rebuildChunksIndex,
  addQuestion,
  addQuestions,
  searchQuestions,
  deleteQuestionsIndex,
  embedQuery,
  searchQuestionsByVector,
  removeQuestion,
  rebuildQuestionsIndex,
};
