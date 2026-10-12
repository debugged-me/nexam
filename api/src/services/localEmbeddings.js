/**
 * Local embedding provider — MiniLM (all-MiniLM-L6-v2) via transformers.js.
 *
 * Runs the model in-process on CPU through ONNX Runtime: no API key, no
 * quota, no network after the one-time ~90MB weight download. vectorStore
 * treats it as the shadow/fallback behind the Gemini embeddings client —
 * it exposes the same LangChain `Embeddings`-shaped surface
 * (`embedQuery`, `embedDocuments`) so stores can consume either provider.
 *
 * The transformers.js package is imported lazily on first embed: keeps API
 * boot fast, and on exotic hosts where onnxruntime can't install, only the
 * fallback path fails — the Gemini path is untouched.
 */
import path from 'path';
import env from '../config/env.js';

let _pipe = null; // { sig, promise }

/** Lazily load the feature-extraction pipeline (downloads weights once). */
async function getPipeline() {
  const model = env.ai.local.embedModel;
  if (_pipe?.sig === model) return _pipe.promise;
  const { pipeline, env: hfEnv } = await import('@huggingface/transformers');
  hfEnv.cacheDir = env.ai.local.cacheDir || path.resolve(process.cwd(), 'storage/models');
  if (env.ai.local.offline) hfEnv.allowRemoteModels = false;
  const promise = pipeline('feature-extraction', model);
  _pipe = { sig: model, promise };
  // A rejected load must not poison the cache — clear it so the next call
  // retries (transient download/IO failures shouldn't kill the mirror).
  promise.catch(() => { if (_pipe?.promise === promise) _pipe = null; });
  return promise;
}

/** Run the pipeline and reshape the output tensor into rows of numbers. */
async function run(texts) {
  const pipe = await getPipeline();
  const out = await pipe(texts, { pooling: 'mean', normalize: true });
  const [rows, dim] = out.dims;
  const vectors = [];
  for (let i = 0; i < rows; i++) {
    vectors.push(Array.from(out.data.slice(i * dim, (i + 1) * dim)));
  }
  return vectors;
}

/** Embeddings-shaped client matching the LangChain interface. */
export function getLocalEmbeddings() {
  return {
    modelName: env.ai.local.embedModel,
    embedQuery: async (text) => (await run([text]))[0],
    embedDocuments: async (texts) => run(texts),
  };
}

export default { getLocalEmbeddings };
