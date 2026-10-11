/**
 * aiConfig.js — resolves AI provider credentials and model names.
 *
 * Resolution order per value: `settings` table (superadmin-editable) → env.
 * Cached for 30s so AI calls don't hit the DB each time; the admin settings
 * endpoint calls invalidateAiConfigCache() after writes so changes apply on
 * the next request/job.
 */
import env from '../config/env.js';
import { getSetting } from './settings.js';

const TTL_MS = 30_000;
let cache = null;
let cacheAt = 0;

export async function getAiConfig() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;

  const [geminiApiKey, geminiModel, geminiEmbeddingModel, groqApiKey, groqModel] =
    await Promise.all([
      getSetting('gemini_api_key', null),
      getSetting('gemini_model', null),
      getSetting('gemini_embedding_model', null),
      getSetting('groq_api_key', null),
      getSetting('groq_model', null),
    ]);

  cache = {
    gemini: {
      apiKey: geminiApiKey || env.ai.gemini.apiKey,
      model: geminiModel || env.ai.gemini.model,
      embeddingModel: geminiEmbeddingModel || env.ai.gemini.embeddingModel,
    },
    groq: {
      apiKey: groqApiKey || env.ai.groq.apiKey,
      model: groqModel || env.ai.groq.model,
    },
  };
  cacheAt = Date.now();
  return cache;
}

export function invalidateAiConfigCache() {
  cache = null;
  cacheAt = 0;
}

export default { getAiConfig, invalidateAiConfigCache };
