/**
 * aiConfig.js — resolves AI provider credentials and model names.
 *
 * Resolution order per value: `settings` table (superadmin-editable) → env.
 * Gemini and Groq support key pools: the `*_api_keys` settings store one key
 * per line; `keys` is the deduped pool (settings list → legacy single key →
 * env list → env key) and `apiKey` stays set to the pool head so older
 * readers keep working. Pool rotation/cooldown lives in aiProvider.js.
 *
 * Cached for 30s so AI calls don't hit the DB each time; the admin settings
 * endpoint calls invalidateAiConfigCache() after writes so changes apply on
 * the next request/job.
 */
import env from '../config/env.js';
import { getSetting } from './settings.js';

const TTL_MS = 30_000;
let cache = null;
let cacheAt = 0;

/** One key per line (or JSON array) — the format the settings UI saves. */
export function parseApiKeys(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((k) => String(k).trim()).filter(Boolean);
  const s = String(raw).trim();
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((k) => String(k).trim()).filter(Boolean);
    } catch { /* fall through to line parsing */ }
  }
  return s.split(/\r?\n/).map((k) => k.trim()).filter(Boolean);
}

/** Pool = settings list, else legacy single key, then env keys appended. */
function keyPool(listSetting, singleSetting, envKeys, envKey) {
  const fromSettings = parseApiKeys(listSetting);
  const base = fromSettings.length ? fromSettings : (singleSetting ? [singleSetting] : []);
  return [...new Set([...base, ...(envKeys || []), envKey].filter(Boolean))];
}

export async function getAiConfig() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;

  const [
    geminiApiKey, geminiApiKeys, geminiModel, geminiFallbackModels, geminiEmbeddingModel,
    groqApiKey, groqApiKeys, groqModel, groqFallbackModels,
    ollamaApiKey, ollamaModel,
  ] = await Promise.all([
    getSetting('gemini_api_key', null),
    getSetting('gemini_api_keys', null),
    getSetting('gemini_model', null),
    getSetting('gemini_fallback_models', null),
    getSetting('gemini_embedding_model', null),
    getSetting('groq_api_key', null),
    getSetting('groq_api_keys', null),
    getSetting('groq_model', null),
    getSetting('groq_fallback_models', null),
    getSetting('ollama_api_key', null),
    getSetting('ollama_model', null),
  ]);

  const geminiKeys = keyPool(geminiApiKeys, geminiApiKey, env.ai.gemini.apiKeys, env.ai.gemini.apiKey);
  const groqKeys = keyPool(groqApiKeys, groqApiKey, env.ai.groq.apiKeys, env.ai.groq.apiKey);
  const geminiModelPrimary = geminiModel || env.ai.gemini.model;
  const modelList = (raw) => String(raw || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const geminiModelExtras = geminiFallbackModels
    ? modelList(geminiFallbackModels)
    : (env.ai.gemini.fallbackModels || []);

  cache = {
    gemini: {
      apiKey: geminiKeys[0] || '',
      keys: geminiKeys,
      model: geminiModelPrimary,
      // Primary first, then backups — the generation pool walks keys across
      // the primary before downgrading the model.
      models: [...new Set([geminiModelPrimary, ...geminiModelExtras])],
      embeddingModel: geminiEmbeddingModel || env.ai.gemini.embeddingModel,
    },
    groq: {
      apiKey: groqKeys[0] || '',
      keys: groqKeys,
      model: groqModel || env.ai.groq.model,
      // Each Groq model has its own free-tier limit, so backups add capacity
      // and give independent checks a different model family.
      models: [...new Set([groqModel || env.ai.groq.model,
        ...(groqFallbackModels ? modelList(groqFallbackModels) : (env.ai.groq.fallbackModels || []))])],
    },
    ollama: {
      apiKey: ollamaApiKey || env.ai.ollama.apiKey,
      model: ollamaModel || env.ai.ollama.model,
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
