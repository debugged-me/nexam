/**
 * AI provider abstraction with automatic fallback.
 *
 * Primary:   Google Gemini (generation + embeddings) — via LangChain's
 *            ChatGoogleGenerativeAI and GoogleGenerativeAIEmbeddings
 * Fallbacks: Groq, then Ollama Cloud (generation only)
 *
 * LangChain manages the interaction between the vector retrieval process
 * and the Google Gemini API, as described in §3.1 of the capstone. If
 * Gemini fails (quota, rate limit, network), generation automatically
 * tries Groq and Ollama Cloud. Local embedding fallback lives in vectorStore.
 *
 * Every call returns a normalized result with the provider that served it,
 * so callers can record provenance in generation_meta.
 */
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import Groq from 'groq-sdk';
import env from '../config/env.js';
import { getAiConfig } from './aiConfig.js';
import { runGenerationFallback, isRetryableAiError } from './generationFallback.js';
import { generateOllamaCloud } from './ollamaCloud.js';

// Clients are cached per API key — a settings change rebuilds only the
// entry whose key/model signature changed.
const geminiChats = new Map();   // apiKey -> { sig, client }
const geminiEmbs = new Map();    // apiKey -> { sig, client }
const groqClis = new Map();      // apiKey -> client

/** Lazily initialize the LangChain Gemini chat model for a key+model pair. */
function getGeminiChat(cfg, key, model) {
  const id = `${key}${model}`;
  const hit = geminiChats.get(id);
  if (hit) return hit;
  const client = new ChatGoogleGenerativeAI({
    apiKey: key,
    model,
    temperature: env.ai.generation.temperature,
    maxOutputTokens: env.ai.generation.maxTokens,
    maxRetries: 0,
  });
  geminiChats.set(id, client);
  return client;
}

/** Lazily initialize the LangChain Gemini embeddings model for one pool key. */
export function getGeminiEmbeddings(cfg, key = cfg.gemini.apiKey) {
  const sig = cfg.gemini.embeddingModel;
  const hit = geminiEmbs.get(key);
  if (hit?.sig === sig) return hit.client;
  const client = new GoogleGenerativeAIEmbeddings({
    apiKey: key,
    model: cfg.gemini.embeddingModel,
  });
  geminiEmbs.set(key, { sig, client });
  return client;
}

/** Lazily initialize a Groq client for one pool key. */
function getGroq(cfg, key) {
  const hit = groqClis.get(key);
  if (hit) return hit;
  const client = new Groq({ apiKey: key, maxRetries: 0 });
  groqClis.set(key, client);
  return client;
}

/* ── Key/model pool health ─────────────────────────────
 * In-memory only:
 *  - 401/402/403 → the KEY is dead across every model (credential problem).
 *  - 429         → the key+model combo cools down until the provider's own
 *                  "retry in" window (default 15 min). Quotas are per-model,
 *                  so a cooled combo never blocks the same key elsewhere.
 *  - 5xx/network → not the credential's fault — the target stays unmarked.
 * A process restart simply retries a cooled target once. */
const deadKeys = new Set();      // `${provider}\0${key}` — credential rejected
const deadTargets = new Set();   // `${provider}\0${key}\0${model}` — model 404
const cooldowns = new Map();     // `${provider}\0${key}\0${model}` -> cooldownUntil

/** Extract the provider's own retry window from the error (header or text). */
function parseRetryMs(error) {
  const header = error?.headers?.get?.('retry-after') ?? error?.headers?.['retry-after'];
  const secs = Number(header);
  if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 24 * 3600_000);
  const m = /retry in (?:([0-9]+)h)?\s*(?:([0-9]+)m)?/i.exec(String(error?.message || ''));
  if (m && (m[1] || m[2])) return ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60) * 1000;
  return null;
}

/**
 * Extract the provider status from an SDK error — LangChain wraps provider
 * responses differently per path (status can sit on the error, its response,
 * its cause, or only appear in the message text).
 */
function providerStatus(error) {
  const details = `${error?.message || ''} ${error?.error?.code || ''} ${error?.code || ''}`;
  if (/blocked_api_access|spend(?:ing)?[ _-]*(?:cap|limit)|billing[ _-]*limit/i.test(details)) return 402;
  const direct = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.cause?.status);
  if (Number.isFinite(direct) && direct) return direct;
  const msg = `${error?.message || ''} ${error?.cause?.message || ''}`;
  if (/RESOURCE_EXHAUSTED|\b429\b|rate.?limit|quota/i.test(msg)) return 429;
  if (/API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED|\b40[13]\b/i.test(msg)) return 401;
  return 0;
}

function noteKeyFailure(provider, target, error) {
  const status = providerStatus(error);
  if (status === 401 || status === 402 || status === 403) {
    deadKeys.add(`${provider}\0${target.key}`);
  } else if (status === 404) {
    deadTargets.add(`${provider}\0${target.key}\0${target.model || ''}`);
  } else if (status === 408) {
    cooldowns.set(`${provider}\0${target.key}\0${target.model || ''}`, Date.now() + 60000);
  } else if (status === 429) {
    cooldowns.set(`${provider}\0${target.key}\0${target.model || ''}`,
      Date.now() + (parseRetryMs(error) ?? 15 * 60_000));
  }
}

function isHealthy(provider, target, now) {
  if (deadKeys.has(`${provider}\0${target.key}`)) return false;
  if (deadTargets.has(`${provider}\0${target.key}\0${target.model || ''}`)) return false;
  const until = cooldowns.get(`${provider}\0${target.key}\0${target.model || ''}`);
  return !(until && until > now);
}

/**
 * Sticky rotation over a provider's target pool ({key, model?, keyIndex?,
 * modelIndex?} entries tried in order). Credential, quota, and target-level
 * failures (404/5xx) rotate to the next target; deterministic errors (bad
 * prompt/schema — identical on every target) throw immediately.
 * Successful object results gain `keyIndex`/`modelIndex` for provenance.
 * `timeoutMs` (opt-in) aborts a stalled call and rotates to the next target;
 * embedding batches leave it unset because large rebuilds legitimately run long.
 */
export async function runPool(provider, targets, call, { timeoutMs = 0 } = {}) {
  const now = Date.now();
  const healthy = targets.filter((t) => isHealthy(provider, t, now));
  if (!healthy.length) {
    const error = new Error(`${provider} pool is exhausted or cooling down.`);
    error.status = 429; // availability failure — the outer chain advances
    throw error;
  }
  let lastError;
  for (const target of healthy) {
    if (!isHealthy(provider, target, Date.now())) continue; // killed mid-walk
    const controller = new AbortController();
    let timer;
    try {
      const pending = call(target, controller.signal);
      const result = timeoutMs > 0 ? await Promise.race([pending, new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = Object.assign(new Error('AI request timed out.'), { status: 408 });
          reject(error);
          controller.abort(error);
        }, timeoutMs);
      })]) : await pending;
      const extra = {};
      if (target.keyIndex != null) extra.keyIndex = target.keyIndex;
      if (target.modelIndex != null) extra.modelIndex = target.modelIndex;
      return result && typeof result === 'object' && !Array.isArray(result) && Object.keys(extra).length
        ? { ...result, ...extra }
        : result;
    } catch (error) {
      noteKeyFailure(provider, target, error);
      const status = providerStatus(error);
      if (!isRetryableAiError(error) && ![401, 402, 403, 404].includes(status)) throw error;
      lastError = error;
    } finally { clearTimeout(timer); }
  }
  // Every healthy target failed with a rotate-worthy error — normalize to a
  // 503 so the outer provider chain treats the pool as unavailable.
  lastError.status = 503;
  throw lastError;
}

/** Back-compat wrapper for key-only pools (Groq, embeddings, Ollama). */
export function runKeyPool(provider, keys, call, opts) {
  const targets = keys.map((key, i) => ({ key, keyIndex: i + 1 }));
  return runPool(provider, targets, (t, signal) => call(t.key, signal), opts);
}

/**
 * Generate text from a prompt, with structured JSON output.
 * Tries Gemini, Groq, then Ollama Cloud on quota/service failures. SDK-level
 * retries are disabled so an exhausted provider does not delay the fallback.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} opts — { jsonSchema?, temperature?, maxTokens?, timeoutMs?, avoidProvider? }
 * @returns {Promise<{text:string, provider:string, model:string, usage:object|null}>}
 */
export async function generate(systemPrompt, userPrompt, opts = {}) {
  const cfg = await getAiConfig();
  const {
    jsonSchema = null,
    timeoutMs = 90000,
    temperature = env.ai.generation.temperature,
    maxTokens = env.ai.generation.maxTokens,
    avoidProvider = null,
  } = opts;

  const providers = [
    {
      id: 'gemini',
      name: 'Gemini',
      configured: Boolean(cfg.gemini.keys.length),
      generate: () => {
        // All keys on the primary model first, then the fallback models —
        // a key swap preserves output consistency; a model swap is the
        // last Gemini resort before Groq.
        const targets = [];
        for (const [m, model] of cfg.gemini.models.entries()) {
          for (const [k, key] of cfg.gemini.keys.entries()) {
            targets.push({ key, model, keyIndex: k + 1, modelIndex: m + 1 });
          }
        }
        return runPool('gemini', targets, async ({ key, model: modelName }, signal) => {
          // Build the model with per-call overrides if needed
          let model = getGeminiChat(cfg, key, modelName);
          if (temperature !== env.ai.generation.temperature || maxTokens !== env.ai.generation.maxTokens) {
            model = new ChatGoogleGenerativeAI({
              apiKey: key,
              model: modelName,
              temperature,
              maxOutputTokens: maxTokens,
              maxRetries: 0,
            });
          }

          const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(userPrompt),
          ];

          // For JSON output, append an instruction to the system prompt
          // (LangChain's ChatGoogleGenerativeAI doesn't expose responseSchema
          // directly in the same way as the raw SDK; the instruction approach
          // is reliable across Gemini model versions).
          if (jsonSchema) {
            const schemaHint = `\n\nThe following is a JSON Schema definition, not the response itself. Return one JSON INSTANCE that satisfies it; never repeat or describe the schema: ${JSON.stringify(jsonSchema)}. Do not include markdown code fences or any text outside that JSON instance.`;
            messages[0] = new SystemMessage(systemPrompt + schemaHint);
          }

          const response = await model.invoke(messages, { signal });
          let text = typeof response.content === 'string'
            ? response.content
            : Array.isArray(response.content)
              ? response.content.map((c) => (typeof c === 'string' ? c : c.text || '')).join('')
              : '';

          // Strip markdown code fences if present
          text = text.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          }

          return {
            text,
            provider: 'gemini',
            model: modelName,
            usage: response.usage_metadata || response.additional_kwargs?.usage || null,
          };
        }, { timeoutMs });
      },
    },

    {
      id: 'groq',
      name: 'Groq',
      configured: Boolean(cfg.groq.keys.length),
      generate: () => runKeyPool('groq', cfg.groq.keys, async (key, signal) => {
        const completion = await getGroq(cfg, key).chat.completions.create({
          model: cfg.groq.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: jsonSchema ? { type: 'json_object' } : undefined,
        }, { signal, timeout: timeoutMs });

        const text = completion.choices[0]?.message?.content || '';
        return {
          text,
          provider: 'groq',
          model: cfg.groq.model,
          usage: completion.usage ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          } : null,
        };
      }, { timeoutMs }),
    },
    {
      id: 'ollama',
      name: 'Ollama Cloud',
      configured: Boolean(cfg.ollama.apiKey),
      generate: () => generateOllamaCloud(cfg.ollama, systemPrompt, userPrompt, { jsonSchema, temperature, maxTokens, timeoutMs }),
    },
  ];
  // An independent check (e.g. reviewing a draft) tries the other providers
  // first and only falls back to the drafting provider when they are down.
  const ordered = avoidProvider
    ? [...providers.filter((p) => p.id !== avoidProvider), ...providers.filter((p) => p.id === avoidProvider)]
    : providers;
  return runGenerationFallback(ordered);
}

/**
 * Generate an embedding vector for a piece of text.
 * Uses LangChain's GoogleGenerativeAIEmbeddings (Gemini-only — Groq has no embeddings).
 *
 * @param {string} text
 * @returns {Promise<{embedding:number[], provider:string, model:string}>}
 */
export async function embed(text) {
  const cfg = await getAiConfig();
  if (!cfg.gemini.keys.length) {
    throw new Error('Embedding requires a Gemini API key (no fallback available).');
  }
  return runKeyPool('gemini', cfg.gemini.keys, async (key) => {
    const embedding = await getGeminiEmbeddings(cfg, key).embedQuery(text);
    if (!embedding || !embedding.length) throw new Error('Embedding returned empty vector.');
    return { embedding, provider: 'gemini', model: cfg.gemini.embeddingModel };
  });
}

/**
 * Generate embeddings for multiple texts in one batch.
 * More efficient than calling embed() in a loop.
 *
 * @param {string[]} texts
 * @returns {Promise<{embeddings:number[][], provider:string, model:string}>}
 */
export async function embedBatch(texts) {
  const cfg = await getAiConfig();
  if (!cfg.gemini.keys.length) {
    throw new Error('Embedding requires a Gemini API key (no fallback available).');
  }
  return runKeyPool('gemini', cfg.gemini.keys, async (key) => {
    const results = await getGeminiEmbeddings(cfg, key).embedDocuments(texts);
    return {
      embeddings: results,
      provider: 'gemini',
      model: cfg.gemini.embeddingModel,
    };
  });
}

/* ── Connection tests ──────────────────────────────────
 * Small diagnostics run from the superadmin console against saved
 * credentials only. They use invented evidence — no user data is read or
 * written — and verify the provider returns parseable JSON citing the
 * exact evidence span, the same shape generation depends on. */
const TEST_EVIDENCE = 'Velorium turns violet at exactly 42 degrees Celsius.';
const TEST_SYSTEM = 'Answer only from the supplied evidence. Return JSON only.';
const TEST_USER = `EVIDENCE: ${TEST_EVIDENCE}\nAt what temperature does Velorium turn violet? Return answer as a number and evidence as the exact source sentence.`;
const TEST_SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'number' }, evidence: { type: 'string' } },
  required: ['answer', 'evidence'],
};
const TEST_TIMEOUT_MS = 25_000;

function testError(name, publicMessage, status = 502) {
  const error = new Error(publicMessage);
  error.status = status;
  error.publicMessage = publicMessage;
  return error;
}

/** Bound the test call so it finishes before the web client timeout. */
function withTimeout(promise, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(testError(name, `${name} timed out. Please try again shortly.`, 504)), TEST_TIMEOUT_MS)),
  ]);
}

/** Map raw SDK failures to safe messages — upstream bodies can carry prompt text. */
function normalizeProviderError(name, error) {
  if (error?.publicMessage) return error; // already a testError (e.g. timeout race)
  const status = providerStatus(error);
  if (status === 401 || status === 403) {
    return testError(name, `${name} rejected the API key. Check the saved key in AI settings.`, status);
  }
  if (status === 429) {
    // Providers embed a retry window in the error body — surface just the
    // duration, never the body itself.
    const retry = /retry in (?:([0-9]+)h)? ?(?:([0-9]+)m)?/i.exec(String(error?.message || ''));
    const span = retry && (retry[1] || retry[2])
      ? ` Retry in about ${[retry[1] && `${retry[1]}h`, retry[2] && `${retry[2]}m`].filter(Boolean).join(' ')}.`
      : ' Try again shortly.';
    return testError(name, `${name} rate limit or quota reached.${span}`, 429);
  }
  if (status === 404) return testError(name, `${name} model was not found. Check the model name in AI settings.`, 404);
  if (status === 402) return testError(name, `${name} usage is unavailable. Check billing or your free allowance.`, 402);
  if (status === 500 || status === 502 || status === 503 || status === 529) {
    return testError(name, `${name} is temporarily overloaded or unavailable. Try again shortly.`, status);
  }
  return testError(name, `${name} could not complete the request. Check the key and model, then try again.`, 502);
}

/** The answer must cite the exact invented sentence — proves JSON + grounding. */
function assertEvidenceAnswer(text, name) {
  const clean = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  let parsed;
  try { parsed = JSON.parse(clean); } catch { /* handled below */ }
  if (parsed?.answer !== 42 || parsed?.evidence !== TEST_EVIDENCE) {
    throw testError(name, `${name} responded but failed the JSON/evidence check. Try again or choose another model.`, 502);
  }
}

/** Extract plain text from a LangChain message content union. */
function contentText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : c.text || '')).join('');
  return '';
}

/** Mask a key for display — index + last4 only, never the credential. */
const maskKey = (key) => (key && String(key).length > 4 ? `••••${String(key).slice(-4)}` : '••••');

/** Run the evidence probe on one Gemini key. Throws normalized errors. */
async function probeGeminiKey(cfg, key) {
  const model = new ChatGoogleGenerativeAI({
    apiKey: key,
    model: cfg.gemini.model,
    temperature: 0,
    maxOutputTokens: 512,
    maxRetries: 0,
  });
  const schemaHint = `\n\nThe following is a JSON Schema definition, not the response itself. Return one JSON INSTANCE that satisfies it; never repeat or describe the schema: ${JSON.stringify(TEST_SCHEMA)}. Do not include markdown code fences or any text outside that JSON instance.`;
  const response = await withTimeout(
    model.invoke(
      [new SystemMessage(TEST_SYSTEM + schemaHint), new HumanMessage(TEST_USER)],
      { timeout: TEST_TIMEOUT_MS }
    ),
    'Gemini'
  );
  assertEvidenceAnswer(contentText(response?.content), 'Gemini');
}

/** Test keys in the Gemini pool — all of them, or one 1-based `keyIndex`.
 *  Individual failures return per-key results instead of aborting. */
export async function testGeminiConnection({ keyIndex = null } = {}) {
  const cfg = await getAiConfig();
  if (!cfg.gemini.keys.length) throw testError('Gemini', 'Save a Gemini API key first.', 400);
  const targets = keyIndex === null
    ? cfg.gemini.keys.map((key, i) => [i, key])
    : cfg.gemini.keys[keyIndex - 1] ? [[keyIndex - 1, cfg.gemini.keys[keyIndex - 1]]] : null;
  if (!targets) throw testError('Gemini', `No saved Gemini key at index ${keyIndex}.`, 400);
  const keys = [];
  for (const [index, key] of targets) {
    try {
      await probeGeminiKey(cfg, key);
      keys.push({ index: index + 1, masked: maskKey(key), ok: true, message: `Connected to ${cfg.gemini.model}.` });
    } catch (error) {
      const message = error.publicMessage || normalizeProviderError('Gemini', error).publicMessage;
      keys.push({ index: index + 1, masked: maskKey(key), ok: false, message });
    }
  }
  return { provider: 'gemini', model: cfg.gemini.model, keys };
}

/** Test keys in the Groq pool — all of them, or one 1-based `keyIndex`. */
export async function testGroqConnection({ keyIndex = null } = {}) {
  const cfg = await getAiConfig();
  if (!cfg.groq.keys.length) throw testError('Groq', 'Save a Groq API key first.', 400);
  const targets = keyIndex === null
    ? cfg.groq.keys.map((key, i) => [i, key])
    : cfg.groq.keys[keyIndex - 1] ? [[keyIndex - 1, cfg.groq.keys[keyIndex - 1]]] : null;
  if (!targets) throw testError('Groq', `No saved Groq key at index ${keyIndex}.`, 400);
  const keys = [];
  for (const [index, key] of targets) {
    try {
      const client = new Groq({ apiKey: key, maxRetries: 0 });
      const completion = await withTimeout(client.chat.completions.create({
        model: cfg.groq.model,
        messages: [
          { role: 'system', content: TEST_SYSTEM },
          { role: 'user', content: TEST_USER },
        ],
        temperature: 0,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }, { timeout: TEST_TIMEOUT_MS }), 'Groq');
      assertEvidenceAnswer(completion?.choices?.[0]?.message?.content, 'Groq');
      keys.push({ index: index + 1, masked: maskKey(key), ok: true, message: `Connected to ${cfg.groq.model}.` });
    } catch (error) {
      const message = error.publicMessage || normalizeProviderError('Groq', error).publicMessage;
      keys.push({ index: index + 1, masked: maskKey(key), ok: false, message });
    }
  }
  return { provider: 'groq', model: cfg.groq.model, keys };
}

/** Quick health check — which providers are configured? */
export async function status() {
  const cfg = await getAiConfig();
  return {
    gemini: Boolean(cfg.gemini.keys.length),
    groq: Boolean(cfg.groq.keys.length),
    ollama: Boolean(cfg.ollama.apiKey),
    geminiKeys: cfg.gemini.keys.length,
    groqKeys: cfg.groq.keys.length,
    geminiModel: cfg.gemini.model,
    geminiModels: cfg.gemini.models,
    groqModel: cfg.groq.model,
    ollamaModel: cfg.ollama.model,
    embeddingModel: cfg.gemini.embeddingModel,
    vectorStore: env.vectorStore.dir,
  };
}

export default { generate, embed, embedBatch, status, getGeminiEmbeddings, runKeyPool };
